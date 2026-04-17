#!/usr/bin/env node

import { execFile } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import { getSecretValue } from './local-secret-store.mjs';
import { writeReportArtifacts } from './lib/report-artifacts.mjs';
import { loadRuntimeQualityConfig } from './lib/runtime-quality.mjs';

const execFileAsync = promisify(execFile);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');

function parseArgs(argv) {
  return {
    refresh: argv.includes('--refresh'),
  };
}

function pnpmCommand() {
  return process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm';
}

async function runReport(command) {
  try {
    await execFileAsync(pnpmCommand(), command, {
      cwd: repoRoot,
      maxBuffer: 20 * 1024 * 1024,
    });
    return { command: `pnpm ${command.join(' ')}`, ok: true };
  } catch (error) {
    return {
      command: `pnpm ${command.join(' ')}`,
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

function readSummary(reportName, scope, scoped = true) {
  const summaryPath = scoped
    ? path.join(repoRoot, 'output', reportName, ...scope, 'latest', 'summary.json')
    : path.join(repoRoot, 'output', reportName, 'latest', 'summary.json');
  if (!existsSync(summaryPath)) {
    return null;
  }
  return JSON.parse(readFileSync(summaryPath, 'utf8'));
}

function gateStatus(summary, fallbackFindings = []) {
  if (!summary) return { status: 'skipped', findings: [] };
  const findings = summary.findings || fallbackFindings;
  return {
    status: findings.length ? 'alert' : 'ok',
    findings,
  };
}

function buildRefreshCandidates({ traffic, lighthouse, crawlability, field }) {
  const candidates = [];
  const trafficPaths = traffic?.topOrganicLandingPages || [];
  for (const landingPage of trafficPaths.slice(0, 8)) {
    const reasons = [];
    const lighthouseResult = lighthouse?.results?.find((entry) => entry.url.endsWith(landingPage.key || entry.url));
    if (lighthouseResult?.findings?.length) {
      reasons.push('Lighthouse budgets regressed');
    }
    const crawlResult = crawlability?.pages?.find((entry) => entry.url.endsWith(landingPage.key));
    if (crawlResult?.internalLinkCount < 3) {
      reasons.push('weak internal-link support');
    }
    const fieldResult = field?.flagshipPages?.find((entry) => entry.pagePath === landingPage.key);
    if (fieldResult?.status && fieldResult.status !== 'good') {
      reasons.push('field performance missed target');
    }

    if (reasons.length) {
      candidates.push({ path: landingPage.key, requests: landingPage.count, reasons });
    }
  }
  return candidates;
}

async function loadOptionalObservability() {
  const contentApiUrl = getSecretValue('CONTENT_API_URL');
  const contentApiToken = getSecretValue('CONTENT_API_TOKEN');
  if (!contentApiUrl || !contentApiToken) {
    return null;
  }

  try {
    const response = await fetch(new URL('/observability/summary', contentApiUrl), {
      headers: {
        authorization: `Bearer ${contentApiToken}`,
        'cache-control': 'no-store',
      },
    });
    if (!response.ok) {
      return { error: `HTTP ${response.status}` };
    }
    return response.json();
  } catch (error) {
    return { error: error instanceof Error ? error.message : String(error) };
  }
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const config = loadRuntimeQualityConfig(process.env);
  const refreshResults = [];

  if (options.refresh) {
    for (const command of [
      ['report:field'],
      ['report:lighthouse'],
      ['report:accessibility'],
      ['report:security'],
      ['proof:rum'],
      ['report:google-public'],
      ['report:traffic'],
      ['report:structured-data'],
      ['report:crawlability'],
      ['report:parity'],
      ['report:deps'],
    ]) {
      refreshResults.push(await runReport(command));
    }
  }

  const field = readSummary('field-performance', config.outputScope);
  const lighthouse = readSummary('lighthouse-budgets', config.outputScope);
  const accessibility = readSummary('accessibility', config.outputScope);
  const security = readSummary('security-headers', config.outputScope);
  const structuredData = readSummary('structured-data', config.outputScope);
  const crawlability = readSummary('crawlability', config.outputScope);
  const parity = readSummary('edge-parity', config.outputScope);
  const dependencyAudit = readSummary('dependency-audit', config.outputScope);
  const googlePublic = readSummary('google-public-signals', config.outputScope, false) || readSummary('google-public-signals', [], false);
  const traffic = readSummary('edge-traffic', config.outputScope, false) || readSummary('edge-traffic', [], false);
  const observability = await loadOptionalObservability();

  const gates = {
    field: gateStatus(field),
    lighthouse: gateStatus(lighthouse),
    accessibility: gateStatus(accessibility),
    security: gateStatus(security),
    structuredData: gateStatus(structuredData),
    crawlability: gateStatus(crawlability),
    parity: gateStatus(parity),
    dependencyAudit: gateStatus(dependencyAudit, dependencyAudit?.advisories || []),
  };

  const refreshCandidates = buildRefreshCandidates({
    traffic,
    lighthouse,
    crawlability,
    field,
  });

  const alerts = Object.entries(gates)
    .flatMap(([gateName, gate]) => gate.findings.map((finding) => `[${gateName}] ${finding}`))
    .concat(refreshResults.filter((result) => !result.ok).map((result) => `[refresh] ${result.command}: ${result.error}`));

  const summary = {
    generatedAt: new Date().toISOString(),
    siteKey: config.runtime.siteKey,
    conceptKey: config.runtime.conceptKey,
    dashboardLabel: config.dashboardLabel,
    publishPolicy: config.publishPolicy,
    refreshResults,
    gates,
    refreshCandidates,
    trafficSummary: traffic
      ? {
          totalRequests: traffic.totalRequests,
          topOrganicLandingPages: traffic.topOrganicLandingPages?.slice(0, 8) || [],
        }
      : null,
    observability,
    alerts,
  };

  const markdown = [
    '# Release Health Dashboard',
    '',
    `Generated: ${summary.generatedAt}`,
    `Scope: ${summary.siteKey}/${summary.conceptKey}`,
    '',
    '## Gate status',
    '',
    '| Gate | Status | Findings |',
    '| --- | --- | ---: |',
    ...Object.entries(gates).map(([name, gate]) => `| ${name} | ${gate.status} | ${gate.findings.length} |`),
    '',
    '## Publish policy',
    '',
    ...(summary.publishPolicy.length ? summary.publishPolicy.map((item) => `- ${item}`) : ['- No publish policy configured.']),
    '',
    '## Refresh candidates',
    '',
    ...(refreshCandidates.length
      ? refreshCandidates.map((candidate) => `- ${candidate.path} (${candidate.requests} requests): ${candidate.reasons.join(', ')}`)
      : ['- No telemetry-driven refresh candidates right now.']),
    '',
    '## Alerts',
    '',
    ...(alerts.length ? alerts.map((alert) => `- ${alert}`) : ['- No active release alerts.']),
    '',
    '## Optional observability',
    '',
    observability?.error
      ? `- Observability summary unavailable: ${observability.error}`
      : observability
        ? `- Hosts tracked: ${(observability.hosts || []).length}`
        : '- CONTENT_API_URL / CONTENT_API_TOKEN not configured; host-state visibility is skipped in this environment.',
  ].join('\n');

  const paths = writeReportArtifacts(repoRoot, 'release-health', summary, markdown, config.outputScope);
  console.log(`Release health dashboard written to ${paths.latestMarkdownPath}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack || error.message : String(error));
  process.exit(1);
});
