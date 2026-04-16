#!/usr/bin/env node

import path from 'node:path';
import { failIfFindings, readUtf8, walkFiles } from './lib/repo-utils.mjs';
import { getResolvedSiteCopy, getShellQualityFixtures } from '../apps/blog/site-copy.mjs';
import { siteProfiles } from '../apps/blog/site-profiles.mjs';

const repoRoot = process.cwd();
const findings = [];

const uiFiles = await walkFiles(path.join(repoRoot, 'apps/blog/src'), (filePath) =>
  /\.(astro|md|mdx|json|ts)$/.test(filePath),
);

const filesToCheck = [
  ...uiFiles,
  path.join(repoRoot, 'apps', 'blog', 'site-profiles.mjs'),
];

const skipMojibakeScanFiles = new Set([
  path.join(repoRoot, 'apps', 'blog', 'src', 'lib', 'municipality-view.ts'),
  path.join(repoRoot, 'scripts', 'lib', 'municipality-evidence.mjs'),
  path.join(repoRoot, 'scripts', 'report-municipality-quality.mjs'),
  path.join(repoRoot, 'scripts', 'check-text-encoding.mjs'),
]);

const bannedUiPhrases = [
  'SEO / GEO sidecar',
  'GEO sidecar',
  'content wave',
  'innholdsbølge',
  'how this blog is connected to the main site',
  'Slik er bloggen koblet til hovedsiden',
  'Kurs.ing sidecar',
  'forklart med faktiske lokale tider',
  'kommunale lenker',
  'de viktigste sporene du må sjekke',
  'det kontrollerte datagrunnlaget',
  'det strukturerte datagrunnlaget',
  'praktiske innganger',
  'Kommunale sider som faktisk er relevante her',
  'egen lokal innholdsmodell',
  'samme design',
  'guidebloggen',
  'Kommunespesifikk informasjon',
];

const bannedPlaceholderPhrases = [
  'lorem ipsum',
  'your content here',
  'TODO',
  'TBD',
];

const { mojibakePatterns } = getShellQualityFixtures();

for (const [siteKey, site] of Object.entries(siteProfiles)) {
  for (const conceptKey of Object.keys(site.concepts)) {
    try {
      getResolvedSiteCopy(siteKey, conceptKey);
    } catch (error) {
      findings.push(
        `validated site copy failed for ${siteKey}/${conceptKey}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
}

for (const filePath of filesToCheck) {
  const relative = path.relative(repoRoot, filePath);
  const content = await readUtf8(filePath);

  if (
    relative.startsWith(`apps${path.sep}blog${path.sep}src${path.sep}content${path.sep}blog${path.sep}`) &&
    /^---[\s\S]*?draft:\s*true[\s\S]*?---/mu.test(content)
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

  if (!skipMojibakeScanFiles.has(filePath)) {
    for (const pattern of mojibakePatterns) {
      if (pattern.test(content)) {
        findings.push(`${relative} appears to contain mojibake or broken encoding`);
        break;
      }
    }
  }
}

const publishedPosts = uiFiles.filter((filePath) =>
  filePath.includes(`${path.sep}content${path.sep}blog${path.sep}`),
);

for (const filePath of publishedPosts) {
  const relative = path.relative(repoRoot, filePath);
  const content = await readUtf8(filePath);

  if (/^---[\s\S]*?draft:\s*true[\s\S]*?---/mu.test(content)) {
    continue;
  }

  const titleMatch = content.match(/^title:\s*"?(.*?)"?$/mu);
  const descriptionMatch = content.match(/^description:\s*"?(.*?)"?$/mu);
  const excerptMatch = content.match(/^excerpt:\s*"?(.*?)"?$/mu);

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
