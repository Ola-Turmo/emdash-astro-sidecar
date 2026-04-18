#!/usr/bin/env node

import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getConceptOutputDir, resolveActiveSiteRuntime } from '../apps/blog/site-profiles.mjs';
import { getSecretValue } from './local-secret-store.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');
const runtime = resolveActiveSiteRuntime({
  ...process.env,
  EMDASH_SITE_KEY: 'kurs-ing',
  EMDASH_CONCEPT_KEY: 'kommune',
});
const outputDir = path
  .join('apps', 'blog', getConceptOutputDir(runtime.siteKey, runtime.conceptKey).replace(/^\.\//u, ''))
  .replace(/\\/g, '/');
const projectName = runtime.concept.cloudflare.pagesProject;

function main() {
  const args = process.argv.slice(2);
  const shouldSkipPurge = args.includes('--skip-purge');

  execFileSync(
    process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm',
    [
      'exec',
      'wrangler',
      'pages',
      'deploy',
      outputDir,
      `--project-name=${projectName}`,
      '--branch=main',
      '--commit-dirty=true',
      ...args.filter((arg) => arg !== '--skip-purge'),
    ],
    {
      cwd: repoRoot,
      stdio: 'inherit',
    },
  );

  if (!shouldSkipPurge && getSecretValue('CLOUDFLARE_API_TOKEN')) {
    execFileSync(process.execPath, [path.join(repoRoot, 'scripts', 'purge-kommune-cache.mjs'), '--published-only'], {
      cwd: repoRoot,
      stdio: 'inherit',
      env: process.env,
    });
  }
}

main();
