#!/usr/bin/env node

import { access, mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import {
  curatedMunicipalityPublishSet,
  getMunicipalityEditorialProfile,
} from './lib/municipality-curation.mjs';

const repoRoot = process.cwd();
const sourceRepo = path.join(path.dirname(repoRoot), 'kommune.no.apimcp.site');
const sourceCatalogPath = path.join(sourceRepo, 'kommune_catalog.enriched.json');
const outputDir = path.join(repoRoot, 'apps', 'blog', 'src', 'content', 'municipalPages');
const publicImageDir = path.join(repoRoot, 'apps', 'blog', 'public', 'images', 'kommune');

const targetMunicipalities = curatedMunicipalityPublishSet;

const alcoholKeywords = [
  'alkohol',
  'bevilling',
  'skjenk',
  'salg',
  'servering',
  'uteserver',
  'gebyr',
  'fornyelse',
  'kontroll',
  'arrangement',
  'enkelt',
  'prove',
  'prøve',
  'kunnskap',
  'ansvarlig',
  'vertskap',
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
    const content = await buildMunicipalPage(row, slug);
    await writeFile(filePath, content, 'utf8');
    console.log(`Wrote ${path.relative(repoRoot, filePath)}`);
  }

  await draftLegacyMunicipalityPages();
}

async function buildMunicipalPage(row, slug) {
  const normalizedRow = normalizeObjectKeys(row);
  const municipality = normalizeText(normalizedRow.Kommunenavn);
  const county = normalizeText(normalizedRow.Fylke);
  const editorialProfile = getMunicipalityEditorialProfile(municipality);
  const languageForm = normalizeText(normalizedRow['Målform'] || '');
  const domain = normalizeText(normalizedRow.Domene || '');
  const siteUrl = row.site_url || '';
  const formsUrl = row.forms_url || '';
  const publicRecordsUrl = row.innsyn_url || '';
  const alcoholPolicyPlanUrl = row.alcohol_policy_plan_url || '';
  const publicRecordsPlatform = normalizeText(row.innsyn_platform || '');
  const sitePlatform = normalizeText(
    typeof row.site_platform === 'string' ? row.site_platform : row.site_platform?.name || '',
  );
  const sourceLastChecked = row.last_checked || '';
  const title = `${municipality}: skjenketider, bevilling og kommunale sider du faktisk trenger`;
  const description = `Se hva ${municipality} faktisk oppgir om skjenketider, åpningstid, søknad og innsyn før du planlegger drift eller søker bevilling.`;

  const serviceLinks = (row.alcohol_restaurant_urls || [])
    .filter((url) => isAlcoholRelevantUrl(url))
    .slice(0, 6)
    .map((url) => ({
      label: classifyMunicipalLink(url),
      url,
    }));

  const regulationsLinks = (row.forskrifter_urls || []).filter((url) => isAlcoholRelevantUrl(url)).slice(0, 3).map((url) => ({
    label: classifyMunicipalLink(url, 'Lokale regler'),
    url,
  }));

  const bylawLinks = (row.vedtekter_urls || []).filter((url) => isAlcoholRelevantUrl(url)).slice(0, 3).map((url) => ({
    label: classifyMunicipalLink(url, 'Lokale vilkår'),
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
    { label: 'Skjenketider eller alkoholpolitisk plan', url: alcoholPolicyPlanUrl },
    { label: serviceLinks[0]?.label || 'Salg, servering og skjenking', url: serviceLinks[0]?.url },
    { label: serviceLinks[1]?.label || 'Søknad eller endring', url: serviceLinks[1]?.url },
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
    summary: sanitizeOfficialSourceSummary(source.label, source.summary),
  })).filter((source) => source.url);

  const localChecklist = buildLocalChecklist({
    municipality,
    publicRecordsPlatform,
    formsUrl,
    alcoholPolicyPlanUrl: row.alcohol_policy_plan_url || '',
    openingHoursRules,
    alcoholServingRules,
    officialSources,
    editorialProfile,
  });

  const municipalityQuality = assessMunicipalityQuality({
    municipality,
    editorialProfile,
    alcoholPolicyPlanUrl,
    formsUrl,
    publicRecordsUrl,
    officialSources,
    serviceLinks,
    regulationsLinks,
    bylawLinks,
    openingHoursRules,
    alcoholServingRules,
  });
  const heroImage = await resolveMunicipalityHeroImage(slug, municipality, county);

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

  const editorialTakeaways = editorialProfile?.editorialTakeaways ?? [];
  const editorialLead = buildEditorialLead({
    municipality,
    openingHoursRules,
    alcoholServingRules,
    editorialProfile,
  });

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
    heroImage
      ? `heroImage:\n  src: "${escapeDoubleQuotes(heroImage.src)}"\n  alt: "${escapeDoubleQuotes(heroImage.alt)}"`
      : null,
    row.site_last_updated?.value
      ? `siteLastUpdated:\n  value: "${row.site_last_updated.value}"\n  method: "${escapeDoubleQuotes(normalizeText(row.site_last_updated.method || ''))}"\n  confidence: "${escapeDoubleQuotes(normalizeText(row.site_last_updated.confidence || ''))}"\n  observedAt: "${escapeDoubleQuotes(normalizeText(row.site_last_updated.observed_at || ''))}"`
      : null,
    buildLinkArray('serviceLinks', serviceLinks),
    buildLinkArray('regulationsLinks', regulationsLinks),
    buildLinkArray('bylawLinks', bylawLinks),
    buildOfficialSourcesArray('officialSources', officialSources),
    buildStringArray('editorialTakeaways', editorialTakeaways),
    buildStringArray('practicalSteps', localChecklist),
    `editorialLead: "${escapeDoubleQuotes(editorialLead)}"`,
    buildStringArray('localChecklist', localChecklist),
    buildLinkArray('relatedGuideLinks', relatedGuideLinks),
    buildRuleArray('openingHoursRules', openingHoursRules),
    buildAlcoholRuleArray('alcoholServingRules', alcoholServingRules),
    'sourceRepo: "Ola-Turmo/kommune.no.apimcp.site"',
    sourceLastChecked ? `sourceLastChecked: "${escapeDoubleQuotes(sourceLastChecked)}"` : null,
    `municipalityQuality:\n  score: ${municipalityQuality.score}\n  publishable: ${municipalityQuality.publishable ? 'true' : 'false'}\n  reasons:\n${municipalityQuality.reasons.map((reason) => `    - "${escapeDoubleQuotes(reason)}"`).join('\n')}`,
    `title: "${escapeDoubleQuotes(title)}"`,
    `description: "${escapeDoubleQuotes(description)}"`,
    'pubDate: 2026-04-12',
    `draft: ${municipalityQuality.publishable ? 'false' : 'true'}`,
    '---',
  ].filter(Boolean);

  const body = [
    editorialLead,
    '',
    ...buildSpecificRuleBullets({ municipality, openingHoursRules, alcoholServingRules }),
    '',
    ...editorialTakeaways.map((item) => `- ${item}`),
    '',
    ...localChecklist.map((item) => `- ${item}`),
    '',
    ...relatedGuideLinks.map((link) => `- [${link.label}](${link.url})`),
  ].filter(Boolean);

  return `${frontmatter.join('\n')}\n\n${body.join('\n')}\n`;
}

