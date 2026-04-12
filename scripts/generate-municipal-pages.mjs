#!/usr/bin/env node

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const repoRoot = process.cwd();
const sourceRepo = path.join(path.dirname(repoRoot), 'kommune.no.apimcp.site');
const sourceCatalogPath = path.join(sourceRepo, 'kommune_catalog.enriched.json');
const outputDir = path.join(repoRoot, 'apps', 'blog', 'src', 'content', 'municipalPages');

const targetMunicipalities = [
  'Oslo',
  'Bergen',
  'Trondheim',
  'Stavanger',
  'Kristiansand',
  'Tromsø',
  'Bærum',
  'Sandnes',
  'Drammen',
  'Fredrikstad',
  'Asker',
  'Lillestrøm',
  'Sandefjord',
  'Alta',
  'Bodø',
  'Ålesund',
  'Tønsberg',
  'Porsgrunn',
  'Skien',
  'Arendal',
  'Haugesund',
  'Moss',
  'Sarpsborg',
  'Hamar',
  'Lillehammer',
  'Harstad',
  'Narvik',
  'Gjøvik',
  'Larvik',
  'Kongsberg',
];

async function main() {
  const raw = await readFile(sourceCatalogPath, 'utf8');
  const catalog = JSON.parse(raw);

  await mkdir(outputDir, { recursive: true });

  for (const municipalityName of targetMunicipalities) {
    const row = catalog.find((entry) => normalizeText(entry.Kommunenavn) === municipalityName);
    if (!row) {
      console.warn(`Skipping ${municipalityName}: not found in source catalog`);
      continue;
    }

    const slug = slugify(row.Kommunenavn);
    const filePath = path.join(outputDir, `${slug}.mdx`);
    const content = await buildMunicipalPage(row);
    await writeFile(filePath, content, 'utf8');
    console.log(`Wrote ${path.relative(repoRoot, filePath)}`);
  }
}

