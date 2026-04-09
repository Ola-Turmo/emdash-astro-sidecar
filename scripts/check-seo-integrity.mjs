#!/usr/bin/env node

import path from 'node:path';
import { readUtf8, walkFiles, failIfFindings } from './lib/repo-utils.mjs';

const repoRoot = process.cwd();
const findings = [];

const rssPath = path.join(repoRoot, 'apps/blog/dist/rss.xml');
const sitemapPath = path.join(repoRoot, 'apps/blog/dist/sitemap.xml');
const robotsPath = path.join(repoRoot, 'apps/blog/dist/robots.txt');
const distDir = path.join(repoRoot, 'apps/blog/dist');
const artifactsPath = path.join(repoRoot, 'apps/cloudflare/workers/guide-proxy/src/generated/seo-artifacts.ts');

const [rssXml, sitemapXml, robotsTxt, artifactModule, distHtmlFiles] = await Promise.all([
  readUtf8(rssPath),
  readUtf8(sitemapPath),
  readUtf8(robotsPath),
  readUtf8(artifactsPath),
  walkFiles(distDir, (filePath) => filePath.endsWith('.html')),
]);

const rssExpectations = [
  'Kurs.ing Blogg',
  'https://www.kurs.ing/guide/',
  '<language>nb-no</language>',
];

for (const expected of rssExpectations) {
  if (!rssXml.includes(expected)) {
    findings.push(`apps/blog/dist/rss.xml is missing expected value: ${expected}`);
  }
}

const bannedRssValues = ['EmDash Blog', 'Thoughtful articles on web development', '<language>en-us</language>'];
for (const banned of bannedRssValues) {
  if (rssXml.includes(banned)) {
    findings.push(`apps/blog/dist/rss.xml still contains stale value: ${banned}`);
  }
}

if (sitemapXml.includes('undefined')) {
  findings.push('apps/blog/dist/sitemap.xml contains undefined paths');
}

if (!sitemapXml.includes('https://www.kurs.ing/guide/category/etablererproven/')) {
  findings.push('apps/blog/dist/sitemap.xml is missing expected category URLs');
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
    findings.push(`apps/blog/dist/sitemap.xml still exposes banned public route: ${banned}`);
  }
}

if (!robotsTxt.includes('Sitemap: https://www.kurs.ing/guide/sitemap.xml')) {
  findings.push('apps/blog/dist/robots.txt does not point to the guide sitemap');
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
    findings.push(`apps/blog/dist still contains banned public route: ${banned}`);
  }
}

const artifactChecks = [
  { name: 'guideRssXml', content: rssXml },
  { name: 'guideSitemapXml', content: sitemapXml },
  { name: 'guideRobotsTxt', content: robotsTxt },
];

for (const { name, content } of artifactChecks) {
  if (!artifactModule.includes(`export const ${name} = ${JSON.stringify(content)};`)) {
    findings.push(`guide worker SEO artifacts are out of sync for ${name}. Run pnpm sync:guide-seo`);
  }
}

failIfFindings(findings, 'SEO integrity gate failed');
console.log('SEO integrity gate passed');
