#!/usr/bin/env node

import path from 'node:path';
import { readUtf8, extractStringValue, failIfFindings } from './lib/repo-utils.mjs';

const repoRoot = process.cwd();
const findings = [];

const siteConfigPath = path.join(repoRoot, 'apps/blog/src/site-config.ts');
const astroConfigPath = path.join(repoRoot, 'apps/blog/astro.config.mjs');
const wranglerConfigPath = path.join(repoRoot, 'apps/blog/wrangler.jsonc');
const guideWorkerConfigPath = path.join(repoRoot, 'apps/cloudflare/workers/guide-proxy/wrangler.toml');
const ciWorkflowPath = path.join(repoRoot, '.github/workflows/cloudflare-deploy.yml');
const deployWorkflowPath = path.join(repoRoot, '.github/workflows/deploy.yml');

const siteConfigSource = await readUtf8(siteConfigPath);
const astroConfigSource = await readUtf8(astroConfigPath);
const wranglerSource = await readUtf8(wranglerConfigPath);
const guideWorkerSource = await readUtf8(guideWorkerConfigPath);
const ciWorkflowSource = await readUtf8(ciWorkflowPath);
const deployWorkflowSource = await readUtf8(deployWorkflowPath);

const siteUrl = extractStringValue(siteConfigSource, 'siteUrl');
const basePath = extractStringValue(siteConfigSource, 'basePath');
const pagesProject = extractStringValue(siteConfigSource, 'pagesProject');
const routeWorkerName = extractStringValue(siteConfigSource, 'routeWorkerName');

if (!astroConfigSource.includes(`site: '${siteUrl}'`)) {
  findings.push(`apps/blog/astro.config.mjs site must match ${siteUrl}`);
}

if (!astroConfigSource.includes(`base: '${basePath}'`)) {
  findings.push(`apps/blog/astro.config.mjs base must match ${basePath}`);
}

if (!wranglerSource.includes(`"name": "${pagesProject}"`)) {
  findings.push(`apps/blog/wrangler.jsonc name must match ${pagesProject}`);
}

if (!wranglerSource.includes(`"PUBLIC_SITE_URL": "${siteUrl}"`)) {
  findings.push(`apps/blog/wrangler.jsonc PUBLIC_SITE_URL must match ${siteUrl}`);
}

if (!guideWorkerSource.includes(`name = "${routeWorkerName}"`)) {
  findings.push(`guide-proxy worker name must match ${routeWorkerName}`);
}

if (!guideWorkerSource.includes(`pattern = "www.kurs.ing${basePath}*"`)) {
  findings.push(`guide-proxy worker routes must include the mounted base path ${basePath}`);
}

const stalePatterns = [
  { label: 'old Pages project name', pattern: 'emdash-astro-sidecar-blog' },
  { label: 'old preview Pages project', pattern: 'emdash-blog-preview' },
  { label: 'old production Pages project', pattern: 'emdash-blog' },
  { label: 'old worker path', pattern: 'apps/cloudflare/workers/emdash-worker' },
];

for (const { label, pattern } of stalePatterns) {
  if (ciWorkflowSource.includes(pattern) || deployWorkflowSource.includes(pattern)) {
    findings.push(`workflow config still contains ${label}: ${pattern}`);
  }
}

failIfFindings(findings, 'Host configuration gate failed');
console.log('Host configuration gate passed');