async function resolveMunicipalityHeroImage(slug, municipality, county) {
  const filename = `${slug}-hero.png`;
  const diskPath = path.join(publicImageDir, filename);
  try {
    await access(diskPath);
    return {
      src: `/images/kommune/${filename}`,
      alt: `Stemningsbilde for ${municipality}${county ? ` i ${county}` : ''}`,
    };
  } catch {
    return null;
  }
}

async function draftLegacyMunicipalityPages() {
  const entries = await readdir(outputDir, { withFileTypes: true });
  const allowedSlugs = new Set(targetMunicipalities.map((value) => slugify(value)));

  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith('.mdx')) continue;
    const slug = entry.name.replace(/\.mdx$/i, '');
    if (allowedSlugs.has(slug)) continue;

    const filePath = path.join(outputDir, entry.name);
    const source = await readFile(filePath, 'utf8');
    if (!/draft:\s*false/.test(source)) continue;

    const updated = source.replace(/draft:\s*false/, 'draft: true');
    await writeFile(filePath, updated, 'utf8');
    console.log(`Drafted legacy municipality page ${path.relative(repoRoot, filePath)}`);
  }
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
    parts.push(`${municipality} ligger i ${county}, men det er kommunen selv som setter de praktiske rammene for bevilling, skjema og innsyn.`);
  } else {
    parts.push(`${municipality} har egne kommunale sider for bevilling, skjema og innsyn.`);
  }

  if (publicRecordsPlatform) {
    parts.push(`Innsyn går via ${publicRecordsPlatform}, så du kan følge saker, vedtak og tidligere behandling på samme sted.`);
  }

  if (sitePlatform) {
    parts.push(`Kommunen publiserer stoffet sitt på ${sitePlatform}, så det lønner seg å følge temasidene direkte i stedet for å stole på gamle søkeresultater.`);
  }

  const officialSummary = officialSources.find(
    (entry) => hasUsefulSummary(entry.summary) && hasPermitSignal(`${entry.label} ${entry.summary || ''}`),
  )?.summary;
  if (officialSummary) {
    parts.push(`På kommunens egne sider løftes særlig dette fram: ${officialSummary}`);
  }

  if (alcoholServingRules.length > 0 || openingHoursRules.length > 0) {
    parts.push('Vi fant også konkrete lokale tider eller driftsrammer som gir deg et bedre utgangspunkt før du åpner originalkilden.');
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

  const serviceSummary = officialSources.find(
    (entry) =>
      entry.label === 'Salg, servering og skjenking' &&
      hasUsefulSummary(entry.summary) &&
      hasPermitSignal(`${entry.label} ${entry.summary || ''}`),
  )?.summary;
  if (serviceSummary) {
    details.push(`På bevillingssiden trekker ${municipality} særlig fram dette: ${serviceSummary}`);
  }

  if (alcoholServingRules[0]?.note) {
    details.push(`Kommunen oppgir også dette om skjenking: ${alcoholServingRules[0].note}`);
  }

  if (openingHoursRules[0]?.note) {
    details.push(`For åpningstid eller drift peker kommunen blant annet på dette: ${openingHoursRules[0].note}`);
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
    const summary = hasUsefulSummary(source.summary) && hasPermitSignal(`${source.label} ${source.summary || ''}`)
      ? ` ${source.summary}`
      : '';
    const title = source.title && source.title !== source.label ? ` (${source.title})` : '';
    bullets.push(`[${source.label}](${source.url})${title}.${summary}`.trim());
  }

  if (serviceLinks[1]?.url) {
    bullets.push(`Det finnes også flere undersider under bevillingsområdet, for eksempel [${serviceLinks[1].label}](${serviceLinks[1].url}).`);
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
    bullets.push(`Siden kommunen bruker ${sitePlatform}, er det lurt å følge temasidene direkte og ikke bare fritekstsøk.`);
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
      `- Vi fant foreløpig få tydelige undersider om bevilling i ${municipality}, så du bør starte med hovedsiden og innsyn før du går videre.`,
    ];
  }

  return [...topics].map((topic) => `- ${municipality} har en egen side eller underside knyttet til ${topic}.`);
}

