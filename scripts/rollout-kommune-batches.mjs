#!/usr/bin/env node

import path from 'node:path';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';
import { loadMunicipalityPages } from './lib/municipality-pages.mjs';
import { loadMunicipalityCatalog, selectMunicipalityBatch } from './lib/municipality-rollout.mjs';

const repoRoot = process.cwd();
const outputRoot = path.join(repoRoot, 'output', 'municipality-batches');
const municipalityReportPath = path.join(repoRoot, 'output', 'municipality-quality', 'latest', 'summary.json');
const kommuneDistRoot = path.join(repoRoot, 'apps', 'blog', 'dist', 'kurs-ing', 'kommune');

await main();

async function main() {
  const args = parseArgs(process.argv.slice(2));
  await mkdir(outputRoot, { recursive: true });

  const { catalog } = await loadMunicipalityCatalog(repoRoot);
  let entries = await loadMunicipalityPages(repoRoot);
  let verifiedSummary = await ensureMunicipalityReport();
  let publishedCount = verifiedSummary.publishedCount;
  const manifests = [];
  const attemptedMunicipalities = new Set();

  while (publishedCount < args.targetPublished) {
    const batchSize = Math.min(args.batchSize, args.targetPublished - publishedCount);
    const batch = selectMunicipalityBatch({
      catalog,
      existingEntries: entries,
      batchSize,
      excludeMunicipalities: attemptedMunicipalities,
    });

    if (!batch.length) {
      throw new Error(`No additional municipality candidates were available before reaching ${args.targetPublished} published pages.`);
    }
    batch.forEach((municipality) => attemptedMunicipalities.add(municipality));

    const beforePublishedCount = publishedCount;
    await runNodeScript('scripts/generate-municipal-pages.mjs', batch);
    await runKommuneBuild();
    await runMunicipalityQa();
    await runCommand('pnpm', ['report:municipality']);

    entries = await loadMunicipalityPages(repoRoot);
    verifiedSummary = await readMunicipalityReport();
    publishedCount = verifiedSummary.publishedCount;
    const verifiedPublishedSet = new Set(verifiedSummary.published.map((entry) => entry.municipality));
    const publishedBatchSlugs = entries
      .filter((entry) => batch.includes(entry.municipality))
      .filter((entry) => verifiedPublishedSet.has(entry.municipality))
      .map((entry) => entry.slug);

    if (publishedBatchSlugs.length) {
      await runCommand('pnpm', [
        'audit:municipality-batch',
        '--',
        ...publishedBatchSlugs.flatMap((slug) => ['--slug', slug]),
      ]);
    }

    const manifest = {
      generatedAt: new Date().toISOString(),
      batch,
      batchSize: batch.length,
      beforePublishedCount,
      afterPublishedCount: publishedCount,
      addedPublishedCount: publishedCount - beforePublishedCount,
      publishedBatchSlugs,
      draftedBatchMunicipalities: batch.filter((municipality) => !verifiedPublishedSet.has(municipality)),
    };
    manifests.push(manifest);

    const manifestPath = path.join(outputRoot, `${manifest.generatedAt.replace(/[:.]/g, '-')}.json`);
    await writeFile(manifestPath, JSON.stringify(manifest, null, 2), 'utf8');
    console.log(`Wrote ${path.relative(repoRoot, manifestPath)}`);

    if (publishedCount <= beforePublishedCount) {
      console.warn(
        `Batch ${batch.join(', ')} did not increase the published municipality count; continuing to the next untried municipalities.`,
      );
    }
  }

  const summary = {
    generatedAt: new Date().toISOString(),
    targetPublished: args.targetPublished,
    batchSize: args.batchSize,
    finalPublishedCount: publishedCount,
    manifests,
  };
  await writeFile(path.join(outputRoot, 'latest-summary.json'), JSON.stringify(summary, null, 2), 'utf8');
  console.log(`Reached ${publishedCount} published municipality pages`);
}

async function ensureMunicipalityReport() {
  try {
    return await readMunicipalityReport();
  } catch (error) {
    if (error?.code !== 'ENOENT') {
      throw error;
    }
  }

  await runCommand('pnpm', ['report:municipality']);
  return readMunicipalityReport();
}

async function readMunicipalityReport() {
  const raw = await readFile(municipalityReportPath, 'utf8');
  const summary = JSON.parse(raw);
  return {
    ...summary,
    published: Array.isArray(summary.published) ? summary.published : [],
    drafted: Array.isArray(summary.drafted) ? summary.drafted : [],
    publishedCount:
      Number.isFinite(summary.publishedCount) && summary.publishedCount >= 0
        ? summary.publishedCount
        : Array.isArray(summary.published)
          ? summary.published.length
          : 0,
  };
}

function parseArgs(argv) {
  const args = {
    targetPublished: 200,
    batchSize: 10,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--target-published' && argv[index + 1]) {
      args.targetPublished = Number(argv[index + 1]);
      index += 1;
      continue;
    }
    if (arg.startsWith('--target-published=')) {
      args.targetPublished = Number(arg.slice('--target-published='.length));
      continue;
    }
    if (arg === '--batch-size' && argv[index + 1]) {
      args.batchSize = Number(argv[index + 1]);
      index += 1;
      continue;
    }
    if (arg.startsWith('--batch-size=')) {
      args.batchSize = Number(arg.slice('--batch-size='.length));
    }
  }

  args.targetPublished = Number.isFinite(args.targetPublished) && args.targetPublished > 0 ? args.targetPublished : 200;
  args.batchSize = Number.isFinite(args.batchSize) && args.batchSize > 0 ? Math.min(10, args.batchSize) : 10;

  return args;
}

async function runNodeScript(scriptPath, municipalities) {
  const args = [scriptPath, ...municipalities.flatMap((municipality) => [`--municipality=${municipality}`])];
  await runCommand(process.execPath, args);
}

async function runKommuneBuild() {
  const maxAttempts = 3;
  let lastError;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    await rm(kommuneDistRoot, { recursive: true, force: true });

    try {
      await runCommand('pnpm', ['build:kommune']);
      return;
    } catch (error) {
      lastError = error;
      if (attempt === maxAttempts) {
        break;
      }
      console.warn(
        `pnpm build:kommune failed on attempt ${attempt}/${maxAttempts}; cleaned dist and retrying once more.`,
      );
    }
  }

  throw lastError;
}

async function runMunicipalityQa() {
  const maxAttempts = 2;
  let lastError;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      await runCommand('pnpm', ['qa:municipality']);
      return;
    } catch (error) {
      lastError = error;
      if (attempt === maxAttempts) {
        break;
      }
      console.warn(`pnpm qa:municipality failed on attempt ${attempt}/${maxAttempts}; waiting briefly and retrying.`);
      await delay(1000);
    }
  }

  throw lastError;
}

async function runCommand(command, args) {
  await new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: repoRoot,
      stdio: 'inherit',
      env: process.env,
    });
    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(`${command} ${args.join(' ')} exited with code ${code}`));
    });
  });
}
