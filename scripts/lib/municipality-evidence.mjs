const inspectionCache = new Map();

const missingPagePatterns = [
  /beklager[, ]+du er kommet til en side som ikke eksisterer/i,
  /siden finnes ikke/i,
  /finner ikke siden/i,
  /side som ikke eksisterer/i,
  /page not found/i,
  /not found/i,
  /404/i,
];

const semanticSignals = {
  plan: ['alkohol', 'skjenk', 'skjenketid', 'alkoholpolitisk', 'retningslinje', 'bevilling'],
  forms: ['skjema', 'send inn', 'søknad', 'bevilling', 'selvbetjening'],
  publicRecords: ['innsyn', 'postliste', 'journal', 'offentlig', 'saksinnsyn', 'einnsyn'],
  serviceHub: ['salg', 'servering', 'skjenking', 'alkohol', 'bevilling'],
  application: ['søk', 'søknad', 'endre', 'bevilling', 'melding'],
  rules: ['regel', 'vilkår', 'skjenking', 'salg', 'bevilling', 'prikktildeling'],
  sales: ['salgsbevilling', 'salg', 'alkohol', 'bevilling'],
  serving: ['skjenkebevilling', 'skjenking', 'alkohol', 'bevilling'],
  servering: ['serveringsbevilling', 'servering', 'bevilling'],
  fees: ['gebyr', 'satser', 'bevilling'],
  renewal: ['fornyelse', 'fornye', 'bevilling'],
  controls: ['kontroll', 'regelbrudd', 'prikktildeling', 'omsetningsoppgave', 'tilsyn'],
  outdoor: ['uteserver', 'uteareal', 'offentlig areal'],
  singleEvent: ['arrangement', 'enkeltanledning', 'midlertidig', 'enkelt arrangement'],
  exam: ['kunnskapsprøve', 'kunnskapsprove', 'etablerer', 'prøve', 'prove'],
};

export function isDerivedRuleNote(value = '') {
  return /utledet fra|derived from|antatt|beregnet/i.test(normalizeText(value));
}

export async function inspectMunicipalityUrl(url, expectedKind = 'general') {
  if (!url) {
    return { ok: false, reason: 'missing_url' };
  }

  const cacheKey = `${expectedKind}|${url}`;
  if (inspectionCache.has(cacheKey)) {
    return inspectionCache.get(cacheKey);
  }

  const promise = inspectMunicipalityUrlInner(url, expectedKind);
  inspectionCache.set(cacheKey, promise);
  return promise;
}

async function inspectMunicipalityUrlInner(url, expectedKind) {
  let lastError = null;

  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 20000);
      const response = await fetch(url, {
        redirect: 'follow',
        headers: {
          'user-agent': 'Mozilla/5.0 (compatible; emdash-sidecar/1.0)',
          accept: 'text/html,application/xhtml+xml',
        },
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (!response.ok) {
        return { ok: false, reason: `http_${response.status}`, finalUrl: response.url };
      }

      const text = await response.text();
      const normalizedBody = normalizeText(stripHtml(text));
      const normalizedTitle = normalizeText(
        decodeHtmlEntities(text.match(/<title[^>]*>(.*?)<\/title>/is)?.[1] || ''),
      );
      const haystack = `${normalizedTitle} ${normalizedBody}`.toLowerCase();

      if (missingPagePatterns.some((pattern) => pattern.test(haystack))) {
        return {
          ok: false,
          reason: 'missing_page_content',
          finalUrl: response.url,
          title: normalizedTitle,
        };
      }

      if (!matchesExpectedSemantics(url, expectedKind, haystack)) {
        return {
          ok: false,
          reason: `semantic_mismatch:${expectedKind}`,
          finalUrl: response.url,
          title: normalizedTitle,
        };
      }

      return {
        ok: true,
        finalUrl: response.url,
        title: normalizedTitle,
        summary: normalizedBody.slice(0, 320),
      };
    } catch (error) {
      lastError = error;
      if (attempt === 1) break;
      await new Promise((resolve) => setTimeout(resolve, 500 * (attempt + 1)));
    }
  }

  return {
    ok: false,
    reason: lastError instanceof Error ? lastError.name : 'fetch_error',
  };
}

function matchesExpectedSemantics(url, expectedKind, haystack) {
  if (expectedKind === 'general') return true;

  try {
    const hostname = new URL(url).hostname.toLowerCase();
    if (expectedKind === 'forms' && hostname.includes('skjema.no')) return true;
    if (expectedKind === 'publicRecords' && (hostname.includes('einnsyn.no') || haystack.includes('postliste') || haystack.includes('innsyn'))) {
      return true;
    }
  } catch {
    // ignore
  }

  const signals = semanticSignals[expectedKind] || [];
  return signals.some((signal) => haystack.includes(signal));
}

function stripHtml(value) {
  return String(value ?? '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function decodeHtmlEntities(value) {
  return String(value ?? '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}

export function normalizeText(value) {
  let normalized = String(value ?? '');
  for (let index = 0; index < 2; index += 1) {
    if (!/[ÃƒÃ‚]/.test(normalized)) break;
    const repaired = Buffer.from(normalized, 'latin1').toString('utf8');
    if (countMarkers(repaired) > countMarkers(normalized)) break;
    normalized = repaired;
  }
  return normalized
    .replace(/â€“/g, '-')
    .replace(/â€”/g, '-')
    .replace(/\s+/g, ' ')
    .trim();
}

function countMarkers(value) {
  return [...String(value || '')].filter((character) => character === 'Ãƒ' || character === 'Ã‚').length;
}