async function buildMunicipalPage(row) {
  const normalizedRow = normalizeObjectKeys(row);
  const municipality = normalizeText(normalizedRow.Kommunenavn);
  const county = normalizeText(normalizedRow.Fylke);
  const languageForm = normalizeText(normalizedRow['Målform'] || '');
  const domain = normalizeText(normalizedRow.Domene || '');
  const siteUrl = row.site_url || '';
  const formsUrl = row.forms_url || '';
  const publicRecordsUrl = row.innsyn_url || '';
  const publicRecordsPlatform = normalizeText(row.innsyn_platform || '');
  const sitePlatform = normalizeText(
    typeof row.site_platform === 'string' ? row.site_platform : row.site_platform?.name || '',
  );
  const sourceLastChecked = row.last_checked || '';
  const title = `${municipality}: skjenking, innsyn og praktiske lenker i kommunen`;
  const description = `${municipality} kommune samlet på ett sted: skjenking, servering, innsyn, skjema og lenker du kan bruke når du trenger oversikt over lokale sider og praktiske veier videre.`;

  const serviceLinks = (row.alcohol_restaurant_urls || [])
    .slice(0, 5)
    .map((url, index) => ({
      label: index === 0 ? 'Hovedside for salg, servering og skjenking' : `Relevant kommuneside ${index + 1}`,
      url,
    }));

  const regulationsLinks = (row.forskrifter_urls || []).slice(0, 5).map((url, index) => ({
    label: `Forskrift ${index + 1}`,
    url,
  }));

  const bylawLinks = (row.vedtekter_urls || []).slice(0, 5).map((url, index) => ({
    label: `Vedtekt ${index + 1}`,
    url,
  }));

  const openingHoursRules = (row.opening_hours_rules || []).slice(0, 4).map((rule) => ({
    appliesTo: normalizeText(rule.applies_to || ''),
    days: normalizeText(rule.days || ''),
    startTime: rule.start_time || '',
    endTime: rule.end_time || '',
    note: normalizeText(rule.note || ''),
  }));

  const alcoholServingRules = (row.alcohol_serving_hours_rules || []).slice(0, 4).map((rule) => ({
    area: normalizeText(rule.area || ''),
    groups: Array.isArray(rule.alcohol_groups) ? rule.alcohol_groups : [],
    days: normalizeText(rule.days || ''),
    startTime: rule.start_time || '',
    endTime: rule.end_time || '',
    note: normalizeText(rule.note || ''),
  }));

  const officialSourceCandidates = uniqueSources([
    { label: 'Kommunens hovedside', url: siteUrl },
    { label: 'Salg, servering og skjenking', url: serviceLinks[0]?.url || alcoholPolicyPlanUrl },
    { label: 'Skjema og selvbetjening', url: formsUrl },
    { label: 'Innsyn', url: publicRecordsUrl },
  ]).slice(0, 4);

  const officialSources = (
    await Promise.all(
      officialSourceCandidates.map(async (source) => ({
        ...source,
        ...(await fetchOfficialSourceSummary(source.url)),
      })),
    )
  ).map((source) => ({
    ...source,
    title: source.title || source.label,
  }));

  const localChecklist = buildLocalChecklist({
    municipality,
    publicRecordsPlatform,
    formsUrl,
    alcoholPolicyPlanUrl: row.alcohol_policy_plan_url || '',
    openingHoursRules,
    alcoholServingRules,
    officialSources,
  });

  const relatedGuideLinks = [
    {
      label: `Slik forbereder du deg til etablererprøven når du jobber mot ${municipality}`,
      url: 'https://www.kurs.ing/guide/blog/hvordan-besta-etablererproven/',
    },
    {
      label: 'Hva styrer og stedfortreder må kunne for skjenkebevillingsprøven',
      url: 'https://www.kurs.ing/guide/blog/hva-ma-du-kunne-for-skjenkebevillingsproven/',
    },
    {
      label: 'Forskjellen på salgsbevilling og skjenkebevilling',
      url: 'https://www.kurs.ing/guide/blog/forskjellen-pa-salgsbevilling-og-skjenkebevilling/',
    },
    {
      label: 'Se hele kurspakken på kurs.ing',
      url: 'https://www.kurs.ing/kasse.html',
    },
  ];

  const frontmatter = [
    '---',
    'siteKey: kurs-ing',
    'conceptKey: kommune',
    `municipalityNumber: "${row.Nr}"`,
    `municipality: "${escapeDoubleQuotes(municipality)}"`,
    `county: "${escapeDoubleQuotes(county)}"`,
    `languageForm: "${escapeDoubleQuotes(languageForm)}"`,
    `domain: "${escapeDoubleQuotes(domain)}"`,
    `municipalitySiteUrl: "${escapeDoubleQuotes(siteUrl)}"`,
    row.alcohol_policy_plan_url ? `alcoholPolicyPlanUrl: "${escapeDoubleQuotes(row.alcohol_policy_plan_url)}"` : null,
    formsUrl ? `formsUrl: "${escapeDoubleQuotes(formsUrl)}"` : null,
    publicRecordsUrl ? `publicRecordsUrl: "${escapeDoubleQuotes(publicRecordsUrl)}"` : null,
    publicRecordsPlatform ? `publicRecordsPlatform: "${escapeDoubleQuotes(publicRecordsPlatform)}"` : null,
    sitePlatform ? `municipalitySitePlatform: "${escapeDoubleQuotes(sitePlatform)}"` : null,
    row.site_last_updated?.value
      ? `siteLastUpdated:\n  value: "${row.site_last_updated.value}"\n  method: "${escapeDoubleQuotes(normalizeText(row.site_last_updated.method || ''))}"\n  confidence: "${escapeDoubleQuotes(normalizeText(row.site_last_updated.confidence || ''))}"\n  observedAt: "${escapeDoubleQuotes(normalizeText(row.site_last_updated.observed_at || ''))}"`
      : null,
    buildLinkArray('serviceLinks', serviceLinks),
    buildLinkArray('regulationsLinks', regulationsLinks),
    buildLinkArray('bylawLinks', bylawLinks),
    buildOfficialSourcesArray('officialSources', officialSources),
    buildStringArray('localChecklist', localChecklist),
    buildLinkArray('relatedGuideLinks', relatedGuideLinks),
    buildRuleArray('openingHoursRules', openingHoursRules),
    buildAlcoholRuleArray('alcoholServingRules', alcoholServingRules),
    'sourceRepo: "Ola-Turmo/kommune.no.apimcp.site"',
    sourceLastChecked ? `sourceLastChecked: "${escapeDoubleQuotes(sourceLastChecked)}"` : null,
    `title: "${escapeDoubleQuotes(title)}"`,
    `description: "${escapeDoubleQuotes(description)}"`,
    'pubDate: 2026-04-12',
    'draft: false',
    '---',
  ].filter(Boolean);

  const body = [
    `Denne siden samler praktiske innganger for ${municipality} kommune når du trenger oversikt over salg, servering, skjenking, innsyn og relevante kommunesider.`,
    '',
    buildMunicipalityOverview({
      municipality,
      county,
      publicRecordsPlatform,
      sitePlatform,
      officialSources,
      alcoholServingRules,
      openingHoursRules,
    }),
    '',
    '## Start her hvis du jobber mot denne kommunen',
    '',
    siteUrl ? `- Åpne [kommunens nettsted](${siteUrl}) for lokale innganger og praktisk informasjon.` : null,
    formsUrl ? `- Finn [skjema og selvbetjening](${formsUrl}) hvis du skal sende noe inn eller trenger kommunens veiledere.` : null,
    publicRecordsUrl ? `- Bruk [innsynsløsningen](${publicRecordsUrl}) hvis du vil se postlister, tidligere saker eller offentlig dokumentasjon.` : null,
    row.alcohol_policy_plan_url
      ? `- Les [alkoholpolitisk plan eller skjenketider](${row.alcohol_policy_plan_url}) hvis kommunen har publisert dette direkte.`
      : null,
    '',
    '## Dette bør du merke deg i denne kommunen',
    '',
    buildMunicipalitySpecifics({
      municipality,
      officialSources,
      alcoholServingRules,
      openingHoursRules,
      publicRecordsPlatform,
      formsUrl,
    }),
    '',
    '## Kommunale sider som er mest relevante her',
    '',
    ...buildBodySourceBullets({
      municipality,
      officialSources,
      serviceLinks,
      regulationsLinks,
      bylawLinks,
      publicRecordsPlatform,
      sitePlatform,
    }),
    '',
    '## Lokale temaer vi faktisk fant på kommunens egne sider',
    '',
    ...buildLocalTopicBullets({
      municipality,
      serviceLinks,
      regulationsLinks,
      bylawLinks,
    }),
    '',
    '## Hva du bør kontrollere før du går videre',
    '',
    ...localChecklist.map((item) => `- ${item}`),
    '',
    officialSources.length > 0 ? '## Det kommunen selv fremhever' : '',
    '',
    ...officialSources.map((source) =>
      [`### ${source.label}`, source.title ? `**${source.title}**` : '', source.summary || '', source.url ? `[Åpne kilden](${source.url})` : '']
        .filter(Boolean)
        .join('\n\n'),
    ),
    '',
    '## Når du bør gå videre til guide eller kurs',
    '',
    `Kommunesiden hjelper deg med lokale lenker. Når du trenger forklaring på kravene bak salgsbevilling, skjenkebevilling eller etablererprøven, bør du gå videre til innhold som forklarer regelverket enklere og mer samlet.`,
    '',
    ...relatedGuideLinks.map((link) => `- [${link.label}](${link.url})`),
    '',
    '## Kort oppsummert',
    '',
    `Bruk ${municipality}-siden som lokal inngang. Bruk guideseksjonen når du vil forstå kravene bedre. Bruk kurspakken når du er klar for pensum, oppgaver og eksamentrening.`,
  ].filter(Boolean);

  return `${frontmatter.join('\n')}\n\n${body.join('\n')}\n`;
}

