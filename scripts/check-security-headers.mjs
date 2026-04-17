#!/usr/bin/env node

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadPreviousSummary, summarizeTrend, writeReportArtifacts } from './lib/report-artifacts.mjs';
import { loadRuntimeQualityConfig } from './lib/runtime-quality.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');

const REQUIRED_CSP_DIRECTIVES = ['default-src', 'base-uri', 'object-src', 'frame-ancestors', 'form-action'];
const RECOMMENDED_CSP_TOKENS = [
  { directive: 'default-src', token: "'self'" },
  { directive: 'base-uri', token: "'self'" },
  { directive: 'object-src', token: "'none'" },
  { directive: 'upgrade-insecure-requests', token: null },
];

function parseArgs(argv) {
  const options = { urls: [], strict: argv.includes('--strict') };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--url' && argv[index + 1]) {
      options.urls.push(argv[index + 1]);
      index += 1;
    }
  }
  return options;
}

function hasPolicyValue(value) {
  return Boolean(value && value.trim().length > 0);
}

function parseCsp(value) {
  if (!value) return {};
  return Object.fromEntries(
    value
      .split(';')
      .map((segment) => segment.trim())
      .filter(Boolean)
      .map((segment) => {
        const [directive, ...sources] = segment.split(/\s+/);
        return [directive, sources];
      }),
  );
}

async function inspectUrl(url, previousResult) {
  const response = await fetch(url, { redirect: 'follow' });
  const headers = response.headers;
  const findings = [];
  const warnings = [];

  if (response.status >= 400) findings.push(`HTTP ${response.status}`);
  if (!url.startsWith('https://')) findings.push('URL is not HTTPS');

  const hsts = headers.get('strict-transport-security');
  const csp = headers.get('content-security-policy');
  const referrerPolicy = headers.get('referrer-policy');
  const permissionsPolicy = headers.get('permissions-policy');
  const contentTypeOptions = headers.get('x-content-type-options');
  const cspDirectives = parseCsp(csp);

  if (!hasPolicyValue(hsts)) findings.push('Missing Strict-Transport-Security');
  if (!hasPolicyValue(csp)) findings.push('Missing Content-Security-Policy');
  if (!hasPolicyValue(referrerPolicy)) findings.push('Missing Referrer-Policy');
  if (!hasPolicyValue(permissionsPolicy)) findings.push('Missing Permissions-Policy');
  if ((contentTypeOptions || '').toLowerCase() !== 'nosniff') findings.push('Missing X-Content-Type-Options: nosniff');

  for (const directive of REQUIRED_CSP_DIRECTIVES) {
    if (!cspDirectives[directive]) {
      findings.push(`CSP missing ${directive}`);
    }
  }

  for (const rule of RECOMMENDED_CSP_TOKENS) {
    if (rule.token === null) {
      if (!Object.prototype.hasOwnProperty.call(cspDirectives, rule.directive)) {
        findings.push(`CSP missing ${rule.directive}`);
      }
      continue;
    }
    if (!cspDirectives[rule.directive]?.includes(rule.token)) {
      findings.push(`CSP ${rule.directive} should include ${rule.token}`);
    }
  }

  if (cspDirectives['script-src']?.includes("'unsafe-inline'")) {
    warnings.push("CSP script-src still allows 'unsafe-inline'");
  }
  if (cspDirectives['style-src']?.includes("'unsafe-inline'")) {
    warnings.push("CSP style-src still allows 'unsafe-inline'");
  }

  return {
    url,
    status: response.status,
    headers: {
      strictTransportSecurity: hsts,
      contentSecurityPolicy: csp,
      referrerPolicy,
      permissionsPolicy,
      xContentTypeOptions: contentTypeOptions,
    },
    findings,
    warnings,
    trends: {
      findingCount: summarizeTrend(findings.length, previousResult?.findings?.length, true),
    },
  };
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const config = loadRuntimeQualityConfig(process.env);
  const previous = loadPreviousSummary(repoRoot, 'security-headers', config.outputScope);
  const urls = options.urls.length ? options.urls : [...new Set([config.runtime.site.brand.mainSiteUrl, ...config.auditUrls])];
  if (!urls.length) {
    throw new Error('No URLs configured for security header checks.');
  }

  const results = [];
  for (const url of urls) {
    const previousResult = previous?.results?.find((entry) => entry.url === url);
    results.push(await inspectUrl(url, previousResult));
  }

  const summary = {
    generatedAt: new Date().toISOString(),
    siteKey: config.runtime.siteKey,
    conceptKey: config.runtime.conceptKey,
    dashboardLabel: config.dashboardLabel,
    strict: options.strict,
    results,
    findings: results.flatMap((result) => result.findings.map((finding) => `${result.url}: ${finding}`)),
    warnings: results.flatMap((result) => result.warnings.map((warning) => `${result.url}: ${warning}`)),
  };

  const markdown = [
    '# Security Header Report',
    '',
    `Generated: ${summary.generatedAt}`,
    `Scope: ${summary.siteKey}/${summary.conceptKey}`,
    '',
    '| URL | Status | Findings | Warnings |',
    '| --- | ---: | ---: | ---: |',
    ...results.map((result) => `| ${result.url} | ${result.status} | ${result.findings.length} | ${result.warnings.length} |`),
    '',
    '## Blocking findings',
    '',
    ...(summary.findings.length ? summary.findings.map((finding) => `- ${finding}`) : ['- No blocking security header findings.']),
    '',
    '## Warnings / allowed exceptions to review',
    '',
    ...(summary.warnings.length ? summary.warnings.map((warning) => `- ${warning}`) : ['- No CSP exception warnings.']),
  ].join('\n');

  const paths = writeReportArtifacts(repoRoot, 'security-headers', summary, markdown, config.outputScope);
  console.log(`Security report written to ${paths.latestMarkdownPath}`);

  if (options.strict && summary.findings.length) {
    throw new Error(`Security header gate failed. See ${paths.latestMarkdownPath}`);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack || error.message : String(error));
  process.exit(1);
});
