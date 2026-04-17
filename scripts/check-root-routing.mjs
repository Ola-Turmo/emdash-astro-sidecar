#!/usr/bin/env node

import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { readUtf8, failIfFindings } from './lib/repo-utils.mjs';

const repoRoot = process.cwd();
const args = process.argv.slice(2);
const runLiveChecks = args.includes('--live');
const findings = [];

const siteProfilesModuleUrl = pathToFileURL(path.join(repoRoot, 'apps/blog/site-profiles.mjs')).href;
const { resolveActiveSiteRuntime } = await import(siteProfilesModuleUrl);
const runtime = resolveActiveSiteRuntime(process.env);
const { site } = runtime;

if (!site.rootRouting) {
  console.log('Root routing guard skipped: active site has no root routing configuration');
  process.exit(0);
}

const routerWorkerPath = path.join(repoRoot, 'apps/cloudflare/workers/router-worker/src/index.ts');
const routerWranglerPath = path.join(repoRoot, 'apps/cloudflare/workers/router-worker/wrangler.toml');
const apexWorkerPath = path.join(repoRoot, 'apps/cloudflare/workers/apex-site-proxy/src/index.ts');
const apexWranglerPath = path.join(repoRoot, 'apps/cloudflare/workers/apex-site-proxy/wrangler.toml');

const routerWorkerSource = await readUtf8(routerWorkerPath);
const routerWranglerSource = await readUtf8(routerWranglerPath);
const apexWorkerSource = await readUtf8(apexWorkerPath);
const apexWranglerSource = await readUtf8(apexWranglerPath);

const conceptBasePaths = Object.values(site.concepts).map((concept) => concept.basePath);
const expectedExactBypassPaths = site.rootRouting.exactBypassPaths ?? [];

for (const basePath of conceptBasePaths) {
  if (!routerWorkerSource.includes(`'${basePath}'`) && !routerWorkerSource.includes(`"${basePath}"`)) {
    findings.push(`router-worker must bypass concept base path ${basePath}`);
  }
  if (!apexWorkerSource.includes(`'${basePath}'`) && !apexWorkerSource.includes(`"${basePath}"`)) {
    findings.push(`apex-site-proxy must bypass concept base path ${basePath}`);
  }
}

for (const exactPath of expectedExactBypassPaths) {
  if (!routerWorkerSource.includes(`'${exactPath}'`) && !routerWorkerSource.includes(`"${exactPath}"`)) {
    findings.push(`router-worker must bypass exact path ${exactPath}`);
  }
  if (!apexWorkerSource.includes(`'${exactPath}'`) && !apexWorkerSource.includes(`"${exactPath}"`)) {
    findings.push(`apex-site-proxy must bypass exact path ${exactPath}`);
  }
}

if (!routerWranglerSource.includes(`ROOT_SITE_ORIGIN = "${site.rootRouting.rootOrigin}"`)) {
  findings.push(`router-worker ROOT_SITE_ORIGIN must match ${site.rootRouting.rootOrigin}`);
}

if (!apexWranglerSource.includes(`ROOT_SITE_ORIGIN = "${site.rootRouting.rootOrigin}"`)) {
  findings.push(`apex-site-proxy ROOT_SITE_ORIGIN must match ${site.rootRouting.rootOrigin}`);
}

if (!routerWranglerSource.includes('name = "router-worker"')) {
  findings.push('router-worker wrangler config must keep the live worker name "router-worker"');
}

const hostname = new URL(site.brand.mainSiteUrl).hostname.replace(/^www\./, '');
const wwwHostname = new URL(site.brand.mainSiteUrl).hostname;
if (!routerWranglerSource.includes(`pattern = "${wwwHostname}/*"`)) {
  findings.push(`router-worker route must include ${wwwHostname}/*`);
}

if (!apexWranglerSource.includes(`pattern = "${hostname}/*"`)) {
  findings.push(`apex-site-proxy route must include ${hostname}/*`);
}

if (runLiveChecks) {
  await runLiveAssertions(site, findings);
}

failIfFindings(findings, 'Root routing guard failed');
console.log(`Root routing guard passed${runLiveChecks ? ' (live + static)' : ' (static)'}`);

async function runLiveAssertions(activeSite, outputFindings) {
  const wwwUrl = activeSite.brand.mainSiteUrl;
  const apexUrl = wwwUrl.replace('https://www.', 'https://');
  const kommuneConcept = activeSite.concepts.kommune;

  const [wwwResponse, apexResponse] = await Promise.all([fetch(wwwUrl), fetch(apexUrl)]);

  if (wwwResponse.status !== 200) {
    outputFindings.push(`www root live check returned HTTP ${wwwResponse.status}`);
  }

  if (apexResponse.status !== 200) {
    outputFindings.push(`apex root live check returned HTTP ${apexResponse.status}`);
  }

  const wwwHeader = wwwResponse.headers.get('x-emdash-root-proxy');
  const apexHeader = apexResponse.headers.get('x-emdash-root-proxy');

  if (wwwHeader !== 'router-worker') {
    outputFindings.push(`www root proxy header must be router-worker, got ${wwwHeader ?? '<missing>'}`);
  }

  if (apexHeader !== 'apex-site') {
    outputFindings.push(`apex root proxy header must be apex-site, got ${apexHeader ?? '<missing>'}`);
  }

  const wwwHtml = await wwwResponse.text();
  const apexHtml = await apexResponse.text();

  for (const marker of activeSite.rootRouting.requiredMarkers ?? []) {
    if (!wwwHtml.includes(marker)) {
      outputFindings.push(`www root is missing required marker: ${marker}`);
    }
    if (!apexHtml.includes(marker)) {
      outputFindings.push(`apex root is missing required marker: ${marker}`);
    }
  }

  for (const marker of activeSite.rootRouting.forbiddenMarkers ?? []) {
    if (wwwHtml.includes(marker)) {
      outputFindings.push(`www root contains forbidden concept marker: ${marker}`);
    }
    if (apexHtml.includes(marker)) {
      outputFindings.push(`apex root contains forbidden concept marker: ${marker}`);
    }
  }

  if (kommuneConcept) {
    const kommuneUrl = new URL(kommuneConcept.basePath, activeSite.brand.mainSiteUrl).toString();
    const kommuneResponse = await fetch(kommuneUrl);
    if (kommuneResponse.status !== 200) {
      outputFindings.push(`kommune concept live check returned HTTP ${kommuneResponse.status}`);
      return;
    }

    const kommuneHtml = await kommuneResponse.text();
    if (!kommuneHtml.includes(kommuneConcept.siteName)) {
      outputFindings.push(`kommune concept page does not include expected site name ${kommuneConcept.siteName}`);
    }
  }
}