function buildMunicipalityOverview({
  municipality,
  county,
  publicRecordsPlatform,
  sitePlatform,
  officialSources,
  alcoholServingRules,
  openingHoursRules,
}) {
  const parts = [];

  if (county) {
    parts.push(`${municipality} ligger i ${county}, og kommunen har sine egne innganger for bevillinger, skjema og innsyn.`);
  } else {
    parts.push(`${municipality} har egne kommunale innganger for bevillinger, skjema og innsyn.`);
  }

  if (publicRecordsPlatform) {
    parts.push(`Innsyn håndteres gjennom ${publicRecordsPlatform}, noe som gjør det lettere å se hvordan kommunen publiserer saker og dokumenter.`);
  }

  if (sitePlatform) {
    parts.push(`Det offentlige innholdet ligger på en ${sitePlatform}-basert kommuneside, så det er ofte verdt å følge kommunens egne temalenker i stedet for bare søk.`);
  }

  const officialSummary = officialSources.find((entry) => entry.summary)?.summary;
  if (officialSummary) {
    parts.push(`Kommunens egne sider peker særlig på dette: ${officialSummary}`);
  }

  if (alcoholServingRules.length > 0 || openingHoursRules.length > 0) {
    parts.push(`Datagrunnlaget inneholder også lokale opplysninger om skjenketider eller åpningstider som kan gi deg en raskere start.`);
  }

  return parts.join(' ');
}

