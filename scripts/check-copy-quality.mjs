#!/usr/bin/env node

import path from 'node:path';
import { readUtf8, walkFiles, failIfFindings } from './lib/repo-utils.mjs';

const repoRoot = process.cwd();
const findings = [];

const uiFiles = await walkFiles(path.join(repoRoot, 'apps/blog/src'), (filePath) =>
  /\.(astro|md|mdx|json|ts)$/.test(filePath),
);

const bannedUiPhrases = [
  'SEO / GEO sidecar',
  'GEO sidecar',
  'content wave',
  'innholdsbølge',
  'how this blog is connected to the main site',
  'Slik er bloggen koblet til hovedsiden',
  'Kurs.ing sidecar',
];

const bannedPlaceholderPhrases = [
  'lorem ipsum',
  'your content here',
  'TODO',
  'TBD',
];

const mojibakePatterns = [/Ã./, /â€/, /Â©/, /ðŸ/, /âœ/];

for (const filePath of uiFiles) {
  const relative = path.relative(repoRoot, filePath);
  const content = await readUtf8(filePath);

  if (
    relative.startsWith('apps/blog/src/content/blog/') &&
    /^---[\s\S]*?draft:\s*true[\s\S]*?---/m.test(content)
  ) {
    continue;
  }

  for (const phrase of bannedUiPhrases) {
    if (content.includes(phrase)) {
      findings.push(`${relative} contains banned user-facing phrase "${phrase}"`);
    }
  }

  for (const phrase of bannedPlaceholderPhrases) {
    if (content.includes(phrase)) {
      findings.push(`${relative} contains placeholder phrase "${phrase}"`);
    }
  }

  for (const pattern of mojibakePatterns) {
    if (pattern.test(content)) {
      findings.push(`${relative} appears to contain mojibake or broken encoding`);
      break;
    }
  }
}

const publishedPosts = uiFiles.filter((filePath) => filePath.includes(`${path.sep}content${path.sep}blog${path.sep}`));
for (const filePath of publishedPosts) {
  const relative = path.relative(repoRoot, filePath);
  const content = await readUtf8(filePath);
  if (/^---[\s\S]*?draft:\s*true[\s\S]*?---/m.test(content)) {
    continue;
  }

  const titleMatch = content.match(/^title:\s*"?(.*?)"?$/m);
  const descriptionMatch = content.match(/^description:\s*"?(.*?)"?$/m);
  const excerptMatch = content.match(/^excerpt:\s*"?(.*?)"?$/m);

  if (!titleMatch || titleMatch[1].length > 80) {
    findings.push(`${relative} is missing a valid title under 80 characters`);
  }
  if (!descriptionMatch || descriptionMatch[1].length > 200) {
    findings.push(`${relative} is missing a valid description under 200 characters`);
  }
  if (!excerptMatch || excerptMatch[1].length > 180) {
    findings.push(`${relative} is missing a valid excerpt under 180 characters`);
  }
}

failIfFindings(findings, 'Copy quality gate failed');
console.log('Copy quality gate passed');
