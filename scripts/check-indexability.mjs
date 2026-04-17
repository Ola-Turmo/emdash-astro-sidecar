#!/usr/bin/env node

import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { readUtf8, walkFiles, failIfFindings } from './lib/repo-utils.mjs';
import { getConceptOutputDir } from '../apps/blog/site-profiles.mjs';

const repoRoot = process.cwd();
const findings = [];
const siteConfigModule = await import(pathToFileURL(path.join(repoRoot, 'apps/blog/src/site-config.ts')).href);
const conceptDistDir = path.join(
  repoRoot,
  'apps/blog',
  getConceptOutputDir(siteConfigModule.ACTIVE_SITE_KEY, siteConfigModule.ACTIVE_CONCEPT_KEY).replace(/^\.\//, ''),
);

const htmlFiles = await walkFiles(conceptDistDir, (filePath) => filePath.endsWith('.html'));
const shouldNotIndexRoutePrefixes = ['/preview/', '/tag/'];

for (const filePath of htmlFiles) {
  const relativePath = path.relative(conceptDistDir, filePath).replace(/\\/g, '/');
  if (relativePath === '404.html') {
    continue;
  }

  const routePath = toRoutePath(relativePath);
  const expectedUrl = toExpectedPublicUrl(routePath, siteConfigModule.SITE_URL);
  const html = await readUtf8(filePath);

  const canonical = html.match(/<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)["']/i)?.[1]?.trim() ?? '';
  const robots = html.match(/<meta[^>]+name=["']robots["'][^>]+content=["']([^"']+)["']/i)?.[1]?.toLowerCase() ?? '';
  const shouldNotIndex = shouldNotIndexRoutePrefixes.some((prefix) => routePath.startsWith(prefix));

  if (shouldNotIndex) {
    if (!robots.includes('noindex')) {
      findings.push(`${path.relative(repoRoot, filePath)} should be noindex`);
    }
    continue;
  }

  if (!canonical) {
    findings.push(`${path.relative(repoRoot, filePath)} is missing canonical`);
  } else if (normalizeUrl(canonical) !== normalizeUrl(expectedUrl)) {
    findings.push(
      `${path.relative(repoRoot, filePath)} canonical mismatch: expected ${expectedUrl}, got ${canonical}`,
    );
  }

  if (robots.includes('noindex')) {
    findings.push(`${path.relative(repoRoot, filePath)} unexpectedly includes noindex`);
  }
}

failIfFindings(findings, 'Indexability audit failed');
console.log('Indexability audit passed');

function toRoutePath(relativePath) {
  if (relativePath === 'index.html') return '/';
  if (relativePath.endsWith('/index.html')) {
    return `/${relativePath.slice(0, -'index.html'.length)}`;
  }
  return `/${relativePath.replace(/\.html$/i, '')}`;
}

function toExpectedPublicUrl(routePath, siteUrl) {
  if (routePath === '/') {
    return siteUrl;
  }
  return new URL(routePath.replace(/^\//, ''), withTrailingSlash(siteUrl)).toString();
}

function withTrailingSlash(url) {
  return url.endsWith('/') ? url : `${url}/`;
}

function normalizeUrl(value) {
  return String(value ?? '').replace(/\/$/, '');
}