function buildMunicipalitySpecifics({
  municipality,
  officialSources,
  alcoholServingRules,
  openingHoursRules,
  publicRecordsPlatform,
  formsUrl,
}) {
  const details = [];

  const serviceSummary = officialSources.find((entry) => entry.label === 'Salg, servering og skjenking')?.summary;
  if (serviceSummary) {
    details.push(`${municipality} fremhever selv følgende på bevillingssiden: ${serviceSummary}`);
  }

  if (alcoholServingRules[0]?.note) {
    details.push(`I det strukturerte datagrunnlaget ligger det en konkret opplysning om skjenking: ${alcoholServingRules[0].note}`);
  }

  if (openingHoursRules[0]?.note) {
    details.push(`For åpningstid eller driftsrammer peker datagrunnlaget blant annet på dette: ${openingHoursRules[0].note}`);
  }

  if (publicRecordsPlatform) {
    details.push(`Hvis du trenger mer bakgrunn eller vil se tidligere behandling, er ${publicRecordsPlatform} det naturlige stedet å åpne etter at du har lest kommunens temasider.`);
  }

  if (formsUrl) {
    details.push(`Det lønner seg å åpne skjemaoversikten tidlig, slik at du ser om ${municipality} ber om vedlegg, roller eller dokumentasjon som er lett å overse.`);
  }

  return details.join(' ');
}

function buildBodySourceBullets({
  municipality,
  officialSources,
  serviceLinks,
  regulationsLinks,
  bylawLinks,
  publicRecordsPlatform,
  sitePlatform,
}) {
  const bullets = [];

  for (const source of officialSources.slice(0, 4)) {
    const summary = source.summary ? ` ${source.summary}` : '';
    const title = source.title && source.title !== source.label ? ` (${source.title})` : '';
    bullets.push(`[${source.label}](${source.url})${title}.${summary}`.trim());
  }

  if (serviceLinks[1]?.url) {
    bullets.push(`I ${municipality} ligger det også flere undersider under bevillingsområdet, for eksempel [${serviceLinks[1].label}](${serviceLinks[1].url}).`);
  }

  if (regulationsLinks[0]?.url) {
    bullets.push(`Det finnes også lokal eller registrert forskriftsinformasjon å følge opp, blant annet [${regulationsLinks[0].label}](${regulationsLinks[0].url}).`);
  }

  if (bylawLinks[0]?.url) {
    bullets.push(`Kommunen publiserer også lokale vedtekter eller lignende dokumenter, som [${bylawLinks[0].label}](${bylawLinks[0].url}).`);
  }

  if (publicRecordsPlatform) {
    bullets.push(`Hvis du vil sammenligne disse sidene med tidligere saker eller vedtak, er ${publicRecordsPlatform} den mest relevante innsynsinngangen akkurat her.`);
  }

  if (sitePlatform) {
    bullets.push(`Siden kommunen bruker ${sitePlatform}, er det ofte nyttig å følge interne temasider og ikke bare fritekstsøk.`);
  }

  return bullets.slice(0, 8).map((item) => `- ${item}`);
}

