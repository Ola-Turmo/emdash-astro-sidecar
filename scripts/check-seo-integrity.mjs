#!/usr/bin/env node

import path from 'node:path';
import { readUtf8, walkFiles, failIfFindings } from './lib/repo-utils.mjs';
import { getConceptOutputDir, resolveActiveSiteRuntime } from '../apps/blog/site-profiles.mjs';

const repoRoot = process.cwd();
const findings = [];
const { siteKey, conceptKey, concept } = resolveActiveSiteRuntime(process.env);
const conceptDistDir = path.join(
  repoRoot,
  'apps/blog',
  getConceptOutputDir(siteKey, conceptKey).replace(/^\.\//, ''),
);

const rssPath = path.join(conceptDistDir, 'rss.xml');
const sitemapPath = path.join(conceptDistDir, 'sitemap.xml');
const robotsPath = path.join(conceptDistDir, 'robots.txt');
const distDir = conceptDistDir;
const artifactsPath = path.join(
  repoRoot,
  'apps/cloudflare/workers',
  concept.cloudflare.routeWorkerDirectory,
  'src/generated/seo-artifacts.ts',
);

const [rssXml, sitemapXml, robotsTxt, artifactModule, distHtmlFiles] = await Promise.all([
  readUtf8(rssPath),
  readUtf8(sitemapPath),
  readUtf8(robotsPath),
  readUtf8(artifactsPath),
  walkFiles(distDir, (filePath) => filePath.endsWith('.html')),
]);

const rssExpectations = [
  concept.siteName,
  `${concept.siteUrl}/`,
  '<language>nb-no</language>',
];

for (const expected of rssExpectations) {
  if (!rssXml.includes(expected)) {
    findings.push(`${path.relative(repoRoot, rssPath)} is missing expected value: ${expected}`);
  }
}

const bannedRssValues = ['EmDash Blog', 'Thoughtful articles on web development', '<language>en-us</language>'];
for (const banned of bannedRssValues) {
  if (rssXml.includes(banned)) {
    findings.push(`${path.relative(repoRoot, rssPath)} still contains stale value: ${banned}`);
  }
}

if (sitemapXml.includes('undefined')) {
  findings.push(`${path.relative(repoRoot, sitemapPath)} contains undefined paths`);
}

if (concept.routes.categoryPrefix && concept.routes.categoryPrefix !== '/') {
  const expectedCategoryUrl = `${concept.siteUrl}${concept.routes.categoryPrefix}/etablererproven/`;
  if (!sitemapXml.includes(expectedCategoryUrl)) {
    findings.push(`${path.relative(repoRoot, sitemapPath)} is missing expected category URLs`);
  }
}

const bannedSitemapValues = [
  '/category/strategy/',
  '/category/tutorials/',
  '/author/editor/',
  '/preview/',
  '/tag/',
];

for (const banned of bannedSitemapValues) {
  if (sitemapXml.includes(banned)) {
    findings.push(`${path.relative(repoRoot, sitemapPath)} still exposes banned public route: ${banned}`);
  }
}

if (!robotsTxt.includes(`Sitemap: ${concept.siteUrl}/sitemap.xml`)) {
  findings.push(`${path.relative(repoRoot, robotsPath)} does not point to the concept sitemap`);
}

const distRoutes = distHtmlFiles
  .map((filePath) => path.relative(distDir, filePath).replace(/\\/g, '/'))
  .map((relativePath) => {
    if (relativePath === 'index.html') return '/';
    if (relativePath.endsWith('/index.html')) {
      return `/${relativePath.slice(0, -'index.html'.length)}`;
    }
    return `/${relativePath}`;
  });

const bannedDistRoutes = [
  '/preview/',
  '/tag/',
  '/author/editor/',
  '/category/strategy/',
  '/category/tutorials/',
];

for (const banned of bannedDistRoutes) {
  if (distRoutes.some((route) => route.startsWith(banned))) {
    findings.push(`${path.relative(repoRoot, distDir)} still contains banned public route: ${banned}`);
  }
}

const artifactChecks = [
  { names: ['conceptRssXml'], content: rssXml },
  { names: ['conceptSitemapXml'], content: sitemapXml },
  { names: ['conceptRobotsTxt'], content: robotsTxt },
];

for (const { names, content } of artifactChecks) {
  const matched = names.some((name) => artifactModule.includes(`export const ${name} = ${JSON.stringify(content)};`));
  if (!matched) {
    findings.push(`${concept.cloudflare.routeWorkerDirectory} SEO artifacts are out of sync for ${names[0]}. Run pnpm sync:concept-seo`);
  }
}

failIfFindings(findings, 'SEO integrity gate failed');
console.log('SEO integrity gate passed');
