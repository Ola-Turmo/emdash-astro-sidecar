#!/usr/bin/env node

import path from 'node:path';
import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');

async function main() {
  const siteConfigModule = await import(pathToFileURL(path.join(repoRoot, 'apps/blog/src/site-config.ts')).href);
  const metricsWorkerUrl = siteConfigModule.METRICS_WORKER_URL || 'https://emdash-metrics-worker.ola-turmo.workers.dev';
  const summaryUrl = new URL('/traffic/summary', metricsWorkerUrl);
  summaryUrl.searchParams.set('siteKey', siteConfigModule.ACTIVE_SITE_KEY);
  summaryUrl.searchParams.set('conceptKey', siteConfigModule.ACTIVE_CONCEPT_KEY);

  const response = await fetch(summaryUrl.toString(), {
    headers: {
      'cache-control': 'no-store',
    },
  });
  if (!response.ok) {
    throw new Error(`Traffic summary failed (${response.status})`);
  }

  const summary = await response.json();
  const outputDir = path.join(repoRoot, 'output', 'edge-traffic', 'latest');
  mkdirSync(outputDir, { recursive: true });
  writeFileSync(path.join(outputDir, 'summary.json'), JSON.stringify(summary, null, 2));

  const markdown = [
    '# Edge Traffic Report',
    '',
    `Generated: ${summary.generatedAt}`,
    '',
    `Site/concept: ${summary.siteKey}/${summary.conceptKey}`,
    `Total requests: ${summary.totalRequests}`,
    '',
    '## Referrer Types',
    '',
    '| Type | Count |',
    '| --- | ---: |',
    ...summary.byReferrerType.map((row) => `| ${row.key} | ${row.count} |`),
    '',
    '## User-Agent Types',
    '',
    '| Type | Count |',
    '| --- | ---: |',
    ...summary.byCrawlerType.map((row) => `| ${row.key} | ${row.count} |`),
    '',
    '## Top Search Landing Pages',
    '',
    '| Path | Count |',
    '| --- | ---: |',
    ...summary.topOrganicLandingPages.map((row) => `| ${row.key} | ${row.count} |`),
    '',
    '## Top Search Queries',
    '',
    '| Query | Engine | Path | Count |',
    '| --- | --- | --- | ---: |',
    ...summary.topSearchQueries.map((row) => `| ${row.query} | ${row.engine} | ${row.path} | ${row.count} |`),
    '',
    '## Top Referrers',
    '',
    '| Host | Count |',
    '| --- | ---: |',
    ...summary.topReferrers.map((row) => `| ${row.key} | ${row.count} |`),
    '',
    '## Top Crawler Paths',
    '',
    '| Path | Count |',
    '| --- | ---: |',
    ...summary.crawlerPaths.map((row) => `| ${row.key} | ${row.count} |`),
    '',
  ].join('\n');
  writeFileSync(path.join(outputDir, 'SUMMARY.md'), `${markdown}\n`);
  console.log(`Edge traffic report written to ${path.join(outputDir, 'SUMMARY.md')}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack || error.message : String(error));
  process.exit(1);
});
