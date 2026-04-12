#!/usr/bin/env node

import path from 'node:path';
import { readUtf8, walkFiles, failIfFindings } from './lib/repo-utils.mjs';

const repoRoot = process.cwd();
const municipalityRoot = path.join(repoRoot, 'apps', 'blog', 'src', 'content', 'municipalPages');
const findings = [];
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

const files = await walkFiles(municipalityRoot, (filePath) => filePath.endsWith('.mdx'));
const entries = [];

for (const filePath of files) {
  const relative = path.relative(repoRoot, filePath);
  const source = await readUtf8(filePath);
  const [frontmatter = '', body = ''] = source.split('---').slice(1, 3);
  const municipality = capture(frontmatter, /^municipality:\s*"(.+)"$/m);
  const title = capture(frontmatter, /^title:\s*"(.+)"$/m);
  const description = capture(frontmatter, /^description:\s*"(.+)"$/m);
  const officialSourceCount = countYamlArrayItems(frontmatter, 'officialSources');
  const checklistCount = countYamlArrayItems(frontmatter, 'localChecklist');
  const relatedGuideCount = countYamlArrayItems(frontmatter, 'relatedGuideLinks');
  const bodyWordCount = countWords(body);

  entries.push({
    relative,
    municipality,
    title,
    body,
  });

  if (!municipality) {
    findings.push(`${relative} is missing municipality frontmatter`);
  }
  if (!title || !title.includes(municipality ?? '')) {
    findings.push(`${relative} needs a title that includes the municipality name`);
  }
  if (!description || description.length < 110) {
    findings.push(`${relative} needs a more informative description`);
  }
  if (officialSourceCount < 2) {
    findings.push(`${relative} must include at least 2 officialSources`);
  }
  if (checklistCount < 4) {
    findings.push(`${relative} must include at least 4 localChecklist items`);
  }
  if (relatedGuideCount < 3) {
    findings.push(`${relative} must include at least 3 relatedGuideLinks`);
  }
  if (bodyWordCount < 280) {
    findings.push(`${relative} body is too short for a kommune page (${bodyWordCount} words)`);
  }
  for (const snippet of [
    '## Det kommunen selv fremhever',
    '## Dette bør du merke deg i denne kommunen',
    '## Når du bør gå videre til guide eller kurs',
  ]) {
    if (!body.includes(snippet)) {
      findings.push(`${relative} is missing required section "${snippet}"`);
    }
  }
  for (const banned of [
    'Cloudflare',
    'sidecar',
    'autonome',
    'autonomous',
    'Denne siden samler praktiske innganger for kommune',
  ]) {
    if (body.toLowerCase().includes(banned.toLowerCase())) {
      findings.push(`${relative} contains internal or generic wording "${banned}"`);
    }
  }
}

for (let index = 0; index < entries.length; index += 1) {
  for (let compareIndex = index + 1; compareIndex < entries.length; compareIndex += 1) {
    const a = entries[index];
    const b = entries[compareIndex];
    const similarity = jaccardSimilarity(normalizeForSimilarity(a.body), normalizeForSimilarity(b.body));
    if (similarity > 0.82) {
      findings.push(
        `${a.relative} and ${b.relative} are too similar (${similarity.toFixed(2)}); kommune pages need more municipality-specific content`,
      );
    }
  }
}

failIfFindings(findings, 'Municipality content gate failed');
console.log('Municipality content gate passed');

function capture(source, regex) {
  return source.match(regex)?.[1]?.trim() ?? null;
}

function countYamlArrayItems(source, fieldName) {
  const match = source.match(new RegExp(`${fieldName}:\\n([\\s\\S]*?)(?:\\n[a-zA-Z]|$)`));
  if (!match) return 0;
  return (match[1].match(/^\s*-\s/mg) || []).length;
}

function countWords(value) {
  return value.trim().split(/\s+/).filter(Boolean).length;
}

function normalizeForSimilarity(value) {
  return new Set(
    value
      .toLowerCase()
      .replace(/[^a-z0-9æøå\s]/gi, ' ')
      .split(/\s+/)
      .filter((token) => token.length >= 5)
      .filter((token) => !stopWords.has(token)),
  );
}

function jaccardSimilarity(a, b) {
  const intersection = [...a].filter((token) => b.has(token)).length;
  const union = new Set([...a, ...b]).size;
  return union === 0 ? 0 : intersection / union;
}
