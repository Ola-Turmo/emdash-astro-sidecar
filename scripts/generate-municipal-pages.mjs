#!/usr/bin/env node

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const repoRoot = process.cwd();
const sourceRepo = path.join(path.dirname(repoRoot), 'kommune.no.apimcp.site');
const sourceCatalogPath = path.join(sourceRepo, 'kommune_catalog.enriched.json');
const outputDir = path.join(repoRoot, 'apps', 'blog', 'src', 'content', 'municipalPages');

const targetMunicipalities = ['Oslo', 'Bergen', 'Sandefjord', 'Alta'];

async function main() {
  const raw = await readFile(sourceCatalogPath, 'utf8');
  const catalog = JSON.parse(raw);

  await mkdir(outputDir, { recursive: true });

  for (const municipalityName of targetMunicipalities) {
    const row = catalog.find((entry) => entry['Kommunenavn'] === municipalityName);
    if (!row) continue;

    const slug = slugify(row['Kommunenavn']);
    const filePath = path.join(outputDir, `${slug}.mdx`);
    const content = buildMunicipalPage(row);
    await writeFile(filePath, content, 'utf8');
    console.log(`Wrote ${path.relative(repoRoot, filePath)}`);
  }
}

function buildMunicipalPage(row) {
  const municipality = normalizeText(row['Kommunenavn']);
  const county = normalizeText(row['Fylke']);
  const languageForm = normalizeText(row['Målform'] || row['MÃ¥lform'] || '');
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

  const openingHoursRules = (row.opening_hours_rules || []).slice(0, 3).map((rule) => ({
    appliesTo: normalizeText(rule.applies_to || ''),
    days: normalizeText(rule.days || ''),
    startTime: rule.start_time || '',
    endTime: rule.end_time || '',
    note: normalizeText(rule.note || ''),
  }));

  const alcoholServingRules = (row.alcohol_serving_hours_rules || []).slice(0, 3).map((rule) => ({
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
    `municipalityNumber: "${row['Nr']}"`,
    `municipality: "${escapeDoubleQuotes(municipality)}"`,
    `county: "${escapeDoubleQuotes(county)}"`,
    `languageForm: "${escapeDoubleQuotes(languageForm)}"`,
    `domain: "${escapeDoubleQuotes(normalizeText(row['Domene'] || ''))}"`,
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
    '## Hva du finner her',
    '',
    '- lenker til kommunens egne sider om salg, servering og skjenking',
    '- hvor du finner innsyn og skjema',
    '- kjente åpningstids- eller skjenkeregler fra det strukturerte datagrunnlaget',
    '',
    '## Hvordan bruke siden',
    '',
    `Start med kommunens egne sider hvis du trenger lokal praksis eller vil finne riktig skjema. Bruk deretter guideseksjonen og kursene på kurs.ing når du vil forstå kravene bedre før du går videre.`,
    '',
    publicRecordsPlatform
      ? `## Innsyn og dokumentasjon\n\nKommunen bruker ${publicRecordsPlatform} for innsyn eller journaltilgang. Det er nyttig hvis du trenger å forstå hvordan kommunen publiserer saker, postlister eller offentlig dokumentasjon.`
      : '',
  ].filter(Boolean);

  return `${frontmatter.join('\n')}\n\n${body.join('\n')}\n`;
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
  return String(value ?? '')
    .replace(/Ã¦/g, 'æ')
    .replace(/Ã†/g, 'Æ')
    .replace(/Ã¸/g, 'ø')
    .replace(/Ã˜/g, 'Ø')
    .replace(/Ã¥/g, 'å')
    .replace(/Ã…/g, 'Å')
    .replace(/â€“/g, '–')
    .replace(/â€”/g, '—')
    .replace(/â€œ/g, '“')
    .replace(/â€/g, '”')
    .replace(/Â/g, '')
    .replace(/\s+/g, ' ')
    .trim();
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