function buildLocalTopicBullets({
  municipality,
  serviceLinks,
  regulationsLinks,
  bylawLinks,
}) {
  const topics = new Set();

  for (const link of [...serviceLinks, ...regulationsLinks, ...bylawLinks]) {
    const topic = describeUrlPath(link.url);
    if (topic) {
      topics.add(topic);
    }
    if (topics.size >= 6) break;
  }

  if (!topics.size) {
    return [
      `- Vi fant foreløpig få tydelige undersider for ${municipality}, så denne siden bør senere utvides med mer redaksjonelt lokalt innhold.`,
    ];
  }

  return [...topics].map((topic) => `- ${municipality} har en tydelig kommunal inngang knyttet til ${topic}.`);
}

function uniqueSources(sources) {
  const seen = new Set();
  return sources.filter((source) => {
    if (!source.url || seen.has(source.url)) return false;
    seen.add(source.url);
    return true;
  });
}

async function fetchOfficialSourceSummary(url) {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000);
    const response = await fetch(url, {
      headers: {
        'user-agent': 'Mozilla/5.0 (compatible; emdash-sidecar/1.0)',
        accept: 'text/html,application/xhtml+xml',
      },
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!response.ok) {
      return {};
    }

    const html = await response.text();
    const title = cleanText(
      decodeHtmlEntities(html.match(/<title[^>]*>(.*?)<\/title>/is)?.[1] || ''),
    );
    const description = cleanText(
      decodeHtmlEntities(
        html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i)?.[1] ||
          html.match(/<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)["']/i)?.[1] ||
          '',
      ),
    );
    const paragraphCandidates = [...html.matchAll(/<p\b[^>]*>(.*?)<\/p>/gis)]
      .map((match) => cleanText(decodeHtmlEntities(match[1] || '')))
      .filter(Boolean);
    const firstUsefulParagraph = paragraphCandidates.find((entry) => !isBoilerplateParagraph(entry)) || '';

    const chosenSummary = isLowQualitySummary(description) ? firstUsefulParagraph : description || firstUsefulParagraph;
    const summary = normalizeText(chosenSummary || firstUsefulParagraph || description)
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 320);

    return {
      title: normalizeText(title).slice(0, 180),
      summary,
    };
  } catch {
    return {};
  }
}

function buildLocalChecklist({
  municipality,
  publicRecordsPlatform,
  formsUrl,
  alcoholPolicyPlanUrl,
  openingHoursRules,
  alcoholServingRules,
  officialSources,
}) {
  const checklist = [
    `Start med kommunens hovedside og les den kommunale informasjonen om servering og skjenking for ${municipality} før du tolker regelverket selv.`,
  ];

  if (formsUrl) {
    checklist.push('Åpne skjema- eller selvbetjeningssiden tidlig, slik at du ser hvilke opplysninger kommunen faktisk ber om.');
  }

  if (publicRecordsPlatform) {
    checklist.push(`Bruk ${publicRecordsPlatform} hvis du vil se hvordan kommunen publiserer saker, dokumenter eller tidligere behandling.`);
  }

  if (alcoholPolicyPlanUrl) {
    checklist.push('Sjekk alkoholpolitisk plan eller skjenketider før du legger opp drift, åpningstider eller konsept.');
  }

  if (alcoholServingRules.length > 0 || openingHoursRules.length > 0) {
    checklist.push('Sammenlign de strukturerte tidsreglene her med kommunens egne sider før du sender søknad eller planlegger åpningstid.');
  }

  if (officialSources.length > 0) {
    checklist.push('Les oppsummeringene fra de offisielle kildene under og åpne originalsidene når du trenger detaljene.');
  }

  return checklist;
}

