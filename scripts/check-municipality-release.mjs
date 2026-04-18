#!/usr/bin/env node

import path from 'node:path';
import { readdir } from 'node:fs/promises';
import { failIfFindings } from './lib/repo-utils.mjs';
import { loadMunicipalityPages } from './lib/municipality-pages.mjs';
import { normalizeText } from './lib/municipality-evidence.mjs';

const repoRoot = process.cwd();
const promptRoot = path.join(repoRoot, 'docs', 'municipality-image-prompts');
const findings = [];
// Municipality pages share an intentional legal/content skeleton, so the release gate only
// rejects near-clones rather than high-overlap-but-source-distinct local pages.
const MAX_RELEASE_SIMILARITY = 0.985;

const entries = await loadMunicipalityPages(repoRoot);
const published = entries.filter((entry) => !entry.draft);
const heroPromptSlugs = await loadHeroPromptSlugs();

for (const entry of published) {
  const permitSourceCount = entry.officialSources.filter((source) =>
    hasPermitSignal(`${source.label} ${source.url}`),
  ).length;
  if (permitSourceCount < 2) {
    findings.push(`${entry.relativePath} needs at least 2 permit-relevant official source cards in the release set`);
  }

  const distinctiveTakeawayCount = entry.editorialTakeaways.filter(isDistinctiveLocalDifference).length;
  if (distinctiveTakeawayCount < 2) {
    findings.push(`${entry.relativePath} needs at least 2 municipality-specific local differences for release`);
  }

  if (heroPromptSlugs.has(entry.slug.toLowerCase()) && !entry.hasHero) {
    findings.push(`${entry.relativePath} is in the prompt-backed flagship set but is missing heroImage frontmatter`);
  }
}

for (let index = 0; index < published.length; index += 1) {
  for (let compareIndex = index + 1; compareIndex < published.length; compareIndex += 1) {
    const a = published[index];
    const b = published[compareIndex];
    const similarity = jaccardSimilarity(
      normalizeForSimilarity(`${a.frontmatter}\n${a.body}`),
      normalizeForSimilarity(`${b.frontmatter}\n${b.body}`),
    );
    if (similarity > MAX_RELEASE_SIMILARITY) {
      findings.push(
        `${a.relativePath} and ${b.relativePath} are too similar for the municipality release set (${similarity.toFixed(2)})`,
      );
    }
  }
}

failIfFindings(findings, 'Municipality release gate failed');
console.log('Municipality release gate passed');

async function loadHeroPromptSlugs() {
  const entries = await readdir(promptRoot, { withFileTypes: true });
  return new Set(
    entries
      .filter((entry) => entry.isFile() && entry.name.endsWith('.txt'))
      .map((entry) => entry.name.replace(/\.txt$/i, '').toLowerCase()),
  );
}

function hasPermitSignal(value) {
  return /(bevilling|skjenk|salg|servering|innsyn|journal|skjema|soknad|sok|soke|kontroll|gebyr|uteserver|arrangement|prove|kunnskap)/i.test(
    asciiFold(value),
  );
}

function isDistinctiveLocalDifference(value) {
  return /(uteserver|arrangement|enkeltanledning|kontroll|tilsyn|fornyelse|gebyr|brennevin|ol og vin|sen drift|nattdrift|innsyn|soknad|ulik|egen grense|egen side)/i.test(
    asciiFold(value),
  );
}

function normalizeForSimilarity(value) {
  const stopWords = new Set([
    'denne',
    'kommunen',
    'kommune',
    'videre',
    'guide',
    'kursing',
    'kurs',
    'siden',
    'bruk',
    'hovedsiden',
    'skjema',
    'innsyn',
    'servering',
    'skjenking',
    'lenker',
    'dette',
    'lokale',
    'salg',
  ]);

  return new Set(
    asciiFold(value)
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter((token) => token.length >= 5)
      .filter((token) => !stopWords.has(token)),
  );
}

function asciiFold(value) {
  return normalizeText(value)
    .toLowerCase()
    .replace(/æ/g, 'ae')
    .replace(/ø/g, 'o')
    .replace(/å/g, 'a');
}

function jaccardSimilarity(a, b) {
  const intersection = [...a].filter((token) => b.has(token)).length;
  const union = new Set([...a, ...b]).size;
  return union === 0 ? 0 : intersection / union;
}
