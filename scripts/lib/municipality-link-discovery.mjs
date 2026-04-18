import { normalizeText } from './municipality-evidence.mjs';

const alcoholKeywords = [
  'alkohol',
  'bevill',
  'bevilling',
  'skjenk',
  'skjenk',
  'skjenke',
  'skjenking',
  'skjenketid',
  'skjenketider',
  'salg',
  'servering',
  'serverings',
  'serveringsbevilling',
  'serveringsloyve',
  'serveringsløyve',
  'skjenkeloyve',
  'skjenkeløyve',
  'salgsbevilling',
  'salsloyve',
  'salsløyve',
  'bevillingar',
  'løyve',
  'loyve',
  'uteserver',
  'uteservering',
  'gebyr',
  'fornyelse',
  'kontroll',
  'arrangement',
  'enkelt',
  'ambulerende',
  'tillatelse',
  'tillatelser',
  'prove',
  'prøve',
  'kunnskap',
  'ansvarlig',
  'vertskap',
  'styrer',
  'stedfortreder',
  'skjema',
  'søknad',
  'soknad',
  'søke',
  'soke',
];

const bannedMunicipalLinkKeywords = [
  'gravplass',
  'barnehage',
  'skole',
  'feiing',
  'bal-og-grill',
  'bygg',
  'anlegg',
  'rabattordning',
  'eiendomsskatt',
  'faktura',
];

const permitSignals = /(alkohol|skjenk|salg|servering|bevilling|løyve|loyve|skjema|søk|sok|prøve|prove|gebyr|kontroll|arrangement|styrer|stedfortreder|uteserver)/iu;
const strongPermitSignals = /(alkohol|skjenk|salg|servering|bevilling|løyve|loyve|skjema|søknad|soknad|søke|soke|prøve|prove|gebyr|kontroll|innsyn|postliste|uteserver)/iu;

export function isAlcoholRelevantUrl(value) {
  try {
    const pathname = decodeURIComponent(new URL(value).pathname.toLowerCase());
    const tokens = pathname.split(/[^a-z0-9æøå]+/i).filter(Boolean);
    if (
      bannedMunicipalLinkKeywords.some((keyword) =>
        tokens.some((token) => token === keyword || token.startsWith(keyword)),
      )
    ) {
      return false;
    }
    return alcoholKeywords.some((keyword) => tokens.some((token) => token.includes(keyword)));
  } catch {
    return false;
  }
}

export function classifyMunicipalLink(value, fallbackLabel = 'Salg, servering og skjenking') {
  const kind = classifyMunicipalLinkKind(value, fallbackLabel);
  if (kind === 'outdoor') return 'Uteservering';
  if (kind === 'singleEvent') return 'Enkeltanledning og arrangement';
  if (kind === 'fees') return 'Gebyr og satser';
  if (kind === 'renewal') return 'Fornyelse av bevilling';
  if (kind === 'controls') return 'Kontroll og tilsyn';
  if (kind === 'exam') return 'Prøver og kunnskapskrav';
  if (kind === 'sales') return 'Salgsbevilling';
  if (kind === 'servering') return 'Serveringsbevilling';
  if (kind === 'serving') return 'Skjenkebevilling';
  if (kind === 'plan') return 'Lokale regler og tider';
  if (kind === 'application') return 'Søke bevilling eller gjøre endringer';
  if (kind === 'rules') return 'Regler og lokale vilkår';
  if (kind === 'serviceHub') return 'Salg, servering og skjenking';
  if (kind === 'forms') return 'Skjema og selvbetjening';
  if (kind === 'publicRecords') return 'Innsyn og offentlig journal';
  return fallbackLabel;
}

