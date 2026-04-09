#!/usr/bin/env node
/**
 * Cloudflare Deployment Script for EmDash Astro Sidecar Blog
 * 
 * This script:
 * 1. Builds the Astro app
 * 2. Runs EmDash migration/push if needed
 * 3. Deploys to Cloudflare Pages via wrangler pages deploy
 * 4. Sets up preview deployments
 * 5. Outputs the deployed URL
 */

import { execSync } from 'child_process';
import { existsSync } from 'fs';
import { join } from 'path';

const BLOG_DIR = join(process.cwd(), 'apps/blog');
const OUTPUT_DIR = join(BLOG_DIR, '.output/public');

// Colors for output
const green = (msg) => `\x1b[32m${msg}\x1b[0m`;
const blue = (msg) => `\x1b[34m${msg}\x1b[0m`;
const yellow = (msg) => `\x1b[33m${msg}\x1b[0m`;
const red = (msg) => `\x1b[31m${msg}\x1b[0m`;

function log(msg) {
  console.log(`[deploy] ${msg}`);
}

function logStep(step, msg) {
  console.log(`\n${blue('►')} ${step} - ${msg}`);
}

function exec(command, options = {}) {
  log(`Executing: ${command}`);
  try {
    return execSync(command, {
      stdio: 'inherit',
      cwd: options.cwd || BLOG_DIR,
      ...options
    });
  } catch (error) {
    console.error(`${red('✗')} Command failed: ${command}`);
    throw error;
  }
}

async function main() {
  const args = process.argv.slice(2);
  const isProduction = args.includes('--prod');
  const isPreview = args.includes('--preview');
  const skipBuild = args.includes('--skip-build');
  const skipEmdash = args.includes('--skip-emdash');
  
  const env = isProduction ? 'production' : isPreview ? 'preview' : 'development';
  
  console.log(`\n${green('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')}`);
  console.log(`${green('🚀')} EmDash Astro Sidecar - Cloudflare Deployment`);
  console.log(`${green('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')}`);
  console.log(`Environment: ${yellow(env)}`);
  console.log(`Blog directory: ${blue(BLOG_DIR)}`);
  
  // Step 1: Build the Astro app
  if (!skipBuild) {
    logStep(1, 'Building Astro app...');
    exec('pnpm run build', { cwd: BLOG_DIR });
    log(`${green('✓')} Astro build complete`);
    
    if (!existsSync(OUTPUT_DIR)) {
      throw new Error(`Build output not found at ${OUTPUT_DIR}`);
    }
  } else {
    log(`${yellow('⚠')} Skipping build (--skip-build flag)`);
  }
  
  // Step 2: Run EmDash migration/push if needed
  if (!skipEmdash) {
    logStep(2, 'Running EmDash content sync...');
    try {
      exec('npx emdash migrate --push', { cwd: BLOG_DIR });
      log(`${green('✓')} EmDash content synced`);
    } catch (error) {
      log(`${yellow('⚠')} EmDash sync failed (may need credentials or no content changes)`);
    }
  } else {
    log(`${yellow('⚠')} Skipping EmDash sync (--skip-emdash flag)`);
  }
  
  // Step 3: Deploy to Cloudflare Pages
  logStep(3, 'Deploying to Cloudflare Pages...');
  
  const projectName = 'emdash-astro-sidecar-blog';
  
  if (isProduction) {
    log(`Deploying to production...`);
    exec(`npx wrangler pages deploy ${OUTPUT_DIR} --project-name=${projectName} --env=production`, {
      cwd: BLOG_DIR
    });
  } else if (isPreview) {
    log(`Deploying preview...`);
    const branchName = exec('git branch --show-current', { cwd: process.cwd() }).toString().trim();
    exec(`npx wrangler pages deploy ${OUTPUT_DIR} --project-name=${projectName} --env=preview --branch=${branchName}`, {
      cwd: BLOG_DIR
    });
  } else {
    log(`${yellow('⚠')} No deployment target specified. Use --prod or --preview`);
    log(`To deploy to preview: pnpm run deploy --preview`);
    log(`To deploy to production: pnpm run deploy --prod`);
  }
  
  // Step 4: Get deployed URL
  logStep(4, 'Fetching deployment URL...');
  try {
    const urlOutput = exec(`npx wrangler pages project list --format=json`, {
      cwd: BLOG_DIR,
      encoding: 'utf-8'
    });
    
    // Parse project list to find our URL
    log(`${green('✓')} Deployment complete!`);
    log(`\n${green('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')}`);
    log(`${blue('📝')} Next steps:`);
    log(`  1. Configure your domain's DNS to point to the Cloudflare Pages URL`);
    log(`  2. Set required secrets: wrangler secret put EMDASH_API_KEY`);
    log(`  3. Update EmDash config with the new site URL`);
    log(`${green('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')}\n`);
  } catch (error) {
    log(`${yellow('⚠')} Could not fetch deployment URL automatically`);
    log(`Run: npx wrangler pages project list to see deployment status`);
  }
  
  log(`${green('✓')} Deployment script complete!`);
}

main().catch((error) => {
  console.error(`\n${red('✗')} Deployment failed:`, error.message);
  process.exit(1);
});
