#!/usr/bin/env node

import path from 'node:path';
import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');

async function main() {
  const siteConfigModule = await import(pathToFileURL(path.join(repoRoot, 'apps/blog/src/site-config.ts')).href);
  const urls = [...new Set([siteConfigModule.SITE_URL, ...(siteConfigModule.DEPLOY_AUDIT_EXTRA_URLS || [])].filter(Boolean))];

  const results = [];
  for (const url of urls) {
    const endpoint = new URL('https://www.googleapis.com/pagespeedonline/v5/runPagespeed');
    endpoint.searchParams.set('url', url);
    endpoint.searchParams.set('strategy', 'mobile');
    endpoint.searchParams.set('category', 'PERFORMANCE');
    endpoint.searchParams.set('category', 'SEO');
    endpoint.searchParams.set('category', 'ACCESSIBILITY');
    endpoint.searchParams.set('category', 'BEST_PRACTICES');

    const response = await fetch(endpoint.toString());
    const text = await response.text();
    if (!response.ok) {
      results.push({ url, ok: false, error: text.slice(0, 400) });
      continue;
    }

    const data = JSON.parse(text);
    const categories = data.lighthouseResult?.categories || {};
    results.push({
      url,
      ok: true,
      performance: score(categories.performance?.score),
      accessibility: score(categories.accessibility?.score),
      seo: score(categories.seo?.score),
      bestPractices: score(categories['best-practices']?.score),
      loadingExperience: data.loadingExperience?.metrics || null,
      originLoadingExperience: data.originLoadingExperience?.metrics || null,
    });
  }

  const outputDir = path.join(repoRoot, 'output', 'pagespeed-public', 'latest');
  mkdirSync(outputDir, { recursive: true });
  writeFileSync(path.join(outputDir, 'summary.json'), JSON.stringify({ generatedAt: new Date().toISOString(), results }, null, 2));

  const markdown = [
    '# Public PageSpeed Report',
    '',
    `Generated: ${new Date().toISOString()}`,
    '',
    '| URL | Perf | A11y | SEO | Best | Field Data | Origin Field Data |',
    '| --- | ---: | ---: | ---: | ---: | --- | --- |',
    ...results.map((row) =>
      row.ok
        ? `| ${row.url} | ${row.performance} | ${row.accessibility} | ${row.seo} | ${row.bestPractices} | ${row.loadingExperience ? 'yes' : 'no'} | ${row.originLoadingExperience ? 'yes' : 'no'} |`
        : `| ${row.url} | - | - | - | - | error | error |`,
    ),
    '',
  ].join('\n');
  writeFileSync(path.join(outputDir, 'SUMMARY.md'), `${markdown}\n`);
  console.log(`Public PageSpeed report written to ${path.join(outputDir, 'SUMMARY.md')}`);
}

function score(value) {
  return typeof value === 'number' ? Math.round(value * 100) : null;
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack || error.message : String(error));
  process.exit(1);
});