export function classifyMunicipalLinkKind(value, fallbackKind = 'general') {
  try {
    const rawUrl = String(value).toLowerCase();
    const source = `${rawUrl} ${String(fallbackKind).toLowerCase()}`;
    const pathname = decodeURIComponent(new URL(rawUrl).pathname.toLowerCase());

    if (
      /\/(etablerer(-|_)?(og-)?kunnskapspro(v|e)ene?|kunnskapspro(v|e)er?|kunnskapsproven[e]?|kunnskapsprove|etablererproven|etablererprove)\/?$/.test(
        pathname,
      )
    ) {
      return 'exam';
    }

    if (
      /\/(kontroller?-og-regelbrudd|kontroll|kontroll-av-salg-servering-og-skjenking|kontroll-og-prikktildeling|omsetningsoppgave|ved-brudd-pa-alkoholloven)\/?$/.test(
        pathname,
      )
    ) {
      return 'controls';
    }

    if (
      /\/(skjenkebevilling.*(enkelt|arrangement|ambulerende)|skjenkeloyve.*(enkelt|arrangement|ambulerende)|enkeltarrangement|enkelt-anledning|enkeltanledning|ambulerende-skjenkebevilling|bevilling-for-en-enkelt-anledning|arrangement)\/?$/.test(
        pathname,
      )
    ) {
      return 'singleEvent';
    }

    if (/\/(uteservering|uteserveringsordning)\/?$/.test(pathname)) return 'outdoor';
    if (/\/salgsbevilling(\/|$)|\/salsloyve(\/|$)|\/salsløyve(\/|$)/.test(pathname)) return 'sales';
    if (/\/(skjenkebevilling|skjenkeloyve|skjenkeløyve)(\/|$)/.test(pathname)) return 'serving';
    if (/\/(serveringsbevilling|serveringsloyve|serveringsløyve)(\/|$)/.test(pathname)) return 'servering';

    if (
      /\/(alkohol-servering-og-tobakk|alkohol-og-servering|salg-servering-og-skjenkebevilling|sal-servering-og-skjenking|sal-og-servering-av-alkohol|salgs-serverings-og-skjenkebevilling|skjenking-og-servering|skjenkebevilling-og-servering|salg-servering-og-skjenking|salgs-og-skjenkebevilling|salg-servering-og-skjenkebevilling|salg-servering-og-skjenking)\/?$/.test(
        pathname,
      )
    ) {
      return 'serviceHub';
    }

    if (
      /\/(soke-om-bevillinger|søke-om-bevillinger|soke-om-eller-endre-bevillinger|søke-om-eller-endre-bevillinger|soknadsskjemaer|søknadsskjemaer|soknadsskjema|søknadsskjema|soke-eller-gjore-endring-pa-bevilling2|søke-eller-gjore-endring-pa-bevilling2|soke-eller-gjore-endring-pa-bevilling|søke-eller-gjore-endring-pa-bevilling|endring-i-styrerforholdene|overdragelse-av-bevillingen|ny-styrer-eller-stedfortreder|endring-av-styrar-avloysar|faste-bevillinger|ordinar-skjenke-og-serveringsbevilling|ordinar-skjenke-og-serveringsbevilling|ordinar-skjenke-og-serveringsbevilling|soke-om-skjenkebevilling|søke-om-skjenkebevilling|sok-om-skjenkebevilling|søknad_om_skjenkebevilling|soknad_om_skjenkebevilling|soknad_om_serveringsbevilling|søknad_om_serveringsbevilling|soknad_om_salgsbevilling|søknad_om_salgsbevilling)\/?$/.test(
        pathname,
      )
    ) {
      return 'application';
    }

    if (
      /\/(regelverk-for-salgs-og-skjenkesteder|regler-for-salg-og-skjenking|lover-og-regler|salgs--og-skjenkeretningslinjer|salg-og-skjenketider|skjenketider)\/?$/.test(
        pathname,
      )
    ) {
      return 'rules';
    }

    if (/\/(skjema|skjemaer|skjemaoversikt|selvbetjening)\/?$/.test(pathname)) return 'forms';
    if (/https?:\/\/([a-z0-9-]+\.)?skjema\.no\//.test(rawUrl) || /https?:\/\/skjema\.[^/]+\/skjema\//.test(rawUrl)) {
      return 'forms';
    }
    if (/\/(innsyn|postliste|offentlig-journal)\/?$/.test(pathname)) return 'publicRecords';
    if (/\/(bevillingsgebyr|gebyr|satser)\/?$/.test(pathname)) return 'fees';
    if (/\/(fornyelse|fornye)\/?$/.test(pathname)) return 'renewal';

    if (/handlingsplan|alkoholpolitisk/.test(source)) return 'plan';
    if (/plan|retningslinje|skjenketider/.test(source)) return 'rules';
    if (/enkelt.?anledning|enkeltarrangement|arrangement|ambulerende/.test(source)) return 'singleEvent';
    if (/kontroll|regelbrudd|prikktildeling|omsetningsoppgave|tilsyn/.test(source)) return 'controls';
    if (/kunnskapsprøve|kunnskapsprove|etablererprøve|etablererprove|\bprøve\b|\bprove\b/.test(source)) return 'exam';
    if (/uteserver|offentlig-areal/.test(source)) return 'outdoor';
    if (
      /søk|sok|søknad|soknad|skjema|endre|endring|overdragelse|styrer|stedfortreder|bevilling/.test(
        source,
      )
    ) {
      return 'application';
    }
    if (/regler-for|lokale-regler|skjenketider|lover-og-regler/.test(source)) return 'rules';
    if (/salg-servering-og-skjenking|alkohol-og-servering|skjenkebevilling-og-servering/.test(source)) {
      return 'serviceHub';
    }
    if (/skjema|ekstern\/veiledere|\/skjema/.test(source)) return 'forms';
    if (/innsyn|journal|einnsyn|postliste/.test(source)) return 'publicRecords';
    if (/gebyr|satser/.test(source)) return 'fees';
    if (/fornyelse|fornye/.test(source)) return 'renewal';
    if (/serveringsbevilling|serveringsloyve|serveringsløyve|servering/.test(source)) return 'servering';
    if (/skjenkebevilling|skjenkeloyve|skjenkeløyve|skjenking|alkohol/.test(source)) return 'serving';
    if (/salgsbevilling|salsloyve|salsløyve|salg/.test(source)) return 'sales';
  } catch {
    return fallbackKind;
  }
  return fallbackKind;
}

