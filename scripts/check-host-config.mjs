#!/usr/bin/env node

import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { readUtf8, failIfFindings } from './lib/repo-utils.mjs';

const repoRoot = process.cwd();
const findings = [];

const siteConfigPath = path.join(repoRoot, 'apps/blog/src/site-config.ts');
const astroConfigPath = path.join(repoRoot, 'apps/blog/astro.config.mjs');
const wranglerConfigPath = path.join(repoRoot, 'apps/blog/wrangler.jsonc');
const guideWorkerConfigPath = path.join(repoRoot, 'apps/cloudflare/workers/guide-proxy/wrangler.toml');
const kommuneWorkerConfigPath = path.join(repoRoot, 'apps/cloudflare/workers/kommune-proxy/wrangler.toml');
const ciWorkflowPath = path.join(repoRoot, '.github/workflows/cloudflare-deploy.yml');
const deployWorkflowPath = path.join(repoRoot, '.github/workflows/deploy.yml');

const siteConfigSource = await readUtf8(siteConfigPath);
const astroConfigSource = await readUtf8(astroConfigPath);
const wranglerSource = await readUtf8(wranglerConfigPath);
const guideWorkerSource = await readUtf8(guideWorkerConfigPath);
const kommuneWorkerSource = await readUtf8(kommuneWorkerConfigPath);
const ciWorkflowSource = await readUtf8(ciWorkflowPath);
const deployWorkflowSource = await readUtf8(deployWorkflowPath);

const siteProfilesModuleUrl = pathToFileURL(path.join(repoRoot, 'apps/blog/site-profiles.mjs')).href;
const { resolveActiveSiteRuntime } = await import(siteProfilesModuleUrl);
const runtime = resolveActiveSiteRuntime(process.env);
const siteUrl = runtime.concept.siteUrl;
const basePath = runtime.concept.basePath;
const pagesProject = runtime.concept.cloudflare.pagesProject;
const routeWorkerName = runtime.concept.cloudflare.routeWorkerName;
const hostname = new URL(runtime.site.brand.mainSiteUrl).hostname;
const wwwPatternHost = hostname.startsWith('www.') ? hostname : `www.${hostname}`;
const routeWorkerDirectory = runtime.concept.cloudflare.routeWorkerDirectory;

if (!astroConfigSource.includes('resolveActiveSiteRuntime')) {
  findings.push('apps/blog/astro.config.mjs must resolve the active site/concept profile');
}

if (!astroConfigSource.includes('site: concept.siteUrl')) {
  findings.push('apps/blog/astro.config.mjs must use concept.siteUrl');
}

if (!astroConfigSource.includes('base: concept.basePath')) {
  findings.push('apps/blog/astro.config.mjs must use concept.basePath');
}

if (!siteConfigSource.includes('resolveActiveSiteRuntime')) {
  findings.push('apps/blog/src/site-config.ts must use the shared site registry');
}

if (!wranglerSource.includes(`"name": "${pagesProject}"`)) {
  findings.push(`apps/blog/wrangler.jsonc name must match ${pagesProject}`);
}

if (!wranglerSource.includes(`"PUBLIC_SITE_URL": "${siteUrl}"`)) {
  findings.push(`apps/blog/wrangler.jsonc PUBLIC_SITE_URL must match ${siteUrl}`);
}

if (!guideWorkerSource.includes(`name = "${routeWorkerName}"`)) {
  if (routeWorkerDirectory === 'guide-proxy') {
    findings.push(`guide-proxy worker name must match ${routeWorkerName}`);
  }
}

if (!guideWorkerSource.includes(`pattern = "${wwwPatternHost}${basePath}*"`)) {
  if (routeWorkerDirectory === 'guide-proxy') {
    findings.push(`guide-proxy worker routes must include the mounted base path ${basePath}`);
  }
}

if (routeWorkerDirectory === 'kommune-proxy') {
  if (!kommuneWorkerSource.includes(`name = "${routeWorkerName}"`)) {
    findings.push(`kommune-proxy worker name must match ${routeWorkerName}`);
  }

  if (!kommuneWorkerSource.includes(`pattern = "${wwwPatternHost}${basePath}*"`)) {
    findings.push(`kommune-proxy worker routes must include the mounted base path ${basePath}`);
  }
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