function buildLinkArray(name, links) {
  if (!links.length) return `${name}: []`;
  return `${name}:\n${links
    .map((link) => {
      const noteLine = link.note ? `\n    note: "${escapeDoubleQuotes(normalizeText(link.note))}"` : '';
      return `  - label: "${escapeDoubleQuotes(normalizeText(link.label))}"\n    url: "${escapeDoubleQuotes(link.url)}"${noteLine}`;
    })
    .join('\n')}`;
}

function buildOfficialSourcesArray(name, items) {
  if (!items.length) return `${name}: []`;
  return `${name}:\n${items
    .map((item) => {
      const titleLine = item.title ? `\n    title: "${escapeDoubleQuotes(normalizeText(item.title))}"` : '';
      const summaryLine = item.summary ? `\n    summary: "${escapeDoubleQuotes(normalizeText(item.summary))}"` : '';
      return `  - label: "${escapeDoubleQuotes(normalizeText(item.label))}"\n    url: "${escapeDoubleQuotes(item.url)}"${titleLine}${summaryLine}`;
    })
    .join('\n')}`;
}

function buildStringArray(name, values) {
  if (!values.length) return `${name}: []`;
  return `${name}:\n${values.map((value) => `  - "${escapeDoubleQuotes(normalizeText(value))}"`).join('\n')}`;
}

function buildRuleArray(name, rules) {
  if (!rules.length) return `${name}: []`;
  return `${name}:\n${rules
    .map((rule) => {
      const fields = [
        rule.appliesTo ? `    appliesTo: "${escapeDoubleQuotes(rule.appliesTo)}"` : null,
        rule.days ? `    days: "${escapeDoubleQuotes(rule.days)}"` : null,
        rule.startTime ? `    startTime: "${escapeDoubleQuotes(rule.startTime)}"` : null,
        rule.endTime ? `    endTime: "${escapeDoubleQuotes(rule.endTime)}"` : null,
        `    note: "${escapeDoubleQuotes(rule.note)}"`,
      ].filter(Boolean);
      return `  -\n${fields.join('\n')}`;
    })
    .join('\n')}`;
}

function buildAlcoholRuleArray(name, rules) {
  if (!rules.length) return `${name}: []`;
  return `${name}:\n${rules
    .map((rule) => {
      const groups = rule.groups?.length ? `[${rule.groups.map((entry) => `"${entry}"`).join(', ')}]` : '[]';
      const fields = [
        rule.area ? `    area: "${escapeDoubleQuotes(rule.area)}"` : null,
        `    groups: ${groups}`,
        rule.days ? `    days: "${escapeDoubleQuotes(rule.days)}"` : null,
        rule.startTime ? `    startTime: "${escapeDoubleQuotes(rule.startTime)}"` : null,
        rule.endTime ? `    endTime: "${escapeDoubleQuotes(rule.endTime)}"` : null,
        `    note: "${escapeDoubleQuotes(rule.note)}"`,
      ].filter(Boolean);
      return `  -\n${fields.join('\n')}`;
    })
    .join('\n')}`;
}

function normalizeText(value) {
  return decodeCommonMojibake(String(value ?? ''))
    .replace(/\s+/g, ' ')
    .trim();
}

function decodeCommonMojibake(value) {
  let normalized = String(value ?? '');

  for (let i = 0; i < 2; i += 1) {
    if (!looksMojibake(normalized)) break;
    const repaired = Buffer.from(normalized, 'latin1').toString('utf8');
    if (!looksMoreLegible(repaired, normalized)) break;
    normalized = repaired;
  }

  return normalized
    .replace(/aapaingstider/gi, 'åpningstider')
    .replace(/saerskilt/gi, 'særskilt')
    .replace(/\baapent\b/gi, 'åpent')
    .replace(/\baapen\b/gi, 'åpen')
    .replace(/\bgjore\b/gi, 'gjøre')
    .replace(/\bsoke\b/gi, 'søke');
}

