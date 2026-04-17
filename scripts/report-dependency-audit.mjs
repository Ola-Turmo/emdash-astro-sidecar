#!/usr/bin/env node

import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { writeReportArtifacts } from './lib/report-artifacts.mjs';
import { loadRuntimeQualityConfig } from './lib/runtime-quality.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');

function parseArgs(argv) {
  return { strict: argv.includes('--strict') };
}

function pnpmCommand() {
  return process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm';
}

function parseAuditPayload(raw) {
  const text = String(raw || '').trim();
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    const start = text.indexOf('{');
    const end = text.lastIndexOf('}');
    if (start >= 0 && end > start) {
      return JSON.parse(text.slice(start, end + 1));
    }
    return {};
  }
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const config = loadRuntimeQualityConfig(process.env);
  let payload = {};
  let failed = false;
  let errorMessage = null;

  try {
    const raw = execFileSync(pnpmCommand(), ['audit', '--prod', '--json'], {
      cwd: repoRoot,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    payload = parseAuditPayload(raw);
  } catch (error) {
    failed = true;
    payload = parseAuditPayload(error.stdout || error.stderr || '');
    errorMessage = error instanceof Error ? error.message : String(error);
  }

  const advisories = payload.advisories ? Object.values(payload.advisories) : [];
  const highOrCritical = advisories.filter((advisory) => ['high', 'critical'].includes(String(advisory.severity || '').toLowerCase()));
  const summary = {
    generatedAt: new Date().toISOString(),
    siteKey: config.runtime.siteKey,
    conceptKey: config.runtime.conceptKey,
    dashboardLabel: config.dashboardLabel,
    strict: options.strict,
    failed,
    errorMessage,
    advisoryCount: advisories.length,
    highOrCriticalCount: highOrCritical.length,
    advisories: highOrCritical.map((advisory) => ({
      moduleName: advisory.module_name,
      severity: advisory.severity,
      title: advisory.title,
      recommendation: advisory.recommendation,
      vulnerableVersions: advisory.vulnerable_versions,
    })),
  };

  const markdown = [
    '# Dependency Audit Report',
    '',
    `Generated: ${summary.generatedAt}`,
    `Scope: ${summary.siteKey}/${summary.conceptKey}`,
    `High/critical advisories: ${summary.highOrCriticalCount}`,
    '',
    ...(summary.advisories.length
      ? summary.advisories.map((advisory) => `- [${advisory.severity}] ${advisory.moduleName}: ${advisory.title}`)
      : ['- No high/critical advisories found.']),
  ].join('\n');

  const paths = writeReportArtifacts(repoRoot, 'dependency-audit', summary, markdown, config.outputScope);
  console.log(`Dependency audit report written to ${paths.latestMarkdownPath}`);

  if (options.strict && summary.highOrCriticalCount > 0) {
    throw new Error(`Dependency audit found ${summary.highOrCriticalCount} high/critical advisories.`);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack || error.message : String(error));
  process.exit(1);
});
