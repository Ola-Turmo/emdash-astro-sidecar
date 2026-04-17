#!/usr/bin/env node

import path from 'node:path';
import { walkFiles, readUtf8, failIfFindings } from './lib/repo-utils.mjs';
import { inspectMunicipalityUrl, isDerivedRuleNote, normalizeText } from './lib/municipality-evidence.mjs';
import { capture, extractBlock } from './lib/municipality-pages.mjs';

const repoRoot = process.cwd();
const municipalityRoot = path.join(repoRoot, 'apps', 'blog', 'src', 'content', 'municipalPages');
const findings = [];

const files = await walkFiles(municipalityRoot, (filePath) => filePath.endsWith('.mdx'));

for (const filePath of files) {
  const relative = path.relative(repoRoot, filePath);
  const source = await readUtf8(filePath);
  const normalizedSource = source.replace(/^\uFEFF/, '');
  const frontmatterMatch = normalizedSource.match(/^---\s*\r?\n([\s\S]*?)\r?\n---\s*\r?\n?([\s\S]*)$/);
  const frontmatter = frontmatterMatch?.[1] ?? '';

  const draft = capture(frontmatter, /^draft:\s*(true|false)$/m) === 'true';
  if (draft) continue;

  const openingNotes = extractRuleNotes(frontmatter, 'openingHoursRules');
  for (const note of openingNotes) {
    if (isDerivedRuleNote(note)) {
      findings.push(`${relative} contains an inferred opening-hours rule that should not be published as fact`);
    }
  }

  const urls = [
    { kind: 'plan', url: capture(frontmatter, /^alcoholPolicyPlanUrl:\s*"(.+)"$/m) },
    { kind: 'forms', url: capture(frontmatter, /^formsUrl:\s*"(.+)"$/m) },
    { kind: 'publicRecords', url: capture(frontmatter, /^publicRecordsUrl:\s*"(.+)"$/m) },
    ...extractLinkUrls(frontmatter, 'serviceLinks'),
    ...extractLinkUrls(frontmatter, 'regulationsLinks'),
    ...extractLinkUrls(frontmatter, 'bylawLinks'),
  ].filter((entry) => entry.url);

  for (const entry of urls) {
    const inspection = await inspectMunicipalityUrl(entry.url, entry.kind);
    if (!inspection.ok) {
      findings.push(`${relative} has an invalid ${entry.kind} link ${entry.url} (${inspection.reason})`);
    }
  }
}

failIfFindings(findings, 'Municipality evidence gate failed');
console.log('Municipality evidence gate passed');

function extractLinkUrls(frontmatter, fieldName) {
  const block = extractBlock(frontmatter, fieldName);
  if (!block) return [];
  return [...block.matchAll(/label:\s*"([^"]+)"[\s\S]*?url:\s*"([^"]+)"/g)].map((match) => ({
    kind: inferKind(normalizeText(match[1] || '')),
    url: match[2],
  }));
}

function extractRuleNotes(frontmatter, fieldName) {
  const block = extractBlock(frontmatter, fieldName);
  if (!block) return [];
  return [...block.matchAll(/note:\s*"([^"]+)"/g)].map((match) => normalizeText(match[1] || ''));
}

function inferKind(label) {
  const source = label.toLowerCase();
  if (/alkoholpolitisk|skjenketider|plan|lokale regler og tider/.test(source)) return 'plan';
  if (/skjema|selvbetjening/.test(source)) return 'forms';
  if (/innsyn|journal/.test(source)) return 'publicRecords';
  if (/kontroll|tilsyn/.test(source)) return 'controls';
  if (/prover|prøve|prove|kunnskapskrav/.test(source)) return 'exam';
  if (/enkeltanledning|arrangement/.test(source)) return 'singleEvent';
  if (/uteservering/.test(source)) return 'outdoor';
  if (/salgsbevilling/.test(source)) return 'sales';
  if (/skjenkebevilling/.test(source)) return 'serving';
  if (/serveringsbevilling/.test(source)) return 'servering';
  if (/regler|vilkar|vilkår/.test(source)) return 'rules';
  if (/salg, servering og skjenking/.test(source)) return 'serviceHub';
  if (/soke bevilling|søke bevilling|soknad|søknad/.test(source)) return 'application';
  return 'general';
}
