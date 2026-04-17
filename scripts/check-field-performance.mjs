#!/usr/bin/env node

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadPreviousSummary, summarizeTrend, writeReportArtifacts } from './lib/report-artifacts.mjs';
import {
  getApplicableFieldTargets,
  loadRuntimeQualityConfig,
  toConceptRelativePath,
} from './lib/runtime-quality.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');

function parseArgs(argv) {
  return {
    strict: argv.includes('--strict'),
  };
}

function buildSummaryFromRows(rows, targets) {
  const byMetric = new Map();
  for (const row of rows) {
    const values = byMetric.get(row.metric_name) ?? [];
    values.push(Number(row.metric_value));
    byMetric.set(row.metric_name, values);
  }

  const metrics = {};
  for (const [metricName, target] of Object.entries(targets)) {
    const values = [...(byMetric.get(metricName) ?? [])].sort((left, right) => left - right);
    const p75 = percentile(values, 0.75);
    metrics[metricName] = {
      p75,
      sampleCount: values.length,
      target,
      rating: rateMetric(metricName, p75, target),
      meetsTarget: p75 !== null && p75 <= target,
    };
  }

  const status = Object.values(metrics).every((metric) => metric.rating === 'good')
    ? 'good'
    : Object.values(metrics).some((metric) => metric.rating === 'poor')
      ? 'poor'
      : Object.values(metrics).some((metric) => metric.rating === 'no-data')
        ? 'no-data'
        : 'needs-improvement';

  return { status, metrics };
}

function percentile(values, ratio) {
  if (!values.length) return null;
  const index = Math.max(0, Math.min(values.length - 1, Math.ceil(values.length * ratio) - 1));
  return Number(values[index].toFixed(2));
}

function rateMetric(metricName, value, target) {
  if (value === null) return 'no-data';
  const poorThreshold = metricName === 'CLS' ? Math.max(0.25, target * 2.5) : Math.max(target * 1.6, target + 1);
  if (value <= target) return 'good';
  if (value >= poorThreshold) return 'poor';
  return 'needs-improvement';
}

function toMetricRows(rows) {
  return rows
    .filter((row) => row && row.metric_name && Number.isFinite(Number(row.metric_value)))
    .map((row) => ({
      metric_name: row.metric_name,
      metric_value: Number(row.metric_value),
    }));
}

function buildMetricTable(metrics, previousMetrics = {}) {
  return Object.entries(metrics).map(([metricName, metric]) => {
    const previous = previousMetrics?.[metricName]?.p75 ?? null;
    return {
      metricName,
      ...metric,
      trend: summarizeTrend(metric.p75, previous, true),
    };
  });
}

