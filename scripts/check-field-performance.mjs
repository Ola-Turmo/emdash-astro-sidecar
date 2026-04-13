#!/usr/bin/env node

import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { siteProfiles } from '../apps/blog/site-profiles.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');

const args = new Set(process.argv.slice(2));
const strict = args.has('--strict');
const minSamples = Number.parseInt(process.env.EMDASH_FIELD_MIN_SAMPLES ?? '5', 10);
const sampleSource = process.env.EMDASH_FIELD_SAMPLE_SOURCE ?? 'browser_rum';

const targets = {
  LCP: 2500,
  INP: 200,
  CLS: 0.1,
  TTFB: 800,
  FCP: 1800,
};

const concepts = listTrackableConcepts();
const results = [];

for (const concept of concepts) {
  const endpoint = new URL(concept.rumEndpoint);
  endpoint.pathname = '/rum/summary';
  endpoint.searchParams.set('siteKey', concept.siteKey);
  endpoint.searchParams.set('conceptKey', concept.conceptKey);
  endpoint.searchParams.set('sampleSource', sampleSource);
  endpoint.searchParams.set('ts', String(Date.now()));

  try {
    const response = await fetch(endpoint.toString(), {
      headers: {
        'cache-control': 'no-store',
      },
    });

    if (!response.ok) {
      results.push({
        ...concept,
        ok: false,
        error: `HTTP ${response.status}`,
      });
      continue;
    }

    const summary = await response.json();
    const metricSummary = Object.fromEntries(
      Object.keys(targets).map((metricName) => {
        const metric = summary.metrics?.[metricName] ?? {};
        return [
          metricName,
          {
            p75: metric.p75 ?? null,
            sampleCount: metric.sampleCount ?? 0,
            rating: metric.rating ?? 'no-data',
            target: targets[metricName],
          },
        ];
      }),
    );

    const status = getOverallStatus(metricSummary);

    results.push({
      ...concept,
      ok: true,
      status,
      summary: metricSummary,
      generatedAt: summary.generatedAt ?? null,
    });
  } catch (error) {
    results.push({
      ...concept,
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

const outputDir = path.join(repoRoot, 'output', 'field-performance', 'latest');
mkdirSync(outputDir, { recursive: true });

writeFileSync(path.join(outputDir, 'summary.json'), JSON.stringify({ generatedAt: new Date().toISOString(), results }, null, 2));
writeFileSync(path.join(outputDir, 'SUMMARY.md'), renderMarkdown(results));

const shouldFail =
  strict &&
  results.some((result) => {
    if (!result.ok) return true;
    return Object.values(result.summary).some((metric) => metric.sampleCount < minSamples || metric.rating !== 'good');
  });

if (shouldFail) {
  console.error(`Field-performance gate failed. See ${path.join(outputDir, 'SUMMARY.md')}`);
  process.exit(1);
}

console.log(`Field-performance report written to ${path.join(outputDir, 'SUMMARY.md')}`);

function listTrackableConcepts() {
  return Object.values(siteProfiles).flatMap((site) =>
    Object.values(site.concepts)
      .filter(() => site.telemetry?.rumEndpoint)
      .map((concept) => ({
        siteKey: site.key,
        conceptKey: concept.key,
        rumEndpoint: site.telemetry.rumEndpoint,
      })),
  );
}

function getOverallStatus(summary) {
  const ratings = Object.values(summary).map((metric) => metric.rating);
  if (ratings.every((rating) => rating === 'good')) return 'good';
  if (ratings.some((rating) => rating === 'poor')) return 'poor';
  if (ratings.some((rating) => rating === 'no-data')) return 'no-data';
  return 'needs-improvement';
}

function renderMarkdown(results) {
  const lines = [
    '# Field Performance Report',
    '',
    `Generated: ${new Date().toISOString()}`,
    '',
    `Strict mode: ${strict ? 'on' : 'off'}`,
    `Minimum samples per metric for strict mode: ${minSamples}`,
    `Sample source: ${sampleSource}`,
    '',
  ];

  for (const result of results) {
    lines.push(`## ${result.siteKey}/${result.conceptKey}`);
    if (!result.ok) {
      lines.push('', `- Status: failed`, `- Error: ${result.error}`, '');
      continue;
    }

    lines.push('', `- Status: ${result.status}`, `- Generated at: ${result.generatedAt ?? '-'}`, '');
    lines.push('| Metric | p75 | Samples | Target | Rating |');
    lines.push('| --- | ---: | ---: | ---: | --- |');
    for (const [metricName, metric] of Object.entries(result.summary)) {
      lines.push(`| ${metricName} | ${format(metric.p75)} | ${metric.sampleCount} | ${metric.target} | ${metric.rating} |`);
    }
    lines.push('');
  }

  return `${lines.join('\n')}\n`;
}

function format(value) {
  return value === null || value === undefined ? '-' : String(value);
}