function cleanText(value) {
  return String(value ?? '')
    .replace(/\{\{[\s\S]*?\}\}/g, ' ')
    .replace(/\{[\s\S]*?\}/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function describeUrlPath(value) {
  try {
    const url = new URL(value);
    const tokens = url.pathname
      .split('/')
      .flatMap((segment) => segment.split('-'))
      .map((token) => normalizeText(token))
      .map((token) => token.toLowerCase())
      .filter((token) => token.length >= 4)
      .filter((token) => !pathStopWords.has(token));

    const unique = [];
    for (const token of tokens) {
      if (!unique.includes(token)) {
        unique.push(token);
      }
      if (unique.length >= 4) break;
    }

    if (!unique.length) {
      return '';
    }

    return unique.join(', ');
  } catch {
    return '';
  }
}

function decodeHtmlEntities(value) {
  let decoded = String(value ?? '');
  for (let i = 0; i < 3; i += 1) {
    const next = decoded
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&aring;/gi, 'å')
      .replace(/&oslash;/gi, 'ø')
      .replace(/&aelig;/gi, 'æ')
      .replace(/&Aring;/g, 'Å')
      .replace(/&Oslash;/g, 'Ø')
      .replace(/&AElig;/g, 'Æ')
      .replace(/&ldquo;|&rdquo;/gi, '"')
      .replace(/&lsquo;|&rsquo;/gi, "'")
      .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(Number.parseInt(hex, 16)))
      .replace(/&#([0-9]+);/g, (_, dec) => String.fromCodePoint(Number.parseInt(dec, 10)));
    if (next === decoded) break;
    decoded = next;
  }
  return decoded;
}

function isLowQualitySummary(value) {
  const text = cleanText(value);
  if (!text) return true;
  if (text.length < 40) return true;
  const commaCount = (text.match(/,/g) || []).length;
  if (commaCount >= 3 && !/[.!?]/.test(text)) return true;
  if (/\bskjenking\s+\w+,\s+\w+\s+\w+/iu.test(text)) return true;
  return false;
}

function isBoilerplateParagraph(value) {
  const text = cleanText(value);
  if (!text) return true;
  if (/hold (ctrl|cmd)-?tasten/iu.test(text)) return true;
  if (/forstørre|forminske/iu.test(text)) return true;
  if (/cookie|personvern|tilgjengelighet/iu.test(text)) return true;
  return text.length < 40;
}

function looksMojibake(value) {
  return /[\u00C2\u00C3]/u.test(value);
}

function looksMoreLegible(nextValue, previousValue) {
  const weirdBefore = countWeirdMarkers(previousValue);
  const weirdAfter = countWeirdMarkers(nextValue);
  return weirdAfter < weirdBefore || (weirdBefore > 0 && nextValue.includes('å'));
}

function countWeirdMarkers(value) {
  return [...value].filter((char) => char === '\u00C2' || char === '\u00C3').length;
}

function normalizeObjectKeys(input) {
  return Object.fromEntries(
    Object.entries(input).map(([key, value]) => [decodeCommonMojibake(key), value]),
  );
}

const pathStopWords = new Set([
  'https',
  'www',
  'kommune',
  'tjenester',
  'politikk',
  'administrasjon',
  'naring',
  'landbruk',
  'organisasjon',
  'barnehage',
  'skole',
  'innsyn',
  'dokumenter',
  'vedtak',
]);

function slugify(value) {
  return normalizeText(value)
    .toLowerCase()
    .replace(/[æ]/g, 'ae')
    .replace(/[ø]/g, 'o')
    .replace(/[å]/g, 'a')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

function escapeDoubleQuotes(value) {
  return String(value).replace(/"/g, '\\"');
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