function uniqueSources(sources) {
  const seen = new Set();
  return sources.filter((source) => {
    if (!source.url || seen.has(source.url)) return false;
    seen.add(source.url);
    return true;
  });
}

function uniqueValues(values) {
  return [...new Set(values.map((value) => normalizeText(value)).filter(Boolean))];
}

function isAlcoholRelevantUrl(value) {
  try {
    const pathname = new URL(value).pathname.toLowerCase();
    if (bannedMunicipalLinkKeywords.some((keyword) => pathname.includes(keyword))) {
      return false;
    }
    return alcoholKeywords.some((keyword) => pathname.includes(keyword));
  } catch {
    return false;
  }
}

function classifyMunicipalLink(value, fallbackLabel = 'Salg, servering og skjenking') {
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

function classifyMunicipalLinkKind(value, fallbackKind = 'general') {
  try {
    const rawUrl = String(value).toLowerCase();
    const source = `${rawUrl} ${String(fallbackKind).toLowerCase()}`;
    const pathname = new URL(rawUrl).pathname;
    if (/\/salgsbevilling(\/|$)/.test(pathname)) return 'sales';
    if (/\/skjenkebevilling/.test(pathname)) return 'serving';
    if (/\/serveringsbevilling/.test(pathname)) return 'servering';
    if (/\/alkohol-servering-og-tobakk\/?$/.test(pathname)) return 'serviceHub';
    if (/\/soke-om-bevillinger\/?$|\/soke-om-eller-endre-bevillinger\/?$|\/søke-om-bevillinger\/?$|\/søke-om-eller-endre-bevillinger\/?$/.test(pathname)) return 'application';
    if (/\/regelverk-for-salgs-og-skjenkesteder\/?$|\/regler-for-salg-og-skjenking\/?$|\/kontroll-og-prikktildeling\/?$/.test(pathname)) return 'rules';
    if (/\/omsetningsoppgave\/?$/.test(pathname)) return 'controls';
    if (/handlingsplan|alkoholpolitisk|plan|retningslinje|skjenketider/.test(source)) return 'plan';
    if (/soke-bevilling|søke-bevilling|gjore-endringer|gjøre-endringer/.test(source)) return 'application';
    if (/regler-for|lokale-regler|skjenketider/.test(source)) return 'rules';
    if (/salg-servering-og-skjenking|alkohol-og-servering/.test(source)) return 'serviceHub';
    if (/skjema|ekstern\/veiledere|\/skjema/.test(source)) return 'forms';
    if (/innsyn|journal|einnsyn/.test(source)) return 'publicRecords';
    if (/uteserver|offentlig-areal/.test(source)) return 'outdoor';
    if (/enkelt.?anledning|arrangement/.test(source)) return 'singleEvent';
    if (/gebyr|satser/.test(source)) return 'fees';
    if (/fornyelse|fornye/.test(source)) return 'renewal';
    if (/kontroll/.test(source)) return 'controls';
    if (/prove|prøve|kunnskap|etablerer/.test(source)) return 'exam';
    if (/serveringsbevilling|servering/.test(source)) return 'servering';
    if (/skjenkebevilling|skjenking|alkohol/.test(source)) return 'serving';
    if (/salgsbevilling|salg/.test(source)) return 'sales';
  } catch {
    return fallbackKind;
  }
  return fallbackKind;
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
      summary: hasUsefulSummary(summary) ? summary : '',
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
  editorialProfile,
}) {
  const checklist = [...(editorialProfile?.practicalSteps ?? [])];

  if (!checklist.length) {
    checklist.push(`Start på kommunens egne sider for skjenking og søknad før du begynner å tolke regelverket selv i ${municipality}.`);
  }

  if (!editorialProfile && formsUrl) {
    checklist.push('Åpne skjema- eller selvbetjeningssiden tidlig, slik at du ser hvilke opplysninger kommunen faktisk ber om.');
  }

  if (!editorialProfile && publicRecordsPlatform) {
    checklist.push(`Bruk ${publicRecordsPlatform} hvis du vil se hvordan kommunen publiserer saker, dokumenter eller tidligere behandling.`);
  }

  if (!editorialProfile && alcoholPolicyPlanUrl) {
    checklist.push('Sjekk alkoholpolitisk plan eller skjenketider før du legger opp drift, åpningstider eller konsept.');
  }

  if (!editorialProfile && (alcoholServingRules.length > 0 || openingHoursRules.length > 0)) {
    checklist.push('Sammenlign tidene oppsummert her med kommunens egne sider før du sender søknad eller planlegger åpningstid.');
  }

  if (!editorialProfile && officialSources.length > 0) {
    checklist.push('Les oppsummeringene fra de offisielle kildene under og åpne originalsidene når du trenger detaljene.');
  }

  return uniqueValues(checklist).slice(0, 6);
}

