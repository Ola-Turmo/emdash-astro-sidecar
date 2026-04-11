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
    const content = buildMunicipalPage(row);
    await writeFile(filePath, content, 'utf8');
    console.log(`Wrote ${path.relative(repoRoot, filePath)}`);
  }
}

function buildMunicipalPage(row) {
  const malformedA = badSequence(195, 165);
  const malformedDoubleA = badSequence(195, 402, 194, 165);
  const municipality = normalizeText(row.Kommunenavn);
  const county = normalizeText(row.Fylke);
  const languageForm = normalizeText(row['Målform'] || row[`M${malformedA}lform`] || row[`M${malformedDoubleA}lform`] || '');
  const domain = normalizeText(row.Domene || '');
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
  const guideLinks = getGuideLinks(municipality);

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
    `Målet er å gjøre det enklere å finne frem i lokale sider før du bruker tid på skjema, innsyn eller politiske dokumenter. Når du trenger forklaring på selve regelverket, går du videre til kurs og guider på kurs.ing.`,
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
    '## Hva du bør kontrollere før du går videre',
    '',
    `For ${municipality} er det lurt å kontrollere tre ting tidlig: hvor kommunen samler skjemaene sine, om skjenketider eller åpningstider er omtalt i egne lokale dokumenter, og om viktige saker ligger i innsynsløsningen.`,
    '',
    openingHoursRules.length > 0 || alcoholServingRules.length > 0
      ? 'Det finnes også strukturert informasjon om åpningstider eller skjenketider i datagrunnlaget. Bruk dette som pekepinn, men sjekk alltid kommunens egne sider før du sender søknad eller planlegger drift.'
      : `Datagrunnlaget inneholder foreløpig få detaljerte tidsregler for ${municipality}. Bruk derfor først og fremst kommunens egne sider og lokale dokumenter når du trenger presise tider og begrensninger.`,
    '',
    publicRecordsPlatform
      ? `## Innsyn og dokumentasjon\n\n${municipality} bruker ${publicRecordsPlatform} for innsyn eller journaltilgang. Det er nyttig hvis du trenger å forstå hvordan kommunen publiserer saker, postlister eller offentlig dokumentasjon.`
      : '',
    '',
    '## Når du bør gå videre til guide eller kurs',
    '',
    `Kommunesiden hjelper deg med lokale lenker. Når du trenger forklaring på kravene bak salgsbevilling, skjenkebevilling eller etablererprøven, bør du gå videre til innhold som forklarer regelverket enklere og mer samlet.`,
    '',
    ...guideLinks.map((link) => `- [${link.label}](${link.href})`),
    '',
    '## Kort oppsummert',
    '',
    `Bruk ${municipality}-siden som lokal inngang. Bruk guideseksjonen når du vil forstå kravene bedre. Bruk kurspakken når du er klar for pensum, oppgaver og eksamentrening.`,
  ].filter(Boolean);

  return `${frontmatter.join('\n')}\n\n${body.join('\n')}\n`;
}

function getGuideLinks(municipality) {
  return [
    {
      label: `Guide til etablererprøven for deg som jobber mot ${municipality}`,
      href: '/guide/blog/hvordan-besta-etablererproven/',
    },
    {
      label: 'Hva styrer og stedfortreder må kunne for skjenkebevillingsprøven',
      href: '/guide/blog/hva-ma-du-kunne-for-skjenkebevillingsproven/',
    },
    {
      label: 'Forskjellen på salgsbevilling og skjenkebevilling',
      href: '/guide/blog/forskjellen-pa-salgsbevilling-og-skjenkebevilling/',
    },
    {
      label: 'Se kurspakken på kurs.ing',
      href: 'https://www.kurs.ing/kasse.html',
    },
  ];
}

function buildLinkArray(name, links) {
  if (!links.length) return `${name}: []`;
  return `${name}:\n${links
    .map((link) => `  - label: "${escapeDoubleQuotes(normalizeText(link.label))}"\n    url: "${escapeDoubleQuotes(link.url)}"`)
    .join('\n')}`;
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
  const seq = (...codes) => String.fromCharCode(...codes);
  const replacements = [
    [seq(195, 402, 194, 166), 'æ'],
    [seq(195, 402, 8224), 'Æ'],
    [seq(195, 402, 194, 184), 'ø'],
    [seq(195, 402, 732, 339), 'Ø'],
    [seq(195, 402, 194, 165), 'å'],
    [seq(195, 402, 8230), 'Å'],
    [seq(195, 165), 'å'],
    [seq(195, 184), 'ø'],
    [seq(195, 166), 'æ'],
    [seq(195, 8230), 'Å'],
    [seq(195, 732), 'Ø'],
    [seq(195, 8224), 'Æ'],
    ['aapaingstider', 'åpningstider'],
    ['saerskilt', 'særskilt'],
    [`opph${seq(195, 184)}rer`, 'opphører'],
    [`n${seq(195, 166)}r`, 'nær'],
    [`p${seq(195, 165)}`, 'på'],
    [`n${seq(195, 165)}r`, 'når'],
    [`f${seq(195, 184)}r`, 'før'],
    [`m${seq(195, 165)}`, 'må'],
    [seq(195, 165), 'å'],
  ];

  let normalized = value;
  for (const [from, to] of replacements) {
    normalized = normalized.replaceAll(from, to);
  }
  return normalized;
}

function badSequence(...codes) {
  return String.fromCharCode(...codes);
}

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
