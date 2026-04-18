#!/usr/bin/env node

import { access, mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { getMunicipalityEditorialProfile } from './lib/municipality-curation.mjs';
import { inspectMunicipalityUrl, isDerivedRuleNote } from './lib/municipality-evidence.mjs';
import {
  classifyMunicipalLink,
  classifyMunicipalLinkKind,
  discoverSupplementalMunicipalityLinks,
  isAlcoholRelevantUrl,
} from './lib/municipality-link-discovery.mjs';
import { enrichMunicipalityRules } from './lib/municipality-rule-enrichment.mjs';

const repoRoot = process.cwd();
const sourceRepo = path.join(path.dirname(repoRoot), 'kommune.no.apimcp.site');
const sourceCatalogPath = path.join(sourceRepo, 'kommune_catalog.enriched.json');
const outputDir = path.join(repoRoot, 'apps', 'blog', 'src', 'content', 'municipalPages');
const publicImageDir = path.join(repoRoot, 'apps', 'blog', 'public', 'images', 'kommune');

function parseArgs(argv) {
  const result = {
    scope: 'existing',
    municipalities: [],
    limit: null,
    offset: 0,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--scope' && argv[index + 1]) {
      result.scope = argv[index + 1];
      index += 1;
      continue;
    }
    if (arg.startsWith('--scope=')) {
      result.scope = arg.slice('--scope='.length);
      continue;
    }
    if (arg === '--municipality' && argv[index + 1]) {
      result.municipalities.push(argv[index + 1]);
      index += 1;
      continue;
    }
    if (arg.startsWith('--municipality=')) {
      result.municipalities.push(arg.slice('--municipality='.length));
      continue;
    }
    if (arg === '--limit' && argv[index + 1]) {
      result.limit = Number(argv[index + 1]);
      index += 1;
      continue;
    }
    if (arg.startsWith('--limit=')) {
      result.limit = Number(arg.slice('--limit='.length));
      continue;
    }
    if (arg === '--offset' && argv[index + 1]) {
      result.offset = Number(argv[index + 1]);
      index += 1;
      continue;
    }
    if (arg.startsWith('--offset=')) {
      result.offset = Number(arg.slice('--offset='.length));
      continue;
    }
  }

  return result;
}

async function resolveTargetMunicipalities(catalog, args) {
  if (args.municipalities.length) {
    return [...new Set(args.municipalities.map((value) => normalizeText(value)).filter(Boolean))];
  }

  const municipalities =
    args.scope === 'catalog'
      ? [...new Set(catalog.map((entry) => normalizeText(entry.Kommunenavn)).filter(Boolean))]
      : await loadExistingMunicipalities();

  municipalities.sort((a, b) => a.localeCompare(b, 'nb'));

  const offset = Number.isFinite(args.offset) && args.offset > 0 ? args.offset : 0;
  const limit = Number.isFinite(args.limit) && args.limit > 0 ? args.limit : null;
  return limit ? municipalities.slice(offset, offset + limit) : municipalities.slice(offset);
}

async function loadExistingMunicipalities() {
  const entries = await readdir(outputDir, { withFileTypes: true });
  const municipalities = [];

  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith('.mdx')) continue;
    const source = await readFile(path.join(outputDir, entry.name), 'utf8');
    const municipality = source.match(/^municipality:\s*"(.+)"$/m)?.[1];
    if (municipality) {
      municipalities.push(normalizeText(municipality));
    }
  }

  return municipalities;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const raw = await readFile(sourceCatalogPath, 'utf8');
  const catalog = JSON.parse(raw);
  const targetMunicipalities = await resolveTargetMunicipalities(catalog, args);

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

}

