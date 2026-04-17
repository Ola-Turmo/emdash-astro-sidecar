#!/usr/bin/env node

import path from 'node:path';
import { mkdir, writeFile } from 'node:fs/promises';
import { loadMunicipalityPages, extractBlock } from './lib/municipality-pages.mjs';

const repoRoot = process.cwd();
const outputRoot = path.join(repoRoot, 'output', 'municipality-quality', 'latest');

const entries = (await loadMunicipalityPages(repoRoot))
  .map((entry) => ({
    municipality: entry.municipality,
    title: entry.title,
    qualityScore: entry.qualityScore,
    publishable: entry.publishable,
    draft: entry.draft,
    reasons: extractReasons(entry.frontmatter, entry.draft, entry.publishable),
    relativePath: entry.relativePath,
  }))
  .sort((a, b) => {
    if (a.draft !== b.draft) return Number(a.draft) - Number(b.draft);
    if (b.qualityScore !== a.qualityScore) return b.qualityScore - a.qualityScore;
    return a.municipality.localeCompare(b.municipality, 'nb');
  });

const published = entries.filter((entry) => !entry.draft);
const drafted = entries.filter((entry) => entry.draft);

const summary = {
  generatedAt: new Date().toISOString(),
  totalMunicipalities: entries.length,
  publishedCount: published.length,
  draftedCount: drafted.length,
  published,
  drafted,
};

const markdown = [
  '# Municipality Quality Report',
  '',
  `Generated: ${summary.generatedAt}`,
  '',
  `Published: ${published.length}`,
  `Drafted: ${drafted.length}`,
  '',
  '## Published',
  '',
  ...(published.length
    ? published.map((entry) => `- ${entry.municipality} (${entry.qualityScore})`)
    : ['- None']),
  '',
  '## Drafted',
  '',
  ...(drafted.length
    ? drafted.map((entry) => `- ${entry.municipality} (${entry.qualityScore}): ${entry.reasons.join('; ') || 'No reason recorded'}`)
    : ['- None']),
  '',
].join('\n');

await mkdir(outputRoot, { recursive: true });
await writeFile(path.join(outputRoot, 'summary.json'), JSON.stringify(summary, null, 2));
await writeFile(path.join(outputRoot, 'SUMMARY.md'), markdown);

console.log(`Wrote ${path.relative(repoRoot, path.join(outputRoot, 'SUMMARY.md'))}`);
console.log(`Wrote ${path.relative(repoRoot, path.join(outputRoot, 'summary.json'))}`);

function extractReasons(frontmatter, draft, publishable) {
  const reasons = [...extractBlock(frontmatter, 'reasons').matchAll(/^\s*-\s*"(.+)"$/gm)]
    .map((match) => match[1].trim());
  if (draft && publishable) {
    return ['DRAFTED_OUTSIDE_CURATED_PUBLISH_SET'];
  }
  return reasons;
}