function buildEditorialLead({
  municipality,
  openingHoursRules,
  alcoholServingRules,
  editorialProfile,
}) {
  const parts = [];
  const firstServingRule = alcoholServingRules.find((rule) => rule.endTime || rule.note);
  const firstOpeningRule = openingHoursRules.find((rule) => rule.endTime || rule.note);
  if (firstServingRule) {
    const groups = firstServingRule.groups?.length ? `gruppe ${firstServingRule.groups.join(', ')}` : 'skjenking';
    const timeWindow =
      firstServingRule.startTime && firstServingRule.endTime
        ? `${firstServingRule.startTime}-${firstServingRule.endTime}`
        : firstServingRule.endTime
          ? `til ${firstServingRule.endTime}`
          : '';
    if (timeWindow) {
      parts.push(`Her ser du hva ${municipality} oppgir om ${groups} ${normalizeText(firstServingRule.days || 'alle dager')} ${timeWindow}.`);
    }
  }

  if (firstOpeningRule?.note) {
    parts.push(normalizeLeadSentence(firstOpeningRule.note));
  }

  if (editorialProfile?.editorialTakeaways?.[0]) {
    parts.push(editorialProfile.editorialTakeaways[0]);
  }

  return uniqueValues(parts).slice(0, 3).join(' ');
}