export async function discoverSupplementalMunicipalityLinks({
  seedUrls = [],
  siteUrl = '',
  maxCandidates = 18,
}) {
  const queue = uniqueUrls([...seedUrls.filter(Boolean), siteUrl].slice(0, 4));
  const results = [];
  const seen = new Set();

  for (const baseUrl of queue) {
    const links = await fetchPermitLinksFromPage(baseUrl);
    for (const link of links) {
      if (seen.has(link.url)) continue;
      seen.add(link.url);
      results.push(link);
      if (results.length >= maxCandidates) {
        return results;
      }
    }
  }

  if (results.length < maxCandidates && siteUrl) {
    const sitemapLinks = await fetchPermitLinksFromSitemap(siteUrl, maxCandidates - results.length);
    for (const link of sitemapLinks) {
      if (seen.has(link.url)) continue;
      seen.add(link.url);
      results.push(link);
      if (results.length >= maxCandidates) break;
    }
  }

  return results;
}

async function fetchPermitLinksFromPage(pageUrl) {
  const response = await fetchHtml(pageUrl);
  if (!response.ok || !response.html) {
    return [];
  }

  const pageHost = new URL(response.finalUrl || pageUrl).hostname.toLowerCase();
  const matches = [...response.html.matchAll(/<a[^>]+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)];
  const links = [];

  for (const match of matches) {
    const resolvedUrl = resolveUrl(match[1], response.finalUrl || pageUrl);
    if (!resolvedUrl || !isMunicipalityPermitCandidate(resolvedUrl, match[2], pageHost)) {
      continue;
    }
    const label = buildDiscoveredLabel(resolvedUrl, match[2]);
    links.push({
      label,
      url: resolvedUrl,
      kind: classifyMunicipalLinkKind(resolvedUrl, label),
    });
  }

  return prioritizeDiscoveredLinks(links);
}

async function fetchPermitLinksFromSitemap(siteUrl, limit = 12) {
  try {
    const root = new URL(siteUrl);
    const sitemapUrl = new URL('/sitemap.xml', root).toString();
    const response = await fetchHtml(sitemapUrl);
    if (!response.ok || !response.html) {
      return [];
    }

    const sitemapLocs = [...response.html.matchAll(/<loc>([^<]+)<\/loc>/gi)]
      .map((match) => normalizeText(match[1]))
      .filter(Boolean);

    let candidateUrls = sitemapLocs;
    if (response.html.includes('<sitemapindex')) {
      candidateUrls = [];
      for (const loc of sitemapLocs.slice(0, 6)) {
        const nested = await fetchHtml(loc);
        if (!nested.ok || !nested.html) continue;
        candidateUrls.push(
          ...[...nested.html.matchAll(/<loc>([^<]+)<\/loc>/gi)]
            .map((match) => normalizeText(match[1]))
            .filter(Boolean),
        );
        if (candidateUrls.length >= 400) break;
      }
    }

    return prioritizeDiscoveredLinks(
      candidateUrls
        .filter((url) => isAlcoholRelevantUrl(url))
        .slice(0, 200)
        .map((url) => ({
          label: buildDiscoveredLabel(url, ''),
          url,
          kind: classifyMunicipalLinkKind(url, ''),
        })),
    ).slice(0, limit);
  } catch {
    return [];
  }
}

