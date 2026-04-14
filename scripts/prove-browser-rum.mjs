#!/usr/bin/env node

import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');
const outputDir = path.join(repoRoot, 'output', 'rum-proof');

const DEFAULT_METRICS_URL = 'https://emdash-metrics-worker.ola-turmo.workers.dev';
const DEFAULT_WAIT_MS = 12000;

function parseArgs(argv) {
  const config = {
    siteKey: process.env.EMDASH_SITE_KEY || 'kurs-ing',
    conceptKey: process.env.EMDASH_CONCEPT_KEY || 'guide',
    metricsUrl: process.env.EMDASH_METRICS_URL || DEFAULT_METRICS_URL,
    waitMs: DEFAULT_WAIT_MS,
    urls: [],
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--site' && argv[index + 1]) {
      config.siteKey = argv[index + 1];
      index += 1;
      continue;
    }
    if (arg === '--concept' && argv[index + 1]) {
      config.conceptKey = argv[index + 1];
      index += 1;
      continue;
    }
    if (arg === '--metrics-url' && argv[index + 1]) {
      config.metricsUrl = argv[index + 1];
      index += 1;
      continue;
    }
    if (arg === '--url' && argv[index + 1]) {
      config.urls.push(argv[index + 1]);
      index += 1;
      continue;
    }
    if (arg === '--wait-ms' && argv[index + 1]) {
      config.waitMs = Number(argv[index + 1]) || DEFAULT_WAIT_MS;
      index += 1;
    }
  }

  return config;
}

function defaultUrls(siteKey, conceptKey) {
  if (siteKey === 'kurs-ing' && conceptKey === 'guide') {
    return ['https://www.kurs.ing/guide/'];
  }

  if (siteKey === 'kurs-ing' && conceptKey === 'kommune') {
    return ['https://www.kurs.ing/kommune/arendal/'];
  }

  throw new Error('No default proof URL is configured for this site/concept. Provide one or more --url values.');
}

async function visitUrls(urls, waitMs) {
  const browser = await chromium.launch({ headless: true });
  const visited = [];

  try {
    for (const url of urls) {
      const page = await browser.newPage();
      await page.goto(url, { waitUntil: 'networkidle', timeout: 90000 });
      await page.waitForTimeout(waitMs);
      visited.push({
        url,
        title: await page.title(),
        finalUrl: page.url(),
      });
      await page.close();
    }
  } finally {
    await browser.close();
  }

  return visited;
}

async function fetchSummary(metricsUrl, siteKey, conceptKey) {
  const summaryUrl = new URL('/rum/summary', metricsUrl);
  summaryUrl.searchParams.set('siteKey', siteKey);
  summaryUrl.searchParams.set('conceptKey', conceptKey);
  summaryUrl.searchParams.set('sampleSource', 'browser_rum');
  summaryUrl.searchParams.set('ts', new Date().toISOString());

  const response = await fetch(summaryUrl);
  if (!response.ok) {
    throw new Error(`Failed to fetch metrics summary: ${response.status}`);
  }

  return response.json();
}

async function main() {
  const config = parseArgs(process.argv.slice(2));
  const urls = config.urls.length ? config.urls : defaultUrls(config.siteKey, config.conceptKey);

  const visited = await visitUrls(urls, config.waitMs);
  const summary = await fetchSummary(config.metricsUrl, config.siteKey, config.conceptKey);

  const report = {
    generatedAt: new Date().toISOString(),
    siteKey: config.siteKey,
    conceptKey: config.conceptKey,
    waitMs: config.waitMs,
    visited,
    summary,
  };

  await mkdir(outputDir, { recursive: true });
  await writeFile(path.join(outputDir, `${config.siteKey}-${config.conceptKey}.json`), JSON.stringify(report, null, 2), 'utf8');
  await writeFile(path.join(outputDir, 'latest.json'), JSON.stringify(report, null, 2), 'utf8');

  console.log(JSON.stringify(report, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack || error.message : String(error));
  process.exit(1);
});
