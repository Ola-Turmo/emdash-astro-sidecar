#!/usr/bin/env node

import { exec, execFile } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { chromium } from 'playwright';

const execAsync = promisify(exec);
const execFileAsync = promisify(execFile);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');
const localToolRoot = path.join(process.env.LOCALAPPDATA || os.tmpdir(), 'emdash-astro-sidecar-tools');
const LIGHTHOUSE_VERSION = '13.1.0';
const LIGHTHOUSE_TOOL_DIR = path.join(localToolRoot, `lighthouse-${LIGHTHOUSE_VERSION}`);
const LIGHTHOUSE_CLI_PATH = path.join(LIGHTHOUSE_TOOL_DIR, 'node_modules', 'lighthouse', 'cli', 'index.js');
const LIGHTHOUSE_TMP_DIR = path.join(LIGHTHOUSE_TOOL_DIR, 'tmp');
const outputDir = path.join(repoRoot, 'output', 'lighthouse-budgets');

const DEFAULT_THRESHOLDS = {
  performance: 90,
  accessibility: 90,
  seo: 90,
  bestPractices: 90,
  tbt: 200,
};

function parseArgs(argv) {
  const options = {
    urls: [],
    strategy: 'mobile',
    runs: 1,
    warmupRuns: 0,
    thresholds: { ...DEFAULT_THRESHOLDS },
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--url' && argv[index + 1]) {
      options.urls.push(argv[index + 1]);
      index += 1;
      continue;
    }
    if (arg === '--strategy' && argv[index + 1]) {
      options.strategy = argv[index + 1];
      index += 1;
      continue;
    }
    if (arg === '--runs' && argv[index + 1]) {
      options.runs = Math.max(1, Number(argv[index + 1]) || 1);
      index += 1;
      continue;
    }
    if (arg === '--warmup-runs' && argv[index + 1]) {
      options.warmupRuns = Math.max(0, Number(argv[index + 1]) || 0);
      index += 1;
    }
  }

  return options;
}

function npmCommand() {
  return process.platform === 'win32' ? 'npm.cmd' : 'npm';
}

function slugifyUrl(url) {
  return url
    .replace(/^https?:\/\//, '')
    .replace(/[^\w/-]+/g, '-')
    .replace(/[\\/]+/g, '__')
    .replace(/-+/g, '-')
    .replace(/^[-_]+|[-_]+$/g, '');
}

async function ensureLocalLighthouseCli() {
  if (existsSync(LIGHTHOUSE_CLI_PATH)) {
    return LIGHTHOUSE_CLI_PATH;
  }

  await mkdir(LIGHTHOUSE_TOOL_DIR, { recursive: true });
  await mkdir(LIGHTHOUSE_TMP_DIR, { recursive: true });

  const packageJsonPath = path.join(LIGHTHOUSE_TOOL_DIR, 'package.json');
  if (!existsSync(packageJsonPath)) {
    await writeFile(
      packageJsonPath,
      JSON.stringify({ name: 'emdash-lighthouse-runtime', private: true, type: 'module' }, null, 2),
      'utf8',
    );
  }

  await execAsync(`${npmCommand()} install --no-save --no-fund --no-audit lighthouse@${LIGHTHOUSE_VERSION}`, {
    cwd: LIGHTHOUSE_TOOL_DIR,
    windowsHide: true,
    maxBuffer: 20 * 1024 * 1024,
  });

  return LIGHTHOUSE_CLI_PATH;
}

async function loadDefaultUrls() {
  const siteConfigModule = await import(pathToFileURL(path.join(repoRoot, 'apps/blog/src/site-config.ts')).href);
  const urls = [siteConfigModule.SITE_URL, ...(siteConfigModule.DEPLOY_AUDIT_EXTRA_URLS || [])].filter(Boolean);
  return {
    urls: [...new Set(urls)],
    runs: Number(siteConfigModule.LIGHTHOUSE_AUDIT_RUNS || 1),
    warmupRuns: Number(siteConfigModule.LIGHTHOUSE_AUDIT_WARMUP_RUNS || 0),
  };
}

async function runLighthouse(url, strategy) {
  const cliPath = await ensureLocalLighthouseCli();
  await mkdir(outputDir, { recursive: true });
  const reportPath = path.join(outputDir, `${slugifyUrl(url)}-${strategy}.json`);
  const args = [
    cliPath,
    url,
    '--quiet',
    '--output=json',
    `--output-path=${reportPath}`,
    '--only-categories=performance,accessibility,best-practices,seo',
    `--chrome-path=${chromium.executablePath()}`,
    '--chrome-flags=--headless=new --no-sandbox --disable-dev-shm-usage',
  ];

  if (strategy === 'desktop') {
    args.push('--preset=desktop');
  }

  try {
    await execFileAsync(process.execPath, args, {
      cwd: LIGHTHOUSE_TOOL_DIR,
      windowsHide: true,
      maxBuffer: 40 * 1024 * 1024,
      env: {
        ...process.env,
        TMP: LIGHTHOUSE_TMP_DIR,
        TEMP: LIGHTHOUSE_TMP_DIR,
      },
    });
    return {
      report: JSON.parse(await readFile(reportPath, 'utf8')),
      warning: null,
    };
  } catch (error) {
    if (existsSync(reportPath)) {
      return {
        report: JSON.parse(await readFile(reportPath, 'utf8')),
        warning: summarizeLighthouseWarning(error),
      };
    }
    throw error;
  }
}

function summarizeLighthouseWarning(error) {
  const message = error instanceof Error ? error.message : String(error);
  if (/EPERM/i.test(message) && /lighthouse\./i.test(message)) {
    return 'Lighthouse produced a valid report, but Windows blocked temp-folder cleanup after the run.';
  }
  const firstLine = message.split(/\r?\n/).find((line) => line.trim());
  return firstLine || 'Lighthouse returned a valid report with a non-zero exit code.';
}

function toScore(score) {
  return typeof score === 'number' ? Math.round(score * 100) : null;
}

function median(values) {
  if (!values.length) return null;
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) {
    return sorted[middle];
  }
  return Math.round((sorted[middle - 1] + sorted[middle]) / 2);
}

