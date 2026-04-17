#!/usr/bin/env node

import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getConceptOutputDir, resolveActiveSiteRuntime } from '../apps/blog/site-profiles.mjs';
import { writeReportArtifacts } from './lib/report-artifacts.mjs';
import { loadRuntimeQualityConfig } from './lib/runtime-quality.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');

function parseArgs(argv) {
  return { strict: argv.includes('--strict') };
}

function readMeta(html, name, attribute = 'name') {
  const pattern = new RegExp(`<meta[^>]+${attribute}=["']${name}["'][^>]+content=["']([^"']+)["']`, 'i');
  return html.match(pattern)?.[1] ?? null;
}

function readCanonical(html, baseUrl) {
  const raw = html.match(/<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)["']/i)?.[1] ?? null;
  if (!raw) return null;
  return new URL(raw, baseUrl).toString();
}

function readTitle(html) {
  return html.match(/<title[^>]*>(.*?)<\/title>/is)?.[1]?.replace(/\s+/g, ' ').trim() ?? null;
}

function countJsonLd(html) {
  return [...html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>/gi)].length;
}

function readNavLabels(html) {
  return [...html.matchAll(/<a[^>]*>(.*?)<\/a>/gis)]
    .map((match) => match[1].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .slice(0, 10);
}

function urlToDistPath(url, runtime) {
  const distRoot = path.join(
    repoRoot,
    'apps/blog',
    getConceptOutputDir(runtime.siteKey, runtime.conceptKey).replace(/^\.\//u, ''),
  );
  const parsed = new URL(url);
  let pathname = parsed.pathname;
  if (!pathname.startsWith(runtime.concept.basePath)) {
    throw new Error(`URL ${url} does not live under concept base path ${runtime.concept.basePath}`);
  }
  pathname = pathname.slice(runtime.concept.basePath.length) || '/';
  const normalized = pathname === '/' ? '' : pathname.replace(/^\//, '').replace(/\/$/, '');
  return normalized ? path.join(distRoot, normalized, 'index.html') : path.join(distRoot, 'index.html');
}

async function inspectParity(url, runtime) {
  const localPath = urlToDistPath(url, runtime);
  if (!existsSync(localPath)) {
    return {
      url,
      localPath,
      findings: [`Missing local build artifact: ${path.relative(repoRoot, localPath)}`],
    };
  }

  const localHtml = readFileSync(localPath, 'utf8');
  const response = await fetch(url, { redirect: 'follow' });
  const liveHtml = await response.text();
  const findings = [];

  const localTitle = readTitle(localHtml);
  const liveTitle = readTitle(liveHtml);
  if (localTitle !== liveTitle) findings.push(`Title mismatch (${localTitle || '-'} vs ${liveTitle || '-'})`);

  const localDescription = readMeta(localHtml, 'description');
  const liveDescription = readMeta(liveHtml, 'description');
  if (localDescription !== liveDescription) findings.push('Meta description mismatch');

  const localCanonical = readCanonical(localHtml, url);
  const liveCanonical = readCanonical(liveHtml, response.url || url);
  if (localCanonical !== liveCanonical) findings.push('Canonical mismatch');

  const localOgImage = readMeta(localHtml, 'og:image', 'property');
  const liveOgImage = readMeta(liveHtml, 'og:image', 'property');
  if (localOgImage !== liveOgImage) findings.push('og:image mismatch');

  const localJsonLd = countJsonLd(localHtml);
  const liveJsonLd = countJsonLd(liveHtml);
  if (localJsonLd !== liveJsonLd) findings.push(`JSON-LD block count mismatch (${localJsonLd} vs ${liveJsonLd})`);

  const localNav = readNavLabels(localHtml).slice(0, 5).join(' | ');
  const liveNav = readNavLabels(liveHtml).slice(0, 5).join(' | ');
  if (localNav !== liveNav) findings.push('Primary navigation content mismatch');

  return {
    url,
    localPath: path.relative(repoRoot, localPath),
    status: response.status,
    findings,
  };
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const config = loadRuntimeQualityConfig(process.env);
  const runtime = resolveActiveSiteRuntime(process.env);
  const results = [];
  for (const url of config.auditUrls) {
    results.push(await inspectParity(url, runtime));
  }

  const findings = results.flatMap((result) => result.findings.map((finding) => `${result.url}: ${finding}`));
  const summary = {
    generatedAt: new Date().toISOString(),
    siteKey: config.runtime.siteKey,
    conceptKey: config.runtime.conceptKey,
    dashboardLabel: config.dashboardLabel,
    strict: options.strict,
    results,
    findings,
  };

  const markdown = [
    '# Astro / Edge Parity Report',
    '',
    `Generated: ${summary.generatedAt}`,
    `Scope: ${summary.siteKey}/${summary.conceptKey}`,
    '',
    '| URL | Local artifact | Status | Result |',
    '| --- | --- | ---: | --- |',
    ...results.map((result) => `| ${result.url} | ${result.localPath} | ${result.status ?? '-'} | ${result.findings.length ? 'alert' : 'ok'} |`),
    '',
    '## Findings',
    '',
    ...(findings.length ? findings.map((finding) => `- ${finding}`) : ['- Live edge pages match local Astro output for tracked parity signals.']),
  ].join('\n');

  const paths = writeReportArtifacts(repoRoot, 'edge-parity', summary, markdown, config.outputScope);
  console.log(`Parity report written to ${paths.latestMarkdownPath}`);

  if (options.strict && findings.length) {
    throw new Error(`Edge parity gate failed. See ${paths.latestMarkdownPath}`);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack || error.message : String(error));
  process.exit(1);
});
