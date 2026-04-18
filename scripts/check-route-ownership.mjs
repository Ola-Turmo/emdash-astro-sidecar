#!/usr/bin/env node

import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { readUtf8, failIfFindings } from './lib/repo-utils.mjs';

const repoRoot = process.cwd();
const findings = [];

const siteProfilesModuleUrl = pathToFileURL(path.join(repoRoot, 'apps/blog/site-profiles.mjs')).href;
const { resolveActiveSiteRuntime, getConceptOutputDir } = await import(siteProfilesModuleUrl);
const runtime = resolveActiveSiteRuntime(process.env);
const { site } = runtime;

const mainSiteUrl = new URL(site.brand.mainSiteUrl);
const wwwHost = mainSiteUrl.hostname.startsWith('www.') ? mainSiteUrl.hostname : `www.${mainSiteUrl.hostname}`;
const apexHost = mainSiteUrl.hostname.replace(/^www\./u, '');
const protectedPagesProjects = new Set(['kurs-ing-static']);
const expectedDeployDirectories = new Set(
  Object.values(site.concepts).map((concept) =>
    normalizeRepoPath(path.join('apps', 'blog', getConceptOutputDir(site.key, concept.key).replace(/^\.\//u, ''))),
  ),
);
const expectedRouteWorkerConfigs = new Set(
  Object.values(site.concepts).map((concept) =>
    normalizeRepoPath(
      path.join('apps', 'cloudflare', 'workers', concept.cloudflare.routeWorkerDirectory, 'wrangler.toml'),
    ),
  ),
);

for (const concept of Object.values(site.concepts)) {
  if (protectedPagesProjects.has(concept.cloudflare.pagesProject)) {
    findings.push(
      `${concept.key} must not target protected Pages project ${concept.cloudflare.pagesProject}; use a dedicated sidecar Pages project instead`,
    );
  }

  const workerConfigPath = path.join(
    repoRoot,
    'apps',
    'cloudflare',
    'workers',
    concept.cloudflare.routeWorkerDirectory,
    'wrangler.toml',
  );
  const workerConfigSource = await readUtf8(workerConfigPath);
  const patternMatches = [...workerConfigSource.matchAll(/pattern = "([^"]+)"/g)].map((match) => match[1]);
  const expectedPatterns = new Set([`${wwwHost}${concept.basePath}*`, `${apexHost}${concept.basePath}*`]);

  for (const expectedPattern of expectedPatterns) {
    if (!patternMatches.includes(expectedPattern)) {
      findings.push(
        `${concept.cloudflare.routeWorkerDirectory} must own ${expectedPattern} so the concept stays mounted under ${concept.basePath}`,
      );
    }
  }

  for (const routePattern of patternMatches) {
    const hostPath = extractHostPath(routePattern);
    if (!hostPath) {
      continue;
    }

    const [host, publicPath] = hostPath;
    if (host !== wwwHost && host !== apexHost) {
      continue;
    }

    if (!expectedPatterns.has(routePattern)) {
      findings.push(
        `${concept.cloudflare.routeWorkerDirectory} must not claim ${routePattern}; ${site.key} sidecar ownership is limited to ${concept.basePath}`,
      );
    }

    if (!publicPath.startsWith(`${concept.basePath}*`)) {
      findings.push(
        `${concept.cloudflare.routeWorkerDirectory} must not expose ${publicPath} outside ${concept.basePath} on ${host}`,
      );
    }
  }
}

const deployTargets = await collectDeployTargets();
for (const target of deployTargets) {
  if (!expectedDeployDirectories.has(normalizeRepoPath(target.directory))) {
    findings.push(
      `${target.source} must deploy only ${[...expectedDeployDirectories].join(' or ')}, found ${target.directory}`,
    );
  }
}

const registry = JSON.parse(await readUtf8(path.join(repoRoot, 'docs', 'autonomous-worker-registry.json')));
const routeWorkers = registry.workers.filter((worker) => worker.kind === 'route');

for (const expectedConfig of expectedRouteWorkerConfigs) {
  if (!routeWorkers.some((worker) => normalizeRepoPath(worker.wranglerConfig) === expectedConfig)) {
    findings.push(`autonomous-worker-registry.json must include route worker ${expectedConfig}`);
  }
}

for (const worker of routeWorkers) {
  const normalizedConfig = normalizeRepoPath(worker.wranglerConfig);
  if (!expectedRouteWorkerConfigs.has(normalizedConfig)) {
    findings.push(
      `autonomous-worker-registry.json must not deploy ${normalizedConfig}; ${site.key} sidecar route ownership is limited to ${[...expectedRouteWorkerConfigs].join(' and ')}`,
    );
  }
}

failIfFindings(findings, 'Route ownership gate failed');
console.log(
  `Route ownership gate passed for ${site.key}: sidecar ownership limited to ${Object.values(site.concepts)
    .map((concept) => concept.basePath)
    .join(', ')}`,
);

async function collectDeployTargets() {
  const targets = [];
  const files = [
    '.github/workflows/cloudflare-deploy.yml',
    '.github/workflows/deploy.yml',
    'scripts/deploy-kommune-pages.mjs',
  ];

  for (const relativePath of files) {
    const source = await readUtf8(path.join(repoRoot, relativePath));

    for (const match of source.matchAll(/apps\/blog\/dist\/[A-Za-z0-9/_-]+/g)) {
      targets.push({
        source: `${relativePath}:${match.index ?? 0}`,
        directory: match[0],
      });
    }

    for (const match of source.matchAll(/directory:\s*(apps\/blog\/dist\/[A-Za-z0-9/_-]+)/g)) {
      targets.push({
        source: `${relativePath}:${match.index ?? 0}`,
        directory: match[1],
      });
    }
  }

  return dedupeTargets(targets);
}

function extractHostPath(routePattern) {
  const slashIndex = routePattern.indexOf('/');
  if (slashIndex === -1) {
    return null;
  }

  return [routePattern.slice(0, slashIndex), routePattern.slice(slashIndex)];
}

function normalizeRepoPath(value) {
  return value.replace(/\\/g, '/').replace(/^\.?\//u, '');
}

function dedupeTargets(targets) {
  const seen = new Set();
  return targets.filter((target) => {
    const key = `${target.source}|${target.directory}`;
    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}
