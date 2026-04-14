#!/usr/bin/env node

import path from 'node:path';
import { mkdir, writeFile } from 'node:fs/promises';
import { readUtf8, walkFiles } from './lib/repo-utils.mjs';

const repoRoot = process.cwd();
const municipalityRoot = path.join(repoRoot, 'apps', 'blog', 'src', 'content', 'municipalPages');
const outputRoot = path.join(repoRoot, 'output', 'municipality-quality', 'latest');

const files = await walkFiles(municipalityRoot, (filePath) => filePath.endsWith('.mdx'));
const entries = [];

for (const filePath of files) {
  const source = await readUtf8(filePath);
  const normalizedSource = source.replace(/^\uFEFF/, '');
  const frontmatterMatch = normalizedSource.match(/^---\s*\r?\n([\s\S]*?)\r?\n---\s*\r?\n?([\s\S]*)$/);
  const frontmatter = frontmatterMatch?.[1] ?? '';

  const municipality = capture(frontmatter, /^municipality:\s*"(.+)"$/m) ?? path.basename(filePath, '.mdx');
  const normalizedMunicipality = normalizeText(municipality);
  const title = normalizeText(capture(frontmatter, /^title:\s*"(.+)"$/m) ?? municipality);
  const qualityScore = Number(capture(frontmatter, /^  score:\s*([0-9]+)$/m) || '0');
  const publishable = capture(frontmatter, /^  publishable:\s*(true|false)$/m) === 'true';
  const draft = capture(frontmatter, /^draft:\s*(true|false)$/m) === 'true';
  const reasons = extractReasons(frontmatter, draft, publishable);

  entries.push({
    municipality: normalizedMunicipality,
    title,
    qualityScore,
    publishable,
    draft,
    reasons,
    relativePath: path.relative(repoRoot, filePath),
  });
}

entries.sort((a, b) => {
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

function capture(source, regex) {
  return source.match(regex)?.[1]?.trim() ?? null;
}

function extractReasons(frontmatter, draft, publishable) {
  const match = frontmatter.match(/^  reasons:\r?\n([\s\S]*?)(?:\r?\n[a-zA-Z]|$)/m);
  const reasons = match ? [...match[1].matchAll(/^\s*-\s*"(.+)"$/gm)].map((value) => normalizeText(value[1].trim())) : [];
  if (draft && publishable) {
    return ['DRAFTED_OUTSIDE_CURATED_PUBLISH_SET'];
  }
  return reasons;
}

function normalizeText(value) {
  let normalized = String(value ?? '');
  for (let index = 0; index < 2; index += 1) {
    if (!/[ÃƒÃ‚]/.test(normalized)) break;
    const repaired = Buffer.from(normalized, 'latin1').toString('utf8');
    if (countMarkers(repaired) > countMarkers(normalized)) break;
    normalized = repaired;
  }
  return normalized
    .replace(/â€“/g, '-')
    .replace(/aapaingstider/gi, 'åpningstider')
    .replace(/aapaingstid/gi, 'åpningstid')
    .replace(/aapent/gi, 'åpent')
    .replace(/aapen/gi, 'åpen')
    .replace(/saerskilt/gi, 'særskilt')
    .replace(/soeke/gi, 'søke')
    .replace(/loesning/gi, 'løsning')
    .replace(/\s+/g, ' ')
    .trim();
}

function countMarkers(value) {
  return [...String(value || '')].filter((character) => character === 'Ãƒ' || character === 'Ã‚').length;
}
