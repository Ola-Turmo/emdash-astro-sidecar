#!/usr/bin/env node

import path from 'node:path';
import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');

function parseArgs(argv) {
  return { strict: argv.includes('--strict') };
}

function normalizeUrl(value) {
  return value.endsWith('/') ? value : `${value}/`;
}

function extractCanonical(html, baseUrl) {
  const raw = html.match(/<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)["']/i)?.[1]?.trim();
  if (!raw) return null;
  try {
    return new URL(raw, baseUrl).toString();
  } catch {
    return raw;
  }
}

function hasNoindex(html, headers) {
  const metaRobots = html.match(/<meta[^>]+name=["']robots["'][^>]+content=["']([^"']+)["']/i)?.[1]?.toLowerCase() ?? '';
  const xRobots = headers.get('x-robots-tag')?.toLowerCase() ?? '';
  return metaRobots.includes('noindex') || xRobots.includes('noindex');
}

async function inspectUrl(url) {
  const response = await fetch(url, { redirect: 'follow' });
  const html = await response.text();
  const finalUrl = response.url;
  const canonical = extractCanonical(html, finalUrl);
  const h1Count = [...html.matchAll(/<h1\b/gi)].length;
  const findings = [];

  if (response.status !== 200) findings.push(`HTTP ${response.status}`);
  if (!canonical) findings.push('Missing canonical');
  if (canonical && normalizeUrl(canonical) !== normalizeUrl(finalUrl)) {
    findings.push(`Canonical mismatch: ${canonical}`);
  }
  if (hasNoindex(html, response.headers)) findings.push('Unexpected noindex');
  if (h1Count !== 1) findings.push(`Expected 1 h1, found ${h1Count}`);

  return {
    url,
    finalUrl,
    status: response.status,
    canonical,
    h1Count,
    findings,
  };
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const siteConfigModule = await import(pathToFileURL(path.join(repoRoot, 'apps/blog/src/site-config.ts')).href);
  const fieldSummaryUrl = new URL('/rum/summary', siteConfigModule.METRICS_WORKER_URL || 'https://emdash-metrics-worker.ola-turmo.workers.dev');
  fieldSummaryUrl.searchParams.set('siteKey', siteConfigModule.ACTIVE_SITE_KEY);
  fieldSummaryUrl.searchParams.set('conceptKey', siteConfigModule.ACTIVE_CONCEPT_KEY);
  fieldSummaryUrl.searchParams.set('sampleSource', 'browser_rum');

  const cruxSummaryUrl = new URL('/crux/summary', siteConfigModule.METRICS_WORKER_URL || 'https://emdash-metrics-worker.ola-turmo.workers.dev');
  cruxSummaryUrl.searchParams.set('siteKey', siteConfigModule.ACTIVE_SITE_KEY);
  cruxSummaryUrl.searchParams.set('conceptKey', siteConfigModule.ACTIVE_CONCEPT_KEY);

  const robotsUrl = `${siteConfigModule.SITE_URL}/robots.txt`;
  const sitemapUrl = `${siteConfigModule.SITE_URL}/sitemap.xml`;
  const auditUrls = [...new Set([siteConfigModule.SITE_URL, ...(siteConfigModule.DEPLOY_AUDIT_EXTRA_URLS || [])])];

  const [robotsResponse, sitemapResponse, fieldResponse, cruxResponse, pageChecks] = await Promise.all([
    fetch(robotsUrl),
    fetch(sitemapUrl),
    fetch(fieldSummaryUrl.toString()),
    fetch(cruxSummaryUrl.toString()),
    Promise.all(auditUrls.map((url) => inspectUrl(url))),
  ]);

  const robotsText = await robotsResponse.text();
  const sitemapText = await sitemapResponse.text();
  const fieldSummary = fieldResponse.ok ? await fieldResponse.json() : null;
  const cruxSummary = cruxResponse.ok ? await cruxResponse.json() : null;

  const findings = [];
  if (robotsResponse.status !== 200) findings.push(`robots.txt returned ${robotsResponse.status}`);
  if (sitemapResponse.status !== 200) findings.push(`sitemap.xml returned ${sitemapResponse.status}`);
  if (!robotsText.includes(`Sitemap: ${siteConfigModule.SITE_URL}/sitemap.xml`)) {
    findings.push('robots.txt is missing the concept sitemap reference');
  }

  for (const url of auditUrls) {
    if (!sitemapText.includes(url)) {
      findings.push(`sitemap.xml is missing ${url}`);
    }
  }

  for (const pageCheck of pageChecks) {
    findings.push(...pageCheck.findings.map((finding) => `${pageCheck.url}: ${finding}`));
  }

  const summary = {
    generatedAt: new Date().toISOString(),
    siteKey: siteConfigModule.ACTIVE_SITE_KEY,
    conceptKey: siteConfigModule.ACTIVE_CONCEPT_KEY,
    robots: {
      url: robotsUrl,
      status: robotsResponse.status,
      hasSitemapReference: robotsText.includes(`Sitemap: ${siteConfigModule.SITE_URL}/sitemap.xml`),
    },
    sitemap: {
      url: sitemapUrl,
      status: sitemapResponse.status,
      trackedUrlCount: auditUrls.length,
      containsTrackedUrls: auditUrls.every((url) => sitemapText.includes(url)),
    },
    pages: pageChecks,
    fieldSummary: fieldSummary
      ? {
          generatedAt: fieldSummary.generatedAt,
          metrics: fieldSummary.metrics,
        }
      : null,
    cruxSummary: cruxSummary
      ? {
          sampleCount: cruxSummary.sampleCount,
          latestCount: cruxSummary.latest?.length ?? 0,
        }
      : null,
    findings,
  };

  const outputDir = path.join(repoRoot, 'output', 'google-public-signals', 'latest');
  mkdirSync(outputDir, { recursive: true });
  writeFileSync(path.join(outputDir, 'summary.json'), JSON.stringify(summary, null, 2));

  const markdown = [
    '# Google Public Signals',
    '',
    `Generated: ${summary.generatedAt}`,
    '',
    `Site/concept: ${summary.siteKey}/${summary.conceptKey}`,
    '',
    `- robots.txt: ${summary.robots.status}`,
    `- sitemap.xml: ${summary.sitemap.status}`,
    `- tracked URLs in sitemap: ${summary.sitemap.containsTrackedUrls ? 'yes' : 'no'}`,
    `- field summary available: ${summary.fieldSummary ? 'yes' : 'no'}`,
    `- CrUX samples available: ${summary.cruxSummary?.sampleCount ?? 0}`,
    '',
    '## Pages',
    '',
    '| URL | Status | Canonical | H1 | Findings |',
    '| --- | ---: | --- | ---: | --- |',
    ...summary.pages.map((page) => `| ${page.url} | ${page.status} | ${page.canonical || '-'} | ${page.h1Count} | ${page.findings.join('; ') || 'ok'} |`),
    '',
  ].join('\n');
  writeFileSync(path.join(outputDir, 'SUMMARY.md'), `${markdown}\n`);

  console.log(JSON.stringify(summary, null, 2));

  if (options.strict && findings.length) {
    throw new Error(`Google public-signals gate failed:\n- ${findings.join('\n- ')}`);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack || error.message : String(error));
  process.exit(1);
});