function buildSpecificRuleBullets({ municipality, openingHoursRules, alcoholServingRules }) {
  const bullets = [];

  for (const rule of alcoholServingRules) {
    const label = buildServingRuleBullet(rule);
    if (label) {
      bullets.push(`- ${label}`);
    }
  }

  for (const rule of openingHoursRules) {
    const label = buildOpeningRuleBullet(rule);
    if (label) {
      bullets.push(`- ${label}`);
    }
  }

  if (!bullets.length) {
    bullets.push(`- ${municipality} har for lite bekreftet regeldata til at siden bør stå åpen for publikum enda.`);
  }

  return uniqueValues(bullets).slice(0, 6);
}

function buildServingRuleBullet(rule) {
  const days = normalizeText(rule.days || 'alle dager');
  const groups = rule.groups?.length ? `gruppe ${rule.groups.join(', ')}` : 'skjenking';
  const area = rule.area && !['all', 'unspecified'].includes(rule.area) ? ` (${normalizeText(rule.area)})` : '';
  if (/konsum/i.test(rule.note || '')) {
    return normalizeRuleNote(rule.note);
  }
  if (rule.startTime && rule.endTime) {
    return `${capitalizeGroups(groups)}${area}: ${days} ${rule.startTime}-${rule.endTime}.`;
  }
  if (rule.endTime) {
    return `${capitalizeGroups(groups)}${area}: ${days} til ${rule.endTime}. ${normalizeRuleNote(rule.note)}`;
  }
  return normalizeRuleNote(rule.note);
}

function buildOpeningRuleBullet(rule) {
  const appliesTo = normalizeText(rule.appliesTo || '');
  const label = appliesTo === 'outdoor_area'
    ? 'Uteservering'
    : appliesTo === 'serving_place'
      ? 'Serveringssted'
      : 'Åpningstid';
  const days = normalizeText(rule.days || '');
  if (rule.startTime && rule.endTime) {
    return `${label}: ${days} ${rule.startTime}-${rule.endTime}. ${normalizeRuleNote(rule.note)}`;
  }
  if (rule.endTime) {
    return `${label}: ${days} til ${rule.endTime}. ${normalizeRuleNote(rule.note)}`;
  }
  return `${label}: ${normalizeRuleNote(rule.note)}`;
}

function normalizeLeadSentence(value) {
  const text = normalizeRuleNote(value);
  if (!text) return '';
  const sentence = text.endsWith('.') ? text : `${text}.`;
  return sentence.charAt(0).toUpperCase() + sentence.slice(1);
}

function normalizeRuleNote(value) {
  return normalizeText(value)
    .replace(/\bUtledet fra skjenketider:\s*/i, '')
    .replace(/\bkommunen\.$/i, 'kommunen.')
    .replace(/\bmaa\b/gi, 'må')
    .replace(/\bdoegnet\b/gi, 'døgnet')
    .replace(/\bomraader\b/gi, 'områder')
    .replace(/\bomraade\b/gi, 'område')
    .replace(/\bsaerskilt\b/gi, 'særskilt')
    .replace(/\bsoeke\b/gi, 'søke');
}

function capitalizeGroups(value) {
  const text = normalizeText(value);
  return text.charAt(0).toUpperCase() + text.slice(1);
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
      return `  - label: "${escapeDoubleQuotes(normalizeText(item.label))}"\n    url: "${escapeDoubleQuotes(item.url)}"${titleLine}`;
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
    .replace(/â€“/g, '-')
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
  if (/stedet for å finne tjenester og informasjon/iu.test(text)) return true;
  if (/postboks|telefon|e-post|epost|postmottak@/iu.test(text)) return true;
  if (/organisasjonsnummer|bankkontonummer|ehf|for leverandører|faktura til kommunen/iu.test(text)) return true;
  if (/innsyn i offentlig saksbehandling\. søk i offentlig journal/iu.test(text)) return true;
  if (/skriv til oss|send sikker digital post|meld feil|sifra/iu.test(text)) return true;
  return false;
}

function isBoilerplateParagraph(value) {
  const text = cleanText(value);
  if (!text) return true;
  if (/hold (ctrl|cmd)-?tasten/iu.test(text)) return true;
  if (/forstørre|forminske/iu.test(text)) return true;
  if (/cookie|personvern|tilgjengelighet/iu.test(text)) return true;
  if (/stedet for å finne tjenester og informasjon/iu.test(text)) return true;
  if (/postboks|telefon|e-post|epost|postmottak@/iu.test(text)) return true;
  if (/organisasjonsnummer|bankkontonummer|ehf|for leverandører|faktura til kommunen/iu.test(text)) return true;
  if (/skriv til oss|send sikker digital post|meld feil|sifra/iu.test(text)) return true;
  return text.length < 40;
}

