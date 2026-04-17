#!/usr/bin/env node

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { writeReportArtifacts } from './lib/report-artifacts.mjs';
import { loadRuntimeQualityConfig } from './lib/runtime-quality.mjs';

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

function extractLastmodDates(xml) {
  return [...xml.matchAll(/<lastmod>([^<]+)<\/lastmod>/gi)].map((match) => new Date(match[1]));
}

async function inspectUrl(page, url) {
  const response = await fetch(url, { redirect: 'follow' });
  const html = await response.text();
  const finalUrl = response.url;
  const canonical = extractCanonical(html, finalUrl);
  const bodyText = html.replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  const findings = [];

  if (response.status !== 200) findings.push(`HTTP ${response.status}`);
  if (!canonical) findings.push('Missing canonical');
  if (canonical && normalizeUrl(canonical) !== normalizeUrl(finalUrl)) findings.push(`Canonical mismatch: ${canonical}`);
  if (hasNoindex(html, response.headers)) findings.push('Unexpected noindex');
  if (bodyText.length < 400) findings.push('Rendered body text is unexpectedly thin');

  await page.goto(url, { waitUntil: 'networkidle' });
  const overlayCheck = await page.evaluate(() => {
    const candidates = [...document.querySelectorAll('dialog,[role="dialog"],.modal,.overlay,[data-overlay],[aria-modal="true"]')];
    const visibleCandidates = candidates.filter((element) => {
      const style = window.getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      return style.display !== 'none' && style.visibility !== 'hidden' && rect.width > 0 && rect.height > 0;
    });

    const internalLinks = [...document.querySelectorAll('a[href]')].filter((anchor) => {
      const href = anchor.getAttribute('href') || '';
      return href.startsWith('/') || href.startsWith(window.location.origin);
    }).length;

    return {
      visibleOverlayCount: visibleCandidates.length,
      internalLinkCount: internalLinks,
    };
  });

  if (overlayCheck.visibleOverlayCount > 0) {
    findings.push(`Potential intrusive overlay count: ${overlayCheck.visibleOverlayCount}`);
  }
  if (overlayCheck.internalLinkCount < 2) {
    findings.push(`Weak internal-link support (${overlayCheck.internalLinkCount} internal links)`);
  }

  return {
    url,
    finalUrl,
    status: response.status,
    canonical,
    bodyTextLength: bodyText.length,
    internalLinkCount: overlayCheck.internalLinkCount,
    overlayCount: overlayCheck.visibleOverlayCount,
    findings,
  };
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const config = loadRuntimeQualityConfig(process.env);
  const robotsUrl = `${config.runtime.concept.siteUrl}/robots.txt`;
  const sitemapUrl = `${config.runtime.concept.siteUrl}/sitemap.xml`;
  const urls = config.auditUrls;

  const [robotsResponse, sitemapResponse] = await Promise.all([fetch(robotsUrl), fetch(sitemapUrl)]);
  const robotsText = await robotsResponse.text();
  const sitemapText = await sitemapResponse.text();
  const lastmodDates = extractLastmodDates(sitemapText).filter((value) => Number.isFinite(value.getTime()));
  const mostRecentLastmod = lastmodDates.sort((left, right) => right.getTime() - left.getTime())[0] ?? null;
  const findings = [];

  if (robotsResponse.status !== 200) findings.push(`robots.txt returned ${robotsResponse.status}`);
  if (sitemapResponse.status !== 200) findings.push(`sitemap.xml returned ${sitemapResponse.status}`);
  if (!robotsText.includes(`Sitemap: ${config.runtime.concept.siteUrl}/sitemap.xml`)) {
    findings.push('robots.txt is missing the concept sitemap reference');
  }
  for (const url of urls) {
    if (!sitemapText.includes(url)) {
      findings.push(`sitemap.xml is missing ${url}`);
    }
  }

  if (!mostRecentLastmod) {
    findings.push('sitemap.xml does not expose any <lastmod> timestamps');
  } else {
    const ageDays = Math.floor((Date.now() - mostRecentLastmod.getTime()) / 86_400_000);
    if (ageDays > 14) {
      findings.push(`sitemap freshness exceeded 14 days (${ageDays}d)`);
    }
  }

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1366, height: 900 }, locale: 'nb-NO' });
  const pageResults = [];
  for (const url of urls) {
    const result = await inspectUrl(page, url);
    pageResults.push(result);
    findings.push(...result.findings.map((finding) => `${url}: ${finding}`));
  }
  await browser.close();

  const summary = {
    generatedAt: new Date().toISOString(),
    siteKey: config.runtime.siteKey,
    conceptKey: config.runtime.conceptKey,
    dashboardLabel: config.dashboardLabel,
    strict: options.strict,
    robots: {
      url: robotsUrl,
      status: robotsResponse.status,
    },
    sitemap: {
      url: sitemapUrl,
      status: sitemapResponse.status,
      trackedUrlCount: urls.length,
      mostRecentLastmod: mostRecentLastmod?.toISOString() ?? null,
    },
    pages: pageResults,
    findings,
  };

  const markdown = [
    '# Crawlability & Renderability Report',
    '',
    `Generated: ${summary.generatedAt}`,
    `Scope: ${summary.siteKey}/${summary.conceptKey}`,
    '',
    `- robots.txt status: ${summary.robots.status}`,
    `- sitemap.xml status: ${summary.sitemap.status}`,
    `- latest sitemap lastmod: ${summary.sitemap.mostRecentLastmod ?? 'missing'}`,
    '',
    '| URL | Status | Body chars | Internal links | Overlays | Status |',
    '| --- | ---: | ---: | ---: | ---: | --- |',
    ...pageResults.map((result) => `| ${result.url} | ${result.status} | ${result.bodyTextLength} | ${result.internalLinkCount} | ${result.overlayCount} | ${result.findings.length ? 'alert' : 'ok'} |`),
    '',
    '## Findings',
    '',
    ...(findings.length ? findings.map((finding) => `- ${finding}`) : ['- Crawlability and renderability checks passed.']),
  ].join('\n');

  const paths = writeReportArtifacts(repoRoot, 'crawlability', summary, markdown, config.outputScope);
  console.log(`Crawlability report written to ${paths.latestMarkdownPath}`);

  if (options.strict && findings.length) {
    throw new Error(`Crawlability gate failed. See ${paths.latestMarkdownPath}`);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack || error.message : String(error));
  process.exit(1);
});
