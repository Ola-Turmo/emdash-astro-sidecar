#!/usr/bin/env node

import { getSecretValue } from './local-secret-store.mjs';
import { loadMunicipalityPages } from './lib/municipality-pages.mjs';
import { siteProfiles } from '../apps/blog/site-profiles.mjs';

const CLOUDFLARE_API_BASE = 'https://api.cloudflare.com/client/v4';
const MAX_FILES_PER_PURGE = 30;
const repoRoot = process.cwd();

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const runtime = resolveKommuneRuntime();
  const pages = await loadMunicipalityPages(repoRoot);
  const targets = buildPurgeTargets(pages, runtime, options);

  console.log(`Prepared ${targets.length} kommune URLs for cache purge.`);
  if (options.dryRun) {
    for (const target of targets) {
      console.log(target);
    }
    return;
  }

  const token = getSecretValue('CLOUDFLARE_API_TOKEN');
  if (!token) {
    throw new Error(
      'Missing CLOUDFLARE_API_TOKEN. Cache purge requires a Cloudflare API token because this script uses the purge_cache API directly.',
    );
  }

  const zoneId = getSecretValue('CLOUDFLARE_ZONE_ID') || await resolveZoneId(token, runtime.zoneName);
  let batchCount = 0;
  for (let index = 0; index < targets.length; index += MAX_FILES_PER_PURGE) {
    const files = targets.slice(index, index + MAX_FILES_PER_PURGE);
    await purgeFiles(token, zoneId, files);
    batchCount += 1;
    console.log(`Purged batch ${batchCount} (${files.length} URLs)`);
  }

  console.log(`Purged ${targets.length} kommune URLs from Cloudflare cache.`);
}

function parseArgs(argv) {
  return {
    dryRun: argv.includes('--dry-run'),
    publishedOnly: argv.includes('--published-only'),
  };
}

function resolveKommuneRuntime() {
  const site = siteProfiles['kurs-ing'];
  const concept = site.concepts.kommune;
  return {
    zoneName: new URL(site.brand.mainSiteUrl).hostname.replace(/^www\./, ''),
    hosts: [
      site.brand.mainSiteUrl,
      site.brand.mainSiteUrl.replace('https://www.', 'https://'),
    ],
    basePath: concept.basePath,
  };
}

function buildPurgeTargets(pages, runtime, options) {
  const slugTargets = pages
    .filter((page) => !options.publishedOnly || !page.draft)
    .flatMap((page) => buildConceptUrlVariants(runtime, `/${page.slug}`));

  const rootTargets = [
    ...buildConceptUrlVariants(runtime, ''),
    ...runtime.hosts.flatMap((host) => [
      new URL(`${runtime.basePath}/sitemap.xml`, `${host}/`).toString(),
      new URL(`${runtime.basePath}/rss.xml`, `${host}/`).toString(),
      new URL(`${runtime.basePath}/robots.txt`, `${host}/`).toString(),
    ]),
  ];

  return [...new Set([...rootTargets, ...slugTargets])];
}

function buildConceptUrlVariants(runtime, suffix) {
  const normalizedSuffix = suffix ? suffix.replace(/^\/+/, '/') : '';
  return runtime.hosts.flatMap((host) => {
    const base = `${runtime.basePath}${normalizedSuffix}`;
    return [
      new URL(base, `${host}/`).toString(),
      new URL(`${base}/`, `${host}/`).toString(),
    ];
  });
}

async function resolveZoneId(token, zoneName) {
  const url = new URL(`${CLOUDFLARE_API_BASE}/zones`);
  url.searchParams.set('name', zoneName);
  url.searchParams.set('status', 'active');
  url.searchParams.set('per_page', '1');

  const response = await fetch(url, {
    headers: {
      authorization: `Bearer ${token}`,
    },
  });
  const payload = await response.json();
  if (!response.ok || !payload?.success) {
    throw new Error(`Could not resolve Cloudflare zone id for ${zoneName}.`);
  }

  const zoneId = payload?.result?.[0]?.id;
  if (!zoneId) {
    throw new Error(`No active Cloudflare zone found for ${zoneName}.`);
  }

  return zoneId;
}

async function purgeFiles(token, zoneId, files) {
  const response = await fetch(`${CLOUDFLARE_API_BASE}/zones/${zoneId}/purge_cache`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${token}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({ files }),
  });

  const payload = await response.json();
  if (!response.ok || !payload?.success) {
    const errors = payload?.errors?.map((entry) => entry.message || JSON.stringify(entry)).join('; ');
    throw new Error(`Cloudflare cache purge failed: ${errors || response.statusText}`);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