async function fetchJson(url) {
  const response = await fetch(url, {
    headers: {
      'cache-control': 'no-store',
    },
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} for ${url}`);
  }

  return response.json();
}

function renderMetricRows(rows) {
  return rows
    .map((row) => {
      const trend = row.trend ? `${row.trend.direction} (${row.trend.delta})` : '-';
      return `| ${row.metricName} | ${format(row.p75)} | ${row.sampleCount} | ${row.target} | ${row.rating} | ${row.meetsTarget ? 'yes' : 'no'} | ${trend} |`;
    })
    .join('\n');
}

function format(value) {
  return value === null || value === undefined ? '-' : String(value);
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const config = loadRuntimeQualityConfig(process.env);
  const previous = loadPreviousSummary(repoRoot, 'field-performance', config.outputScope);
  const minSamples = Number.parseInt(process.env.EMDASH_FIELD_MIN_SAMPLES ?? '5', 10);
  const sampleSource = process.env.EMDASH_FIELD_SAMPLE_SOURCE ?? 'browser_rum';
  const endpointRoot = config.runtime.site.telemetry?.metricsWorkerUrl || 'https://emdash-metrics-worker.ola-turmo.workers.dev';

  const summaryUrl = new URL('/rum/summary', endpointRoot);
  summaryUrl.searchParams.set('siteKey', config.runtime.siteKey);
  summaryUrl.searchParams.set('conceptKey', config.runtime.conceptKey);
  summaryUrl.searchParams.set('sampleSource', sampleSource);
  summaryUrl.searchParams.set('ts', String(Date.now()));

  let conceptSummary;
  let conceptError = null;
  try {
    const conceptResponse = await fetchJson(summaryUrl.toString());
    conceptSummary = buildSummaryFromRows(
      Object.entries(conceptResponse.metrics || {}).flatMap(([metricName, metric]) => {
        const p75 = Number(metric?.p75);
        if (!Number.isFinite(p75)) return [];
        const sampleCount = Number(metric?.sampleCount || 0);
        return Array.from({ length: Math.max(sampleCount, 1) }, () => ({ metric_name: metricName, metric_value: p75 }));
      }),
      config.fieldTargets.release,
    );
    conceptSummary.generatedAt = conceptResponse.generatedAt || null;
    conceptSummary.sampleCount = conceptResponse.sampleCount || 0;
    conceptSummary.apiMetrics = conceptResponse.metrics || {};
  } catch (error) {
    conceptError = error instanceof Error ? error.message : String(error);
  }

  const flagshipPages = [];
  for (const url of config.flagshipUrls) {
    const pagePath = toConceptRelativePath(url, config.runtime.concept.siteUrl);
    const recentUrl = new URL('/rum/recent', endpointRoot);
    recentUrl.searchParams.set('siteKey', config.runtime.siteKey);
    recentUrl.searchParams.set('conceptKey', config.runtime.conceptKey);
    recentUrl.searchParams.set('sampleSource', sampleSource);
    recentUrl.searchParams.set('pagePath', pagePath);
    recentUrl.searchParams.set('limit', '1000');

    try {
      const response = await fetchJson(recentUrl.toString());
      const targets = getApplicableFieldTargets(url, config);
      const summary = buildSummaryFromRows(toMetricRows(response.rows || []), targets);
      const previousPage = previous?.flagshipPages?.find((entry) => entry.url === url);
      flagshipPages.push({
        url,
        pagePath,
        status: summary.status,
        metrics: buildMetricTable(summary.metrics, previousPage?.metrics),
        sampleCount: response.rows?.length || 0,
      });
    } catch (error) {
      flagshipPages.push({
        url,
        pagePath,
        status: 'failed',
        error: error instanceof Error ? error.message : String(error),
        metrics: [],
        sampleCount: 0,
      });
    }
  }

  const conceptMetricRows = conceptSummary
    ? buildMetricTable(conceptSummary.metrics, previous?.concept?.metrics)
    : [];
  const alerts = [];

  if (conceptError) {
    alerts.push(`Concept summary unavailable: ${conceptError}`);
  }

  for (const row of conceptMetricRows) {
    if (row.sampleCount < minSamples) {
      alerts.push(`Concept ${row.metricName} only has ${row.sampleCount} samples (< ${minSamples}).`);
    }
    if (!row.meetsTarget) {
      alerts.push(`Concept ${row.metricName} missed target (${row.p75} > ${row.target}).`);
    }
  }

  for (const page of flagshipPages) {
    if (page.error) {
      alerts.push(`Flagship ${page.url} failed to load field data: ${page.error}`);
      continue;
    }
    for (const row of page.metrics) {
      if (row.sampleCount < minSamples) {
        alerts.push(`Flagship ${page.pagePath} ${row.metricName} only has ${row.sampleCount} samples (< ${minSamples}).`);
      }
      if (!row.meetsTarget) {
        alerts.push(`Flagship ${page.pagePath} ${row.metricName} missed target (${row.p75} > ${row.target}).`);
      }
    }
  }

  const summary = {
    generatedAt: new Date().toISOString(),
    siteKey: config.runtime.siteKey,
    conceptKey: config.runtime.conceptKey,
    dashboardLabel: config.dashboardLabel,
    sampleSource,
    strict: options.strict,
    minSamples,
    concept: conceptSummary
      ? {
          status: conceptSummary.status,
          generatedAt: conceptSummary.generatedAt,
          sampleCount: conceptSummary.sampleCount,
          metrics: Object.fromEntries(conceptMetricRows.map((row) => [row.metricName, row])),
        }
      : null,
    flagshipPages,
    alerts,
  };

  const markdown = [
    '# Field Performance Report',
    '',
    `Generated: ${summary.generatedAt}`,
    `Scope: ${summary.siteKey}/${summary.conceptKey}`,
    `Sample source: ${summary.sampleSource}`,
    `Minimum samples: ${summary.minSamples}`,
    '',
    '## Concept summary',
    '',
    summary.concept ? `- Status: ${summary.concept.status}` : `- Status: failed (${conceptError})`,
    '',
    '| Metric | p75 | Samples | Target | Rating | Meets target | Trend |',
    '| --- | ---: | ---: | ---: | --- | --- | --- |',
    summary.concept ? renderMetricRows(conceptMetricRows) : '| - | - | - | - | - | - | - |',
    '',
    '## Flagship pages',
    '',
    ...flagshipPages.flatMap((page) => [
      `### ${page.url}`,
      '',
      page.error ? `- Status: failed (${page.error})` : `- Status: ${page.status}`,
      page.error
        ? ''
        : ['| Metric | p75 | Samples | Target | Rating | Meets target | Trend |', '| --- | ---: | ---: | ---: | --- | --- | --- |', renderMetricRows(page.metrics), ''].join('\n'),
    ]),
    '## Alerts',
    '',
    ...(alerts.length ? alerts.map((alert) => `- ${alert}`) : ['- No active field alerts.']),
  ].join('\n');

  const paths = writeReportArtifacts(repoRoot, 'field-performance', summary, markdown, config.outputScope);
  console.log(`Field-performance report written to ${paths.latestMarkdownPath}`);

  if (options.strict && alerts.length) {
    throw new Error(`Field-performance gate failed. See ${paths.latestMarkdownPath}`);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack || error.message : String(error));
  process.exit(1);
});