async function buildMunicipalPage(row, slug) {
  const normalizedRow = normalizeObjectKeys(row);
  const municipality = normalizeText(normalizedRow.Kommunenavn);
  const county = normalizeText(normalizedRow.Fylke);
  const adminCenter = normalizeText(normalizedRow['Adm. senter'] || '');
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
  const rawServiceLinks = (row.alcohol_restaurant_urls || [])
    .filter((url) => isAlcoholRelevantUrl(url))
    .slice(0, 6)
    .map((url) => ({
      label: classifyMunicipalLink(url),
      url,
    }));

  const rawRegulationsLinks = (row.forskrifter_urls || []).filter((url) => isAlcoholRelevantUrl(url)).slice(0, 3).map((url) => ({
    label: classifyMunicipalLink(url, 'Lokale regler'),
    url,
  }));

  const rawBylawLinks = (row.vedtekter_urls || []).filter((url) => isAlcoholRelevantUrl(url)).slice(0, 3).map((url) => ({
    label: classifyMunicipalLink(url, 'Lokale vilkår'),
    url,
  }));

  const sourceOpeningHoursRules = (row.opening_hours_rules || [])
    .slice(0, 4)
    .map((rule) => ({
      appliesTo: normalizeText(rule.applies_to || ''),
      days: normalizeText(rule.days || ''),
      startTime: rule.start_time || '',
      endTime: rule.end_time || '',
      note: normalizeText(rule.note || ''),
    }));

  const enrichedRules = enrichMunicipalityRules({
    alcoholServingRules: row.alcohol_serving_hours_rules || [],
    openingHoursRules: sourceOpeningHoursRules,
  });

  const alcoholServingRules = enrichedRules.alcoholServingRules.slice(0, 4).map((rule) => ({
    area: normalizeText(rule.area || ''),
    groups: Array.isArray(rule.groups) ? rule.groups : [],
    days: normalizeText(rule.days || ''),
    startTime: rule.startTime || '',
    endTime: rule.endTime || '',
    note: normalizeText(rule.note || ''),
  }));

  let serviceLinks = await filterValidMunicipalityLinks(rawServiceLinks);
  let regulationsLinks = await filterValidMunicipalityLinks(rawRegulationsLinks);
  let bylawLinks = await filterValidMunicipalityLinks(rawBylawLinks);
  let validatedFormsUrl = await validateOptionalMunicipalityUrl(formsUrl, 'forms');
  let validatedPublicRecordsUrl = await validateOptionalMunicipalityUrl(publicRecordsUrl, 'publicRecords');
  const validatedAlcoholPolicyPlanUrl = await validateOptionalMunicipalityUrl(alcoholPolicyPlanUrl, 'plan');
  const fallbackPlanUrl = [...rawServiceLinks, ...rawRegulationsLinks, ...rawBylawLinks]
    .map((link) => link.url)
    .find((url) => classifyMunicipalLinkKind(url, 'general') === 'plan') || '';
  let resolvedAlcoholPolicyPlanUrl =
    validatedAlcoholPolicyPlanUrl || await validateOptionalMunicipalityUrl(fallbackPlanUrl, 'plan');

  const discoveredLinks = await discoverValidatedMunicipalityLinks({
    siteUrl,
    seedUrls: uniqueSources([
      ...serviceLinks.map((link) => ({ url: link.url })),
      ...regulationsLinks.map((link) => ({ url: link.url })),
      ...bylawLinks.map((link) => ({ url: link.url })),
      { url: resolvedAlcoholPolicyPlanUrl },
      { url: validatedFormsUrl },
      { url: validatedPublicRecordsUrl },
      ...rawServiceLinks.slice(0, 2).map((link) => ({ url: link.url })),
    ]).map((entry) => entry.url),
  });

  serviceLinks = mergeLabeledLinks(serviceLinks, discoveredLinks.serviceLinks);
  regulationsLinks = mergeLabeledLinks(regulationsLinks, discoveredLinks.regulationsLinks);
  bylawLinks = mergeLabeledLinks(bylawLinks, discoveredLinks.bylawLinks);
  validatedFormsUrl = validatedFormsUrl || discoveredLinks.formsUrl;
  validatedPublicRecordsUrl = validatedPublicRecordsUrl || discoveredLinks.publicRecordsUrl;
  resolvedAlcoholPolicyPlanUrl = resolvedAlcoholPolicyPlanUrl || discoveredLinks.planUrl;
  const publishedOpeningHoursRules = uniqueRulesBySignature(sourceOpeningHoursRules
    .filter((rule) => !isDerivedRuleNote(rule.note))
    .map((rule) => ({
      ...rule,
      note: sanitizeRuleNoteForPublication(rule.note, resolvedAlcoholPolicyPlanUrl),
    }))
    .filter((rule) => rule.note || rule.startTime || rule.endTime));
  const publishedAlcoholServingRules = uniqueRulesBySignature(alcoholServingRules
    .map((rule) => ({
      ...rule,
      note: sanitizeRuleNoteForPublication(rule.note, resolvedAlcoholPolicyPlanUrl),
    }))
    .filter((rule) => rule.note || rule.startTime || rule.endTime));
  const evidenceProfile = deriveEvidenceProfile({
    municipality,
    adminCenter,
    evidence: row.evidence || {},
    publicRecordsPlatform,
    openingHoursRules: sourceOpeningHoursRules,
    alcoholServingRules: publishedAlcoholServingRules,
    alcoholPolicyPlanUrl: resolvedAlcoholPolicyPlanUrl,
  });
  const resolvedEditorialProfile = resolveEditorialProfile(editorialProfile, {
    municipality,
    publicRecordsPlatform,
    openingHoursRules: uniqueRulesBySignature([...publishedOpeningHoursRules, ...sourceOpeningHoursRules]),
    alcoholServingRules: publishedAlcoholServingRules,
    regulationsLinks,
    bylawLinks,
    formsUrl: validatedFormsUrl,
    publicRecordsUrl: validatedPublicRecordsUrl,
    alcoholPolicyPlanUrl: resolvedAlcoholPolicyPlanUrl,
    serviceLinks,
    evidenceProfile,
  });

  const title = buildPageTitle(municipality);
  const description = buildPageDescription({
    municipality,
    alcoholServingRules: publishedAlcoholServingRules,
    openingHoursRules: publishedOpeningHoursRules,
    editorialProfile: resolvedEditorialProfile,
  });

  const officialSourceCandidates = selectOfficialSourceCandidates({
    alcoholPolicyPlanUrl: resolvedAlcoholPolicyPlanUrl,
    serviceLinks,
    regulationsLinks,
    bylawLinks,
    formsUrl: validatedFormsUrl,
    publicRecordsUrl: validatedPublicRecordsUrl,
  });

  logMunicipalityDebug({
    municipality,
    rowServiceUrls: row.alcohol_restaurant_urls || [],
    rowServiceUrlChecks: (row.alcohol_restaurant_urls || []).map((url) => ({
      url,
      relevant: isAlcoholRelevantUrl(url),
    })),
    rawServiceLinks,
    serviceLinks,
    regulationsLinks,
    bylawLinks,
    formsUrl: validatedFormsUrl,
    publicRecordsUrl: validatedPublicRecordsUrl,
    alcoholPolicyPlanUrl: resolvedAlcoholPolicyPlanUrl,
    officialSourceCandidates,
  });

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
    formsUrl: validatedFormsUrl,
    alcoholPolicyPlanUrl: resolvedAlcoholPolicyPlanUrl,
    openingHoursRules: publishedOpeningHoursRules,
    alcoholServingRules: publishedAlcoholServingRules,
    officialSources,
    editorialProfile: resolvedEditorialProfile,
  });

  const municipalityQuality = assessMunicipalityQuality({
    municipality,
    editorialProfile: resolvedEditorialProfile,
    localChecklist,
    alcoholPolicyPlanUrl: resolvedAlcoholPolicyPlanUrl,
    formsUrl: validatedFormsUrl,
    publicRecordsUrl: validatedPublicRecordsUrl,
    officialSources,
    serviceLinks,
    regulationsLinks,
    bylawLinks,
    openingHoursRules: publishedOpeningHoursRules,
    alcoholServingRules: publishedAlcoholServingRules,
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

  const editorialTakeaways = resolvedEditorialProfile?.editorialTakeaways ?? [];
  const editorialLead = buildEditorialLead({
      municipality,
      openingHoursRules: publishedOpeningHoursRules,
      alcoholServingRules: publishedAlcoholServingRules,
      editorialProfile: resolvedEditorialProfile,
      formsUrl: validatedFormsUrl,
      publicRecordsUrl: validatedPublicRecordsUrl,
      serviceLinks,
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
    resolvedAlcoholPolicyPlanUrl ? `alcoholPolicyPlanUrl: "${escapeDoubleQuotes(resolvedAlcoholPolicyPlanUrl)}"` : null,
    validatedFormsUrl ? `formsUrl: "${escapeDoubleQuotes(validatedFormsUrl)}"` : null,
    validatedPublicRecordsUrl ? `publicRecordsUrl: "${escapeDoubleQuotes(validatedPublicRecordsUrl)}"` : null,
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
    buildRuleArray('openingHoursRules', publishedOpeningHoursRules),
    buildAlcoholRuleArray('alcoholServingRules', publishedAlcoholServingRules),
    'sourceRepo: "Ola-Turmo/kommune.no.apimcp.site"',
    sourceLastChecked ? `sourceLastChecked: "${escapeDoubleQuotes(sourceLastChecked)}"` : null,
    buildQualityBlock(municipalityQuality),
    `title: "${escapeDoubleQuotes(title)}"`,
    `description: "${escapeDoubleQuotes(description)}"`,
    'pubDate: 2026-04-12',
    `draft: ${municipalityQuality.publishable ? 'false' : 'true'}`,
    '---',
  ].filter(Boolean);

  const body = [
    editorialLead,
    '',
    ...buildSpecificRuleBullets({
      municipality,
      openingHoursRules: publishedOpeningHoursRules,
      alcoholServingRules: publishedAlcoholServingRules,
    }),
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

async function filterValidMunicipalityLinks(links) {
  const results = [];
  for (const link of links) {
    const kind = classifyMunicipalLinkKind(link.url, link.label);
    const inspection = await inspectMunicipalityUrl(link.url, kind);
    if (inspection.ok) {
      results.push(link);
    }
  }
  return results;
}

async function validateOptionalMunicipalityUrl(url, kind) {
  if (!url) return '';
  if (kind === 'forms' && isGenericFormsUrl(url)) {
    return '';
  }
  const inspection = await inspectMunicipalityUrl(url, kind);
  return inspection.ok ? url : '';
}

function resolveEditorialProfile(editorialProfile, context) {
  const manualProfile = editorialProfile
    ? {
        editorialTakeaways: (editorialProfile.editorialTakeaways || []).filter((item) => supportsEditorialStatement(item, context)),
        practicalSteps: (editorialProfile.practicalSteps || []).filter((item) => supportsEditorialStatement(item, context)),
      }
    : {
        editorialTakeaways: [],
        practicalSteps: [],
      };
  const derivedProfile = deriveEditorialProfile(context);
  return {
    editorialTakeaways: uniqueValues([
      ...manualProfile.editorialTakeaways,
      ...(context.evidenceProfile?.editorialTakeaways || []),
      ...derivedProfile.editorialTakeaways,
    ]).slice(0, 6),
    practicalSteps: uniqueValues([
      ...manualProfile.practicalSteps,
      ...(context.evidenceProfile?.practicalSteps || []),
      ...derivedProfile.practicalSteps,
    ]).slice(0, 8),
  };
}

function deriveEvidenceProfile({
  municipality,
  adminCenter,
  evidence,
  publicRecordsPlatform,
  openingHoursRules,
  alcoholServingRules,
  alcoholPolicyPlanUrl,
}) {
  const editorialTakeaways = [];
  const practicalSteps = [];
  const alcoholHoursNote = sanitizeEvidenceNote(evidence?.alcohol_hours?.note, alcoholPolicyPlanUrl);
  const recordsNote = sanitizeEvidenceNote(evidence?.innsyn_url?.note, alcoholPolicyPlanUrl);
  const formsNote = sanitizeEvidenceNote(evidence?.forms_url?.note, alcoholPolicyPlanUrl);
  const servingPlaceRule = openingHoursRules.find((rule) => normalizeText(rule.appliesTo || '') === 'serving_place');
  const primaryServingRule = alcoholServingRules.find((rule) => rule.endTime);

  if (adminCenter && normalizeText(adminCenter) !== normalizeText(municipality)) {
    editorialTakeaways.push(`${municipality} styres fra ${adminCenter}, så du bør kontrollere lokale sider og dokumentasjon direkte i kommunen før du låser drift eller søknadsløp.`);
  }

  if (/kontroll/iu.test(alcoholHoursNote)) {
    editorialTakeaways.push(`${municipality} kobler skjenkesporet tydelig til kontroll. Det betyr at du bør lese både vilkår og oppfølging før du planlegger rutiner eller internkontroll.`);
    practicalSteps.push('Les både skjenkesiden og kontrollsporet før du bestemmer rutiner for vakter, dokumentasjon eller internkontroll.');
  }

  if (/gebyr/iu.test(alcoholHoursNote)) {
    editorialTakeaways.push(`${municipality} viser også til gebyrinformasjon i bevillingssporet. Det gjør kostnader og lokale satser til noe du bør avklare tidlig.`);
    practicalSteps.push('Sjekk om kommunen legger gebyrinformasjon på samme spor som bevillingen før du sender inn noe eller budsjetterer oppstart.');
  }

  if (/rusmiddelpolit|ruspolit/iu.test(alcoholHoursNote)) {
    editorialTakeaways.push(`${municipality} knytter bevillingssporet til rusmiddelpolitiske føringer. Det gjør lokal praksis viktigere enn å kopiere et standardskjema fra andre kommuner.`);
  }

  if (/sru|prokom/iu.test(recordsNote)) {
    editorialTakeaways.push(`${municipality} bruker et SRU- eller Prokom-spor for innsyn. Det gjør det enklere å kontrollere tidligere saker uten å lete i flere ulike portaler.`);
  }

  if (/edialog|digitalt innsynskrav|personsensitivt/iu.test(recordsNote)) {
    editorialTakeaways.push(`${municipality} peker også på eDialog eller digitalt innsynskrav for sensitive henvendelser. Det er nyttig hvis søknaden krever personopplysninger eller vedlegg.`);
    practicalSteps.push('Velg eDialog eller tilsvarende sikker kanal hvis du må sende personsensitive opplysninger til kommunen.');
  }

  if (/aim|selvbetjening/iu.test(formsNote)) {
    editorialTakeaways.push(`${municipality} har en tydelig selvbetjeningsflate for skjema. Det gjør det lettere å se hvilke vedlegg eller felter kommunen faktisk forventer.`);
  }

  if (servingPlaceRule?.endTime && primaryServingRule?.endTime && servingPlaceRule.endTime !== primaryServingRule.endTime) {
    editorialTakeaways.push(`${municipality} skiller mellom skjenkeslutt og praktisk stengetid. Det betyr at vakter og avslutning må planlegges etter to klokkeslett, ikke bare ett.`);
    practicalSteps.push('Skill mellom skjenkeslutt og stengetid når du planlegger vakter, gjesteflyt og avslutning av serveringen.');
  }

  return {
    editorialTakeaways: uniqueValues(editorialTakeaways),
    practicalSteps: uniqueValues(practicalSteps),
  };
}

function sanitizeEvidenceNote(value, alcoholPolicyPlanUrl) {
  return sanitizeRuleNoteForPublication(normalizeText(value || ''), alcoholPolicyPlanUrl)
    .replace(/\bforms url found via http get check\. status 200\.?/iu, '')
    .replace(/\bskjemaside funnet\.?/iu, 'Skjemaside bekreftet.')
    .replace(/\s+/g, ' ')
    .trim();
}

function deriveEditorialProfile({
  municipality,
  publicRecordsPlatform,
  openingHoursRules,
  alcoholServingRules,
  serviceLinks,
  regulationsLinks,
  bylawLinks,
  formsUrl,
  publicRecordsUrl,
  alcoholPolicyPlanUrl,
}) {
  const editorialTakeaways = [];
  const practicalSteps = [];
  const allLinks = [...serviceLinks, ...regulationsLinks, ...bylawLinks];
  const applicationLink = allLinks.find((link) => classifyMunicipalLinkKind(link.url, link.label) === 'application');
  const controlsLink = allLinks.find((link) => ['controls', 'rules'].includes(classifyMunicipalLinkKind(link.url, link.label)));
  const singleEventLink = allLinks.find((link) => classifyMunicipalLinkKind(link.url, link.label) === 'singleEvent');
  const examLink = allLinks.find((link) => classifyMunicipalLinkKind(link.url, link.label) === 'exam');
  const salesLink = allLinks.find((link) => classifyMunicipalLinkKind(link.url, link.label) === 'sales');
  const servingLicenseLink = allLinks.find((link) => classifyMunicipalLinkKind(link.url, link.label) === 'serving');
  const serveringLicenseLink = allLinks.find((link) => classifyMunicipalLinkKind(link.url, link.label) === 'servering');
  const outdoorRule = openingHoursRules.find((rule) => normalizeText(rule.appliesTo || '') === 'outdoor_area');
  const outdoorServingRule = alcoholServingRules.find((rule) => normalizeText(rule.area || '') === 'outdoor' && rule.endTime);
  const servingPlaceRule = openingHoursRules.find((rule) => normalizeText(rule.appliesTo || '') === 'serving_place');
  const generalServingRule = alcoholServingRules.find((rule) =>
    hasConfirmedTimeCoverage({
      openingHoursRules: [],
      alcoholServingRules: [rule],
    }),
  );
  const wineBeerRule = alcoholServingRules.find(
    (rule) => Array.isArray(rule.groups) && rule.groups.includes('1') && rule.groups.includes('2') && rule.endTime,
  );
  const spiritRule = alcoholServingRules.find(
    (rule) => Array.isArray(rule.groups) && rule.groups.includes('3') && rule.endTime,
  );
  const hasLateDrift =
    alcoholServingRules.some((rule) => isLateNightCutoff(rule.endTime)) ||
    openingHoursRules.some((rule) => isLateNightCutoff(rule.endTime));
  const hasRenewalSignal = [...openingHoursRules, ...alcoholServingRules].some((rule) =>
    /\bfornyelse|fornye|automatisk fornyelse/iu.test(rule.note || ''),
  );
  const hasRevisionSignal = [...openingHoursRules, ...alcoholServingRules].some((rule) =>
    /\brevisjon|under utarbeidelse|under revisjon/iu.test(rule.note || ''),
  );

  if (hasLateDrift) {
    editorialTakeaways.push(`${municipality} åpner for sen drift sammenlignet med mange andre kommuner. Det gjør åpningstid, bemanning og intern kontroll mer operativt viktig.`);
  }

  if (wineBeerRule && spiritRule && wineBeerRule.endTime !== spiritRule.endTime) {
    editorialTakeaways.push(`${municipality} skiller mellom øl og vin og brennevin, så nattdrift og intern opplæring må planlegges ut fra to forskjellige grenser.`);
  } else if (generalServingRule?.endTime) {
    editorialTakeaways.push(`${municipality} oppgir ett samlet skjenkevindu for de viktigste alkoholgruppene, noe som gjør det lettere å lese hovedregelen før du går videre til detaljene.`);
  }

  if (outdoorRule?.endTime && (!servingPlaceRule?.endTime || outdoorRule.endTime !== servingPlaceRule.endTime)) {
    editorialTakeaways.push(`Uteservering følger en egen grense i ${municipality}, så ute- og innedrift bør ikke planlegges som om de er samme spor.`);
  } else if (outdoorServingRule?.endTime) {
    editorialTakeaways.push(`Uteservering har en egen praktisk grense i ${municipality}, så utearealet bør planlegges separat fra resten av driften.`);
  }

  if (applicationLink && controlsLink) {
    editorialTakeaways.push(`Kommunen skiller tydelig mellom søknadssporet og siden for lokale regler eller kontroll. Det gjør det enklere å åpne riktig side først.`);
  } else if (applicationLink || formsUrl) {
    editorialTakeaways.push(`Kommunen har et tydelig spor for søknad eller skjema. Det reduserer risikoen for å starte på feil side når driften skal opp eller endres.`);
  }

  const distinctPermitTrackCount = [salesLink, servingLicenseLink, serveringLicenseLink].filter(Boolean).length;

  if (distinctPermitTrackCount >= 3) {
    editorialTakeaways.push(`${municipality} deler ulike bevillingstyper for salg, servering og skjenking i egne sider. Det gjør det enklere å velge riktig bevillingsspor før du sender inn noe.`);
  } else if (distinctPermitTrackCount >= 2) {
    editorialTakeaways.push(`${municipality} skiller tydelig mellom ulike bevillingstyper på egne sider. Det gjør det lettere å åpne riktig løp for akkurat din drift.`);
  }

  if (singleEventLink) {
    editorialTakeaways.push(`${municipality} har også et eget spor for arrangementer eller enkeltanledninger. Det er nyttig hvis du ikke driver helårsservering.`);
  }

  if (examLink) {
    editorialTakeaways.push(`Kommunen har egne sider for etablererprøve eller kunnskapsprøve. Det er nyttig hvis styrer eller stedfortreder fortsatt mangler formell dokumentasjon.`);
  }

  if (alcoholPolicyPlanUrl) {
    editorialTakeaways.push(`Kommunen har en bekreftet alkoholpolitisk plan eller retningslinje. Det gir et tydelig sted å kontrollere lokale føringer før du låser drift eller søknadsstrategi.`);
  }

  if (publicRecordsUrl && publicRecordsPlatform) {
    editorialTakeaways.push(`${publicRecordsPlatform} gjør det mulig å kontrollere tidligere saker og vedtak før du sender inn noe selv.`);
  } else if (publicRecordsUrl) {
    editorialTakeaways.push(`${municipality} gjør innsyn eller offentlig journal tilgjengelig digitalt. Det gjør det enklere å kontrollere tidligere praksis før du sender inn noe.`);
  }

  if (hasRenewalSignal) {
    editorialTakeaways.push(`${municipality} omtaler fornyelse eller videreføring av bevilling i de lokale notatene. Det er et signal om å kontrollere hvordan faste bevillinger følges opp lokalt.`);
  }

  if (hasRevisionSignal) {
    editorialTakeaways.push(`${municipality} viser til regler eller retningslinjer som er under revisjon. Det gjør det ekstra viktig å kontrollere siste versjon før du låser drift eller åpningstider.`);
  }

  if ((openingHoursRules.length > 0 || alcoholServingRules.length > 0) && !hasLateDrift) {
    editorialTakeaways.push(`${municipality} publiserer konkrete lokale tids- eller driftsnotater på egne sider. Det gjør det lettere å planlegge drift ut fra lokale rammer i stedet for generelle antakelser.`);
  }

  if (formsUrl && publicRecordsUrl) {
    editorialTakeaways.push(`${municipality} gjør både søknad og innsyn tilgjengelig digitalt. Det gjør det lettere å forberede dokumentasjon og kontrollere hvordan kommunen følger opp saker.`);
  }

  if ((alcoholPolicyPlanUrl || regulationsLinks.length > 0 || bylawLinks.length > 0) && !hasRevisionSignal) {
    editorialTakeaways.push(`${municipality} samler lokale regler eller retningslinjer i egne sider. Det gir et tydelig sted å kontrollere lokale krav før du bestemmer driftsopplegg.`);
  }

  if (applicationLink) {
    practicalSteps.push('Åpne siden for søknad eller endringer tidlig hvis du skal etablere, overta eller justere drift.');
  } else if (formsUrl) {
    practicalSteps.push('Åpne skjema- eller selvbetjeningssiden tidlig, slik at du ser hvilke opplysninger kommunen faktisk ber om.');
  }

  if (alcoholPolicyPlanUrl || controlsLink || openingHoursRules.length > 0 || alcoholServingRules.length > 0) {
    practicalSteps.push('Kontroller tider og lokale vilkår på kommunens egne sider før du låser åpningstid, konsept eller bemanning.');
  }

  if (outdoorRule) {
    practicalSteps.push('Hvis utearealet er viktig for konseptet, kontroller uteservering separat før du planlegger samme driftstid ute og inne.');
  }

  if (singleEventLink) {
    practicalSteps.push('Bruk arrangementssporet direkte hvis behovet gjelder enkeltanledning eller tidsavgrenset arrangement, ikke ordinær drift.');
  }

  if (distinctPermitTrackCount >= 2) {
    practicalSteps.push('Åpne riktig underspor for salg, servering eller skjenking i stedet for å anta at samme prosess gjelder for alle bevillingstyper.');
  }

  if (publicRecordsUrl && publicRecordsPlatform) {
    practicalSteps.push(`Bruk ${publicRecordsPlatform} hvis du vil se tidligere saker, vedtak eller hvordan kommunen faktisk følger opp bevillinger.`);
  }

  if (controlsLink) {
    practicalSteps.push('Åpne siden for regler eller kontroll hvis du vil bygge rutiner som passer med kommunens oppfølging etter at bevilling er gitt.');
  }

  if (hasRevisionSignal) {
    practicalSteps.push('Kontroller at du leser siste publiserte versjon hvis kommunen opplyser at retningslinjer eller forskrift er under revisjon.');
  }

  return {
    editorialTakeaways: editorialTakeaways.filter((item) => supportsEditorialStatement(item, {
      municipality,
      publicRecordsPlatform,
      openingHoursRules,
      alcoholServingRules,
      serviceLinks,
      regulationsLinks,
      bylawLinks,
      formsUrl,
      publicRecordsUrl,
      alcoholPolicyPlanUrl,
    })),
    practicalSteps: practicalSteps.filter((item) => supportsEditorialStatement(item, {
      municipality,
      publicRecordsPlatform,
      openingHoursRules,
      alcoholServingRules,
      serviceLinks,
      regulationsLinks,
      bylawLinks,
      formsUrl,
      publicRecordsUrl,
      alcoholPolicyPlanUrl,
    })),
  };
}

function supportsEditorialStatement(value, { openingHoursRules, formsUrl, publicRecordsUrl, alcoholPolicyPlanUrl, serviceLinks }) {
  const text = normalizeText(value).toLowerCase();
  const hasOpeningSupport = openingHoursRules.length > 0;
  const hasApplicationSupport = Boolean(formsUrl) || serviceLinks.some((link) => classifyMunicipalLinkKind(link.url, link.label) === 'application');
  const hasPlanSupport = Boolean(alcoholPolicyPlanUrl);
  const hasRulesSupport = serviceLinks.some((link) => ['serviceHub', 'rules', 'controls'].includes(classifyMunicipalLinkKind(link.url, link.label)));
  const hasRecordsSupport = Boolean(publicRecordsUrl);

  if (!hasOpeningSupport && /holde åpent|åpningstid for serveringssted|praktisk stengetid|serveringsstedet kan holde åpent|serveringssteder kan holde åpent/.test(text)) {
    return false;
  }
  if (!hasRecordsSupport && /innsyn|postliste|einnsyn|offentlig innsyn/.test(text)) {
    return false;
  }
  if (!hasApplicationSupport && /søknad|søke|skjema|endre bevillinger|endre drift/.test(text)) {
    return false;
  }
  if (!hasPlanSupport && /alkoholpolitisk|handlingsplan|retningslinje/.test(text)) {
    return false;
  }
  if (!(hasPlanSupport || hasRulesSupport || hasOpeningSupport) && /skjenkesiden|skjenketider/.test(text)) {
    return false;
  }

  return true;
}

function hasConfirmedTimeCoverage({ openingHoursRules, alcoholServingRules }) {
  if (openingHoursRules.length >= 1) {
    return true;
  }

  return alcoholServingRules.some((rule) => {
    const groups = Array.isArray(rule.groups) ? rule.groups : [];
    const note = normalizeText(rule.note || '');
    return (
      Boolean(rule.startTime || rule.endTime) ||
      /\bkl\.?\s*\d|\d{1,2}[:.]\d{2}|midnatt|30 minutter|halv time|skjenkeslutt|opphøre|opphore|stengetid/iu.test(note) ||
      (groups.includes('1') && groups.includes('2') && groups.includes('3') && Boolean(note))
    );
  });
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

function selectOfficialSourceCandidates({
  alcoholPolicyPlanUrl,
  serviceLinks,
  regulationsLinks,
  bylawLinks,
  formsUrl,
  publicRecordsUrl,
}) {
  const prioritizedServiceLinks = [...serviceLinks, ...regulationsLinks, ...bylawLinks]
    .map((link) => ({
      ...link,
      kind: classifyMunicipalLinkKind(link.url, link.label),
    }))
    .sort((a, b) => priorityForKind(a.kind) - priorityForKind(b.kind));

  return uniqueSources([
    { label: 'Skjenketider eller alkoholpolitisk plan', url: alcoholPolicyPlanUrl },
    { label: 'Skjema og selvbetjening', url: formsUrl },
    { label: 'Innsyn', url: publicRecordsUrl },
    ...prioritizedServiceLinks.map((link) => ({ label: link.label, url: link.url })),
  ]).slice(0, 6);
}

function priorityForKind(kind) {
  const priorityOrder = [
    'plan',
    'serviceHub',
    'application',
    'rules',
    'serving',
    'sales',
    'servering',
    'controls',
    'exam',
    'singleEvent',
    'outdoor',
    'fees',
    'renewal',
  ];
  const index = priorityOrder.indexOf(kind);
  return index === -1 ? 999 : index;
}

function logMunicipalityDebug(payload) {
  if (process.env.DEBUG_MUNICIPALITY !== payload.municipality) {
    return;
  }

  console.log(
    JSON.stringify(
      {
        municipality: payload.municipality,
        rowServiceUrls: payload.rowServiceUrls,
        rowServiceUrlChecks: payload.rowServiceUrlChecks,
        rawServiceLinks: payload.rawServiceLinks,
        serviceLinks: payload.serviceLinks,
        regulationsLinks: payload.regulationsLinks,
        bylawLinks: payload.bylawLinks,
        formsUrl: payload.formsUrl,
        publicRecordsUrl: payload.publicRecordsUrl,
        alcoholPolicyPlanUrl: payload.alcoholPolicyPlanUrl,
        officialSourceCandidates: payload.officialSourceCandidates,
      },
      null,
      2,
    ),
  );
}

function uniqueValues(values) {
  return [...new Set(values.map((value) => normalizeText(value)).filter(Boolean))];
}

function uniqueRulesBySignature(rules) {
  const seen = new Set();
  const results = [];

  for (const rule of rules) {
    const signature = JSON.stringify({
      appliesTo: normalizeText(rule.appliesTo || ''),
      area: normalizeText(rule.area || ''),
      groups: Array.isArray(rule.groups) ? [...rule.groups].sort() : [],
      days: normalizeText(rule.days || ''),
      startTime: rule.startTime || '',
      endTime: rule.endTime || '',
      note: normalizeText(rule.note || ''),
    });
    if (seen.has(signature)) continue;
    seen.add(signature);
    results.push(rule);
  }

  return results;
}

function isGenericFormsUrl(url) {
  try {
    const pathname = decodeURIComponent(new URL(url).pathname.toLowerCase()).replace(/\/+$/, '');
    return pathname === '/selvbetjening' || pathname === '/for-ansatte' || pathname === '/selvbetjening/for-ansatte';
  } catch {
    return false;
  }
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

  if (formsUrl) {
    checklist.push('Åpne skjema- eller selvbetjeningssiden tidlig, slik at du ser hvilke opplysninger kommunen faktisk ber om.');
  }

  if (publicRecordsPlatform) {
    checklist.push(`Bruk ${publicRecordsPlatform} hvis du vil se hvordan kommunen publiserer saker, dokumenter eller tidligere behandling.`);
  }

  if (alcoholPolicyPlanUrl) {
    checklist.push('Sjekk den bekreftede planen eller regelsiden før du legger opp drift, åpningstider eller konsept.');
  }

  if (alcoholServingRules.length > 0 || openingHoursRules.length > 0) {
    checklist.push('Sammenlign tidene oppsummert her med kommunens egne sider før du sender søknad eller planlegger åpningstid.');
  }

  if (officialSources.length > 0) {
    checklist.push('Les oppsummeringene fra de offisielle kildene under og åpne originalsidene når du trenger detaljene.');
  }

  return uniqueValues(checklist).slice(0, 6);
}

function buildEditorialLead({
  municipality,
  openingHoursRules,
  alcoholServingRules,
  editorialProfile,
  formsUrl,
  publicRecordsUrl,
  serviceLinks,
}) {
  const parts = [];
  if (editorialProfile?.editorialTakeaways?.[0]) {
    parts.push(normalizeLeadSentence(editorialProfile.editorialTakeaways[0]));
  } else {
    const servingSummary = summarizePrimaryServingWindow(alcoholServingRules, municipality);
    if (servingSummary) parts.push(servingSummary);
  }

  const controlsLink = serviceLinks.find((link) => classifyMunicipalLinkKind(link.url, link.label) === 'controls')
    || serviceLinks.find((link) => classifyMunicipalLinkKind(link.url, link.label) === 'rules');
  const applicationLink = serviceLinks.find((link) => classifyMunicipalLinkKind(link.url, link.label) === 'application');
  const singleEventLink = serviceLinks.find((link) => classifyMunicipalLinkKind(link.url, link.label) === 'singleEvent');

  if (applicationLink && controlsLink) {
    parts.push('Her finner du både søknadssporet og siden som forklarer lokale regler eller kontroll før du åpner.');
  } else if (applicationLink && publicRecordsUrl) {
    parts.push('Her finner du både søknadssporet og innsyn hvis du skal åpne, overta eller endre driften.');
  } else if (applicationLink) {
    parts.push('Her finner du siden for søknad og endringer hvis du skal åpne, overta eller justere driften.');
  } else if (singleEventLink) {
    parts.push('Kommunen skiller også mellom fast drift og arrangementer, så du kan åpne riktig spor med en gang.');
  } else if (formsUrl) {
    parts.push('Her finner du skjemaene og de viktigste kommunesidene før du planlegger drift eller sender noe inn.');
  } else if (publicRecordsUrl) {
    parts.push('Her finner du lokale tider og innsynsspor hvis du vil kontrollere praksis før du søker.');
  }

  const firstOpeningRule = openingHoursRules.find((rule) => rule.endTime || rule.note);
  if (!editorialProfile?.editorialTakeaways?.length && firstOpeningRule?.note) {
    parts.push(normalizeLeadSentence(firstOpeningRule.note));
  }

  return uniqueValues(parts).slice(0, 3).join(' ');
}

function buildPageTitle(municipality) {
  return `${municipality}: skjenketider, bevilling og lokale regler`;
}

function buildPageDescription({
  municipality,
  alcoholServingRules,
  openingHoursRules,
  editorialProfile,
}) {
  const parts = [];
  if (editorialProfile?.editorialTakeaways?.[0]) {
    parts.push(trimSentence(editorialProfile.editorialTakeaways[0]));
  } else {
    parts.push(`Skjenketider, søknad, innsyn og lokale regler for serveringssteder i ${municipality}.`);
  }

  const lateServing = alcoholServingRules.find((rule) => isLateNightCutoff(rule.endTime));
  const spiritRule = alcoholServingRules.find((rule) => Array.isArray(rule.groups) && rule.groups.includes('3') && rule.endTime);
  const wineBeerRule = alcoholServingRules.find((rule) => Array.isArray(rule.groups) && rule.groups.includes('1') && rule.groups.includes('2') && rule.endTime);
  const outdoorRule = openingHoursRules.find((rule) => normalizeText(rule.appliesTo || '') === 'outdoor_area');

  if (lateServing) {
    parts.push('Nyttig hvis du skal planlegge nattdrift, bemanning eller endring av bevilling.');
  } else if (wineBeerRule && spiritRule && wineBeerRule.endTime !== spiritRule.endTime) {
    parts.push('Viser også forskjellen mellom øl og vin og brennevin der kommunen oppgir ulike grenser.');
  } else if (outdoorRule) {
    parts.push('Tar høyde for at inne- og uteservering kan følge ulike lokale grenser.');
  } else {
    parts.push('Samler søknad, innsyn og lokale regler i én side med lenker tilbake til originalkildene.');
  }

  return uniqueValues(parts).slice(0, 2).join(' ');
}

function summarizePrimaryServingWindow(alcoholServingRules, municipality) {
  const wineBeerRule = alcoholServingRules.find((rule) => Array.isArray(rule.groups) && rule.groups.includes('1') && rule.groups.includes('2') && rule.startTime && rule.endTime);
  const spiritRule = alcoholServingRules.find((rule) => Array.isArray(rule.groups) && rule.groups.includes('3') && rule.startTime && rule.endTime);
  if (wineBeerRule && spiritRule && wineBeerRule.endTime !== spiritRule.endTime) {
    return `${municipality} skiller mellom øl og vin og brennevin, så du må planlegge nattdrift og intern opplæring ut fra to forskjellige grenser.`;
  }
  if (wineBeerRule) {
    return `${municipality} oppgir skjenking for øl og vin ${normalizeText(wineBeerRule.days || 'alle dager')} ${wineBeerRule.startTime}-${wineBeerRule.endTime}.`;
  }
  return '';
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

function trimSentence(value) {
  const text = normalizeText(value);
  if (!text) return '';
  return text.endsWith('.') ? text : `${text}.`;
}

function toTimeMinutes(value) {
  const normalized = normalizeText(value || '').replace('.', ':');
  const match = normalized.match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return -1;
  return Number(match[1]) * 60 + Number(match[2]);
}

function isLateNightCutoff(value) {
  const normalized = normalizeText(value || '').replace('.', ':');
  const match = normalized.match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return false;
  const hour = Number(match[1]);
  return hour >= 0 && hour <= 6;
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

function sanitizeRuleNoteForPublication(value, alcoholPolicyPlanUrl) {
  const normalized = normalizeRuleNote(value);
  if (alcoholPolicyPlanUrl) {
    return normalized;
  }

  return normalized
    .replace(/(^|[\s.])[^.]*alkoholpolitiske?[^.]*\.\s*/iu, '$1')
    .replace(/(^|[\s.])[^.]*ruspolitiske?[^.]*\.\s*/iu, '$1')
    .replace(/(^|[\s.])[^.]*rusmiddelpolitiske?[^.]*\.\s*/iu, '$1')
    .replace(/(^|[\s.])alkoholpolitiske? retningslinjer[^.]*\.\s*/iu, '$1')
    .replace(/(^|[\s.])alkoholpolitisk handlingsplan[^.]*\.\s*/iu, '$1')
    .replace(/(^|[\s.])handlingsplan(?:en)?(?:\s+\d{4}\s*[-–]\s*\d{4})?[^.]*\.\s*/iu, '$1')
    .replace(/(^|[\s.])bevillingspolitiske? retningslinjer[^.]*\.\s*/iu, '$1')
    .replace(/(^|[\s.])ruspolitisk handlingsplan[^.]*\.\s*/iu, '$1')
    .replace(/(^|[\s.])ruspolitisk plan[^.]*\.\s*/iu, '$1')
    .replace(/(^|[\s.])rusmiddelpolitisk handlingsplan[^.]*\.\s*/iu, '$1')
    .replace(/(^|[\s.])rusmiddelpolitisk plan[^.]*\.\s*/iu, '$1')
    .replace(/\s+/g, ' ')
    .trim();
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

function buildQualityBlock(municipalityQuality) {
  const reasons = municipalityQuality.reasons || [];
  const reasonsBlock = reasons.length
    ? `\n  reasons:\n${reasons.map((reason) => `    - "${escapeDoubleQuotes(reason)}"`).join('\n')}`
    : '\n  reasons: []';
  return `municipalityQuality:\n  score: ${municipalityQuality.score}\n  publishable: ${municipalityQuality.publishable ? 'true' : 'false'}${reasonsBlock}`;
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
  localChecklist,
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
  const operationalLinkKindCount = [...linkKinds].filter((kind) =>
    ['plan', 'application', 'forms', 'controls', 'singleEvent', 'outdoor', 'fees', 'renewal', 'exam', 'sales', 'serving', 'servering'].includes(kind),
  ).length;
  const operationalRuleCount = [...openingHoursRules, ...alcoholServingRules].filter(
    (rule) => rule.endTime || rule.startTime || /\bkl\.|\d{1,2}[:.]\d{2}|midnatt|døgnet|30 minutter|ute/i.test(rule.note || ''),
  ).length;
  const operationalSignalCount = operationalRuleCount + Math.min(operationalLinkKindCount, 2);
  const hasConfirmedRuleCoverage = hasConfirmedTimeCoverage({
    openingHoursRules,
    alcoholServingRules,
  });
  const verifiedOfficialSourceCount = officialSources.filter((entry) => entry.url).length;
  const verifiedActionLinkCount = [...serviceLinks, ...regulationsLinks, ...bylawLinks].length;

  if (alcoholPolicyPlanUrl || verifiedOfficialSourceCount >= 3) score += 2;
  else reasons.push(`${municipality} mangler nok bekreftede offisielle kilder.`);

  if (operationalSignalCount >= 3) score += 3;
  else reasons.push(`${municipality} har for få tydelige lokale driftspunkter.`);

  if (hasConfirmedRuleCoverage) score += 2;
  else reasons.push(`${municipality} har for få bekreftede lokale tidsregler.`);

  if (formsUrl || linkKinds.has('application')) score += 1;
  else reasons.push(`${municipality} mangler tydelig søknads- eller skjemaside.`);

  if (publicRecordsUrl) score += 1;

  if (linkKinds.size >= 3 || verifiedActionLinkCount >= 3) score += 2;
  else reasons.push(`${municipality} har for få tydelige kommunale kildetyper.`);

  if ((editorialProfile?.editorialTakeaways?.length || 0) >= 3) score += 1;
  else reasons.push(`${municipality} mangler nok kommune-spesifikke tolkninger.`);

  if ((localChecklist?.length || 0) >= 4) score += 1;
  else reasons.push(`${municipality} mangler nok praktiske lokale neste steg.`);

  const publishable =
    verifiedOfficialSourceCount >= 2 &&
    operationalSignalCount >= 3 &&
    hasConfirmedRuleCoverage &&
    (Boolean(formsUrl) || linkKinds.has('application')) &&
    (linkKinds.size >= 3 || verifiedActionLinkCount >= 3) &&
    (editorialProfile?.editorialTakeaways?.length || 0) >= 3 &&
    (localChecklist?.length || 0) >= 4 &&
    score >= 8;

  return {
    score,
    publishable,
    reasons: publishable ? ['Kvalitetskrav oppfylt for publisering.'] : reasons,
  };
}

async function discoverValidatedMunicipalityLinks({ seedUrls, siteUrl }) {
  const discovered = await discoverSupplementalMunicipalityLinks({
    seedUrls,
    siteUrl,
    maxCandidates: 18,
  });

  const results = {
    serviceLinks: [],
    regulationsLinks: [],
    bylawLinks: [],
    formsUrl: '',
    publicRecordsUrl: '',
    planUrl: '',
  };

  for (const link of discovered) {
    const kind = classifyMunicipalLinkKind(link.url, link.label);
    const inspection = await inspectMunicipalityUrl(link.url, kind);
    if (!inspection.ok) continue;

    if (kind === 'forms' && !results.formsUrl) {
      results.formsUrl = link.url;
      continue;
    }
    if (kind === 'publicRecords' && !results.publicRecordsUrl) {
      results.publicRecordsUrl = link.url;
      continue;
    }
    if (kind === 'plan' && !results.planUrl) {
      results.planUrl = link.url;
    }

    const normalizedLink = {
      label: classifyMunicipalLink(link.url, link.label),
      url: link.url,
    };

    if (kind === 'plan' || kind === 'rules' || kind === 'controls') {
      results.regulationsLinks.push(normalizedLink);
      continue;
    }
    if (kind === 'publicRecords' || kind === 'forms') {
      continue;
    }
    results.serviceLinks.push(normalizedLink);
  }

  return {
    serviceLinks: results.serviceLinks.slice(0, 6),
    regulationsLinks: results.regulationsLinks.slice(0, 4),
    bylawLinks: results.bylawLinks.slice(0, 2),
    formsUrl: results.formsUrl,
    publicRecordsUrl: results.publicRecordsUrl,
    planUrl: results.planUrl,
  };
}

function mergeLabeledLinks(primaryLinks, supplementalLinks) {
  const merged = uniqueSources([
    ...primaryLinks.map((link) => ({ ...link })),
    ...supplementalLinks.map((link) => ({ ...link })),
  ]);
  return merged.slice(0, 6).map((link) => ({
    label: classifyMunicipalLink(link.url, link.label),
    url: link.url,
  }));
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
