#!/usr/bin/env node

import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');

function parseArgs(argv) {
  const options = { urls: [] };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--url' && argv[index + 1]) {
      options.urls.push(argv[index + 1]);
      index += 1;
    }
  }
  return options;
}

async function loadDefaultUrls() {
  const siteConfigModule = await import(pathToFileURL(path.join(repoRoot, 'apps/blog/src/site-config.ts')).href);
  return [
    ...new Set(
      [
        siteConfigModule.MAIN_SITE_URL,
        siteConfigModule.SITE_URL,
        ...(siteConfigModule.DEPLOY_AUDIT_EXTRA_URLS || []),
      ].filter(Boolean),
    ),
  ];
}

function hasPolicyValue(value) {
  return Boolean(value && value.trim().length > 0);
}

async function inspectUrl(url) {
  const response = await fetch(url, { redirect: 'follow' });
  const headers = response.headers;
  const findings = [];

  if (response.status >= 400) findings.push(`HTTP ${response.status}`);
  if (!url.startsWith('https://')) findings.push('URL is not HTTPS');

  const hsts = headers.get('strict-transport-security');
  const csp = headers.get('content-security-policy');
  const referrerPolicy = headers.get('referrer-policy');
  const permissionsPolicy = headers.get('permissions-policy');
  const contentTypeOptions = headers.get('x-content-type-options');

  if (!hasPolicyValue(hsts)) findings.push('Missing Strict-Transport-Security');
  if (!hasPolicyValue(csp)) findings.push('Missing Content-Security-Policy');
  if (!hasPolicyValue(referrerPolicy)) findings.push('Missing Referrer-Policy');
  if (!hasPolicyValue(permissionsPolicy)) findings.push('Missing Permissions-Policy');
  if ((contentTypeOptions || '').toLowerCase() !== 'nosniff') findings.push('Missing X-Content-Type-Options: nosniff');

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
  };
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const urls = options.urls.length ? options.urls : await loadDefaultUrls();
  if (!urls.length) {
    throw new Error('No URLs configured for security header checks.');
  }

  const results = [];
  for (const url of urls) {
    results.push(await inspectUrl(url));
  }

  const summary = {
    generatedAt: new Date().toISOString(),
    results,
  };

  console.log(JSON.stringify(summary, null, 2));

  const failures = results.flatMap((result) => result.findings.map((finding) => `${result.url}: ${finding}`));
  if (failures.length) {
    throw new Error(`Security header gate failed:\n- ${failures.join('\n- ')}`);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack || error.message : String(error));
  process.exit(1);
});