function hasUsefulSummary(value) {
  const text = cleanText(value);
  return Boolean(text) && !isLowQualitySummary(text) && !isBoilerplateParagraph(text);
}

function hasPermitSignal(value) {
  return /(bevilling|skjenk|salg|servering|innsyn|journal|skjema|søknad|soke|søke|kontroll|gebyr|uteserver|arrangement|kunnskap|prøve|prove)/iu.test(
    cleanText(value),
  );
}

function sanitizeOfficialSourceSummary(label, summary) {
  const text = cleanText(summary);
  if (!text) return '';
  if (!hasUsefulSummary(text)) return '';
  if (!hasPermitSignal(`${label} ${text}`)) return '';
  return normalizeText(text);
}

function assessMunicipalityQuality({
  municipality,
  editorialProfile,
  alcoholPolicyPlanUrl,
  formsUrl,
  publicRecordsUrl,
  officialSources,
  serviceLinks,
  regulationsLinks,
  bylawLinks,
  openingHoursRules,
  alcoholServingRules,
}) {
  let score = 0;
  const reasons = [];
  const allLinks = [
    ...serviceLinks,
    ...regulationsLinks,
    ...bylawLinks,
    ...(alcoholPolicyPlanUrl ? [{ label: 'Alkoholpolitisk plan', url: alcoholPolicyPlanUrl }] : []),
    ...(formsUrl ? [{ label: 'Skjema og selvbetjening', url: formsUrl }] : []),
    ...(publicRecordsUrl ? [{ label: 'Innsyn og offentlig journal', url: publicRecordsUrl }] : []),
  ];
  const linkKinds = new Set(
    allLinks
      .map((link) => classifyMunicipalLinkKind(link.url, link.label))
      .filter((kind) => ['plan', 'application', 'rules', 'serviceHub', 'forms', 'publicRecords', 'sales', 'serving', 'servering', 'exam', 'fees', 'renewal', 'controls', 'outdoor', 'singleEvent'].includes(kind)),
  );
  const operationalRuleCount = [...openingHoursRules, ...alcoholServingRules].filter(
    (rule) => rule.endTime || rule.startTime || /\bkl\.|\d{1,2}[:.]\d{2}|midnatt|døgnet|30 minutter|ute/i.test(rule.note || ''),
  ).length;

  if (alcoholPolicyPlanUrl) score += 2;
  else reasons.push(`${municipality} mangler tydelig plan- eller skjenketidsside.`);

  if (operationalRuleCount >= 3) score += 3;
  else reasons.push(`${municipality} har for få tydelige lokale driftspunkter.`);

  if (openingHoursRules.length >= 1 || alcoholServingRules.length >= 2) score += 2;
  else reasons.push(`${municipality} har for få bekreftede lokale tidsregler.`);

  if (formsUrl) score += 1;
  else reasons.push(`${municipality} mangler tydelig søknads- eller skjemaside.`);

  if (publicRecordsUrl) score += 1;
  else reasons.push(`${municipality} mangler tydelig innsynsinngang.`);

  if (linkKinds.size >= 4) score += 2;
  else reasons.push(`${municipality} har for få tydelige kommunale kildetyper.`);

  if ((editorialProfile?.editorialTakeaways?.length || 0) >= 3) score += 1;
  else reasons.push(`${municipality} mangler nok kommune-spesifikke tolkninger.`);

  if ((editorialProfile?.practicalSteps?.length || 0) >= 4) score += 1;
  else reasons.push(`${municipality} mangler nok praktiske lokale neste steg.`);

  const publishable =
    curatedMunicipalityPublishSet.includes(municipality) &&
    Boolean(alcoholPolicyPlanUrl) &&
    operationalRuleCount >= 3 &&
    (openingHoursRules.length >= 1 || alcoholServingRules.length >= 2) &&
    Boolean(formsUrl) &&
    Boolean(publicRecordsUrl) &&
    linkKinds.size >= 3 &&
    (editorialProfile?.editorialTakeaways?.length || 0) >= 3 &&
    (editorialProfile?.practicalSteps?.length || 0) >= 4 &&
    score >= 10;

  return {
    score,
    publishable,
    reasons: publishable ? ['Kvalitetskrav oppfylt for publisering.'] : reasons,
  };
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