async function fetchHtml(url) {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    const response = await fetch(url, {
      redirect: 'follow',
      headers: {
        'user-agent': 'Mozilla/5.0 (compatible; emdash-sidecar/1.0)',
        accept: 'text/html,application/xhtml+xml,application/xml,text/xml',
      },
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!response.ok) {
      return { ok: false, status: response.status, finalUrl: response.url };
    }

    const html = await response.text();
    return { ok: true, html, finalUrl: response.url };
  } catch {
    return { ok: false };
  }
}

function resolveUrl(value, baseUrl) {
  try {
    const resolved = new URL(value, baseUrl);
    resolved.hash = '';
    return resolved.toString();
  } catch {
    return '';
  }
}

function isMunicipalityPermitCandidate(url, anchorHtml, pageHost) {
  try {
    const candidate = new URL(url);
    const hostname = candidate.hostname.toLowerCase();
    const anchorText = normalizeText(stripHtml(anchorHtml));
    const pathText = decodeURIComponent(candidate.pathname);
    const source = `${pathText} ${anchorText}`.toLowerCase();
    const tokens = source.split(/[^a-z0-9æøå]+/i).filter(Boolean);
    if (
      bannedMunicipalLinkKeywords.some((keyword) =>
        tokens.some((token) => token === keyword || token.startsWith(keyword)),
      )
    ) {
      return false;
    }
    if (
      /(eiendomsskatt|fakturainformasjon|kommunale-gebyrer|faktura)/i.test(source) &&
      !/(alkohol|skjenk|salg|servering|bevilling|løyve|loyve|bevillingsgebyr|omsetningsoppgave)/i.test(source)
    ) {
      return false;
    }
    if (!permitSignals.test(source)) return false;
    if (
      /for-ansatte|ledige-stillinger|kontakt-oss|om-kommunen$|\/nyheter\/|\/aktuelt\/|\/kunngjoring/i.test(pathText) ||
      /for ansatte/i.test(anchorText)
    ) {
      return false;
    }
    if (!isAlcoholRelevantUrl(url) && !strongPermitSignals.test(anchorText) && !strongPermitSignals.test(pathText)) {
      return false;
    }
    if (hostname !== pageHost && !hostname.endsWith(`.${pageHost}`) && !hostname.includes('skjema.')) {
      return false;
    }
    if (/\.pdf($|\?)/i.test(candidate.pathname) && !/alkohol|skjenk|bevilling|løyve|loyve|retningslinje|handlingsplan/i.test(source)) {
      return false;
    }
    return isAlcoholRelevantUrl(url) || permitSignals.test(anchorText);
  } catch {
    return false;
  }
}

function buildDiscoveredLabel(url, anchorHtml) {
  const anchorText = normalizeText(stripHtml(anchorHtml));
  if (anchorText && permitSignals.test(anchorText)) {
    return anchorText;
  }
  return classifyMunicipalLink(url);
}

function prioritizeDiscoveredLinks(links) {
  const unique = [];
  const seen = new Set();
  for (const link of links) {
    if (!link?.url || seen.has(link.url)) continue;
    seen.add(link.url);
    unique.push(link);
  }

  return unique.sort((a, b) => priorityForKind(a.kind) - priorityForKind(b.kind));
}

function priorityForKind(kind) {
  const priorityOrder = [
    'plan',
    'application',
    'serving',
    'servering',
    'sales',
    'serviceHub',
    'rules',
    'controls',
    'singleEvent',
    'outdoor',
    'exam',
    'fees',
    'renewal',
    'forms',
    'publicRecords',
  ];
  const index = priorityOrder.indexOf(kind);
  return index === -1 ? 999 : index;
}

function uniqueUrls(urls) {
  return [...new Set(urls.filter(Boolean))];
}

function stripHtml(value) {
  return String(value ?? '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