function evaluateBudgets(url, strategy, lighthouseResult, thresholds) {
  const categories = lighthouseResult.report?.categories || {};
  const audits = lighthouseResult.report?.audits || {};
  const result = {
    url,
    strategy,
    performance: toScore(categories.performance?.score),
    accessibility: toScore(categories.accessibility?.score),
    seo: toScore(categories.seo?.score),
    bestPractices: toScore(categories['best-practices']?.score),
    tbt: Math.round(audits['total-blocking-time']?.numericValue ?? 0),
    warning: lighthouseResult.warning || null,
    findings: [],
  };

  if ((result.performance ?? 0) < thresholds.performance) {
    result.findings.push(`Performance ${result.performance} < ${thresholds.performance}`);
  }
  if ((result.accessibility ?? 0) < thresholds.accessibility) {
    result.findings.push(`Accessibility ${result.accessibility} < ${thresholds.accessibility}`);
  }
  if ((result.seo ?? 0) < thresholds.seo) {
    result.findings.push(`SEO ${result.seo} < ${thresholds.seo}`);
  }
  if ((result.bestPractices ?? 0) < thresholds.bestPractices) {
    result.findings.push(`Best Practices ${result.bestPractices} < ${thresholds.bestPractices}`);
  }
  if (result.tbt > thresholds.tbt) {
    result.findings.push(`TBT ${result.tbt}ms > ${thresholds.tbt}ms`);
  }

  return result;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (!options.urls.length) {
    const defaults = await loadDefaultUrls();
    options.urls = defaults.urls;
    if (!process.argv.slice(2).includes('--runs')) {
      options.runs = Math.max(1, defaults.runs);
    }
    if (!process.argv.slice(2).includes('--warmup-runs')) {
      options.warmupRuns = Math.max(0, defaults.warmupRuns);
    }
  }
  const urls = options.urls;
  if (!urls.length) {
    throw new Error('No URLs to audit. Provide --url or configure concept audit URLs.');
  }

  const results = [];
  for (const url of urls) {
    for (let warmupIndex = 0; warmupIndex < options.warmupRuns; warmupIndex += 1) {
      await runLighthouse(url, options.strategy);
    }

    const measuredRuns = [];
    for (let runIndex = 0; runIndex < options.runs; runIndex += 1) {
      const result = await runLighthouse(url, options.strategy);
      measuredRuns.push(evaluateBudgets(url, options.strategy, result, options.thresholds));
    }

    if (measuredRuns.length === 1) {
      results.push(measuredRuns[0]);
      continue;
    }

    const aggregated = {
      url,
      strategy: options.strategy,
      performance: median(measuredRuns.map((run) => run.performance).filter((value) => value !== null)),
      accessibility: median(measuredRuns.map((run) => run.accessibility).filter((value) => value !== null)),
      seo: median(measuredRuns.map((run) => run.seo).filter((value) => value !== null)),
      bestPractices: median(measuredRuns.map((run) => run.bestPractices).filter((value) => value !== null)),
      tbt: median(measuredRuns.map((run) => run.tbt)),
      warning: measuredRuns.map((run) => run.warning).filter(Boolean).join(' | ') || null,
      findings: [],
      runs: measuredRuns,
    };

    if ((aggregated.performance ?? 0) < options.thresholds.performance) {
      aggregated.findings.push(`Performance ${aggregated.performance} < ${options.thresholds.performance}`);
    }
    if ((aggregated.accessibility ?? 0) < options.thresholds.accessibility) {
      aggregated.findings.push(`Accessibility ${aggregated.accessibility} < ${options.thresholds.accessibility}`);
    }
    if ((aggregated.seo ?? 0) < options.thresholds.seo) {
      aggregated.findings.push(`SEO ${aggregated.seo} < ${options.thresholds.seo}`);
    }
    if ((aggregated.bestPractices ?? 0) < options.thresholds.bestPractices) {
      aggregated.findings.push(`Best Practices ${aggregated.bestPractices} < ${options.thresholds.bestPractices}`);
    }
    if ((aggregated.tbt ?? 0) > options.thresholds.tbt) {
      aggregated.findings.push(`TBT ${aggregated.tbt}ms > ${options.thresholds.tbt}ms`);
    }

    results.push(aggregated);
  }

  const summary = {
    generatedAt: new Date().toISOString(),
    strategy: options.strategy,
    runs: options.runs,
    warmupRuns: options.warmupRuns,
    thresholds: options.thresholds,
    results,
  };

  await mkdir(outputDir, { recursive: true });
  await writeFile(path.join(outputDir, 'latest.json'), JSON.stringify(summary, null, 2), 'utf8');

  console.log(JSON.stringify(summary, null, 2));

  const failures = results.flatMap((result) => result.findings.map((finding) => `${result.url}: ${finding}`));
  if (failures.length) {
    throw new Error(`Lighthouse budget gate failed:\n- ${failures.join('\n- ')}`);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack || error.message : String(error));
  process.exit(1);
});
