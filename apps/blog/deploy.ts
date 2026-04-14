#!/usr/bin/env node
/**
 * Cloudflare deployment helper for the Astro sidecar blog.
 *
 * Workflow:
 * 1. Build the Astro app
 * 2. Sync guide SEO artifacts for the route worker
 * 3. Optionally run EmDash sync
 * 4. Deploy to Cloudflare Pages
 * 5. Print next steps
 */

import { execSync } from 'child_process';
import { existsSync } from 'fs';
import { join } from 'path';
import { getConceptOutputDir, resolveActiveSiteRuntime } from './site-profiles.mjs';
import { detectCloudflareAuth, runWrangler } from '../../scripts/cloudflare-auth.mjs';

const BLOG_DIR = join(process.cwd(), 'apps/blog');
const { siteKey, conceptKey, site, concept } = resolveActiveSiteRuntime(process.env);
const OUTPUT_DIR = join(BLOG_DIR, getConceptOutputDir(siteKey, conceptKey).replace(/^\.\//, ''));
const DEFAULT_PROJECT_NAME = process.env.PAGES_PROJECT_NAME || concept.cloudflare.pagesProject;

const green = (msg) => `\x1b[32m${msg}\x1b[0m`;
const blue = (msg) => `\x1b[34m${msg}\x1b[0m`;
const yellow = (msg) => `\x1b[33m${msg}\x1b[0m`;
const red = (msg) => `\x1b[31m${msg}\x1b[0m`;

function log(msg) {
  console.log(`[deploy] ${msg}`);
}

function logStep(step, msg) {
  console.log(`\n${blue('>')} ${step} - ${msg}`);
}

function exec(command, options = {}) {
  log(`Executing: ${command}`);
  try {
    return execSync(command, {
      stdio: 'inherit',
      cwd: options.cwd || BLOG_DIR,
      ...options,
    });
  } catch (error) {
    console.error(`${red('x')} Command failed: ${command}`);
    throw error;
  }
}

async function main() {
  const args = process.argv.slice(2);
  const isProduction = args.includes('--prod');
  const isPreview = args.includes('--preview');
  const skipBuild = args.includes('--skip-build');
  const skipEmdash = args.includes('--skip-emdash');
  const skipRumProof = args.includes('--skip-rum-proof');
  const branchFlag = args.find((arg) => arg.startsWith('--branch='));
  const explicitBranch = branchFlag ? branchFlag.replace('--branch=', '') : undefined;

  const env = isProduction ? 'production' : isPreview ? 'preview' : 'development';

  console.log(`\n${green('============================================')}`);
  console.log(`${green('Cloudflare Deployment - EmDash Astro Sidecar')}`);
  console.log(`${green('============================================')}`);
  console.log(`Environment: ${yellow(env)}`);
  console.log(`Blog directory: ${blue(BLOG_DIR)}`);
  console.log(`Active site/concept: ${yellow(`${site.key}/${concept.key}`)}`);

  const authState = detectCloudflareAuth({ requirePages: true });
  log(`[cloudflare-auth] ${authState.recommendation}`);

  if (!skipBuild) {
    logStep(1, 'Building Astro app');
    exec('pnpm run build', { cwd: BLOG_DIR });
    log(green('Build complete'));

    logStep('1.1', 'Syncing concept SEO artifacts');
    exec('pnpm sync:concept-seo', { cwd: process.cwd() });
    log(green('Concept SEO artifacts synced'));

    if (!existsSync(OUTPUT_DIR)) {
      throw new Error(`Build output not found at ${OUTPUT_DIR}`);
    }
  } else {
    log(yellow('Skipping build (--skip-build flag)'));
  }

  if (!skipEmdash) {
    logStep(2, 'Running EmDash content sync');
    try {
      exec('pnpm exec emdash migrate --push', { cwd: BLOG_DIR });
      log(green('EmDash content synced'));
    } catch {
      log(yellow('EmDash sync failed or was not configured'));
    }
  } else {
    log(yellow('Skipping EmDash sync (--skip-emdash flag)'));
  }

  logStep(3, 'Deploying to Cloudflare Pages');

  const projectName = DEFAULT_PROJECT_NAME;

  if (isProduction) {
    const productionBranch = explicitBranch || 'main';
    runWrangler(
      ['pages', 'deploy', OUTPUT_DIR, `--project-name=${projectName}`, `--branch=${productionBranch}`, '--commit-dirty=true'],
      { cwd: BLOG_DIR, stdio: 'inherit' },
    );
  } else if (isPreview) {
    const branchName =
      explicitBranch || exec('git branch --show-current', { cwd: process.cwd() }).toString().trim();
    runWrangler(
      ['pages', 'deploy', OUTPUT_DIR, `--project-name=${projectName}`, `--branch=${branchName}`, '--commit-dirty=true'],
      { cwd: BLOG_DIR, stdio: 'inherit' },
    );
  } else {
    log(yellow('No deployment target specified. Use --prod or --preview.'));
  }

  if (site.rootRouting) {
    logStep(3.1, 'Running live root routing guard');
    exec('pnpm qa:root-routing -- --live', { cwd: process.cwd() });
    log(green('Root routing guard passed'));
  }

  if (!skipRumProof && isProduction) {
    logStep(3.2, 'Running live browser RUM proof');
    exec(`node ./scripts/prove-browser-rum.mjs --strict --site ${site.key} --concept ${concept.key}`, {
      cwd: process.cwd(),
    });
    log(green('Browser RUM proof passed'));
  } else if (skipRumProof) {
    log(yellow('Skipping browser RUM proof (--skip-rum-proof flag)'));
  }

  logStep(4, 'Fetching Pages project list');
  try {
    runWrangler(['pages', 'project', 'list'], {
      cwd: BLOG_DIR,
      encoding: 'utf8',
      stdio: 'inherit',
    });
  } catch {
    log(yellow('Could not fetch project list automatically'));
  }

  log(green('Deployment script complete'));
}

main().catch((error) => {
  console.error(`\n${red('x')} Deployment failed: ${error.message}`);
  process.exit(1);
});
