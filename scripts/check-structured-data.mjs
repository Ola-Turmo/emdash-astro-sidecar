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
const ACCEPTABLE_TYPES = new Set([
  'WebSite',
  'WebPage',
  'CollectionPage',
  'BreadcrumbList',
  'Article',
  'BlogPosting',
  'TechArticle',
  'HowTo',
  'FAQPage',
  'Organization',
]);
const ARTICLE_LIKE_TYPES = new Set(['Article', 'BlogPosting', 'TechArticle', 'HowTo']);

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

function extractJsonLd(html) {
  return [...html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)].map((match) => match[1]);
}

function normalizeTypes(value) {
  const types = Array.isArray(value) ? value : [value];
  return types.filter((entry) => typeof entry === 'string');
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
  const normalized = pathname === '/' ? '' : pathname.replace(/^\//u, '').replace(/\/$/u, '');
  return normalized ? path.join(distRoot, normalized, 'index.html') : path.join(distRoot, 'index.html');
}

function inspectHtml(url, html, status, source) {
  const findings = [];
  const scripts = extractJsonLd(html);
  const parsedBlocks = [];

  for (const block of scripts) {
    try {
      const parsed = JSON.parse(block.trim());
      const entries = Array.isArray(parsed) ? parsed : [parsed];
      for (const entry of entries) {
        parsedBlocks.push({
          context: entry?.['@context'] ?? null,
          types: normalizeTypes(entry?.['@type']),
          headline: entry?.headline ?? null,
          name: entry?.name ?? null,
        });
      }
    } catch (error) {
      findings.push(`Invalid JSON-LD block: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  if (!scripts.length) {
    findings.push('Missing JSON-LD structured data');
  }

  if (parsedBlocks.length && parsedBlocks.every((block) => !block.context)) {
    findings.push('Structured data is missing @context');
  }

  const allTypes = parsedBlocks.flatMap((block) => block.types);
  if (parsedBlocks.length && !allTypes.some((type) => ACCEPTABLE_TYPES.has(type))) {
    findings.push(`Structured data types are not in the supported validation set: ${allTypes.join(', ') || 'none'}`);
  }

  const expectsArticle = /\/blog\//.test(new URL(url).pathname);
  if (expectsArticle && !allTypes.some((type) => ARTICLE_LIKE_TYPES.has(type))) {
    findings.push('Article-like URL is missing article structured data (Article, BlogPosting, TechArticle, or HowTo)');
  }

  return {
    url,
    status,
    source,
    blockCount: scripts.length,
    types: [...new Set(allTypes)],
    findings,
  };
}

async function inspectUrl(url) {
  const response = await fetch(url, { redirect: 'follow' });
  const html = await response.text();
  return inspectHtml(url, html, response.status, 'live');
}

function inspectLocalUrl(url, runtime) {
  const localPath = urlToDistPath(url, runtime);
  if (!existsSync(localPath)) {
    return {
      url,
      status: 0,
      source: 'local',
      blockCount: 0,
      types: [],
      findings: [`Missing local build artifact: ${path.relative(repoRoot, localPath)}`],
    };
  }

  const html = readFileSync(localPath, 'utf8');
  return inspectHtml(url, html, 200, 'local');
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const config = loadRuntimeQualityConfig(process.env);
  const runtime = resolveActiveSiteRuntime(process.env);
  const urls = options.urls.length ? options.urls : config.auditUrls;
  if (!urls.length) {
    throw new Error('No URLs configured for structured-data checks.');
  }

  const results = [];
  for (const url of urls) {
    results.push(options.strict ? inspectLocalUrl(url, runtime) : await inspectUrl(url));
  }

  const summary = {
    generatedAt: new Date().toISOString(),
    siteKey: config.runtime.siteKey,
    conceptKey: config.runtime.conceptKey,
    dashboardLabel: config.dashboardLabel,
    strict: options.strict,
    results,
    findings: results.flatMap((result) => result.findings.map((finding) => `${result.url}: ${finding}`)),
  };

  const markdown = [
    '# Structured Data Report',
    '',
    `Generated: ${summary.generatedAt}`,
    `Scope: ${summary.siteKey}/${summary.conceptKey}`,
    '',
    '| URL | Source | Status | Blocks | Types | Result |',
    '| --- | --- | ---: | ---: | --- | --- |',
    ...results.map((result) => `| ${result.url} | ${result.source} | ${result.status || '-'} | ${result.blockCount} | ${result.types.join(', ') || '-'} | ${result.findings.length ? 'alert' : 'ok'} |`),
    '',
    '## Findings',
    '',
    ...(summary.findings.length ? summary.findings.map((finding) => `- ${finding}`) : ['- Structured data is valid for the tracked pages.']),
  ].join('\n');

  const paths = writeReportArtifacts(repoRoot, 'structured-data', summary, markdown, config.outputScope);
  console.log(`Structured-data report written to ${paths.latestMarkdownPath}`);

  if (options.strict && summary.findings.length) {
    throw new Error(`Structured-data gate failed. See ${paths.latestMarkdownPath}`);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack || error.message : String(error));
  process.exit(1);
});
