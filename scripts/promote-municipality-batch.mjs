#!/usr/bin/env node

import path from 'node:path';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';

const repoRoot = process.cwd();
const municipalityRoot = path.join(repoRoot, 'apps', 'blog', 'src', 'content', 'municipalPages');
const outputRoot = path.join(repoRoot, 'output', 'municipality-batches');

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const entries = await loadEntries();
  const targets = selectTargets(entries, args);

  if (!targets.length) {
    throw new Error('No publishable drafted municipalities matched the requested promotion batch.');
  }

  await mkdir(outputRoot, { recursive: true });

  for (const target of targets) {
    const updated = target.source.replace(/^draft:\s*true$/m, 'draft: false');
    await writeFile(target.filePath, updated, 'utf8');
    console.log(`Promoted ${path.relative(repoRoot, target.filePath)}`);
  }

  const manifest = {
    generatedAt: new Date().toISOString(),
    requireHero: args.requireHero,
    limit: args.limit,
    promoted: targets.map(({ municipality, slug, score, hasHero }) => ({
      municipality,
      slug,
      score,
      hasHero,
    })),
  };

  const manifestPath = path.join(outputRoot, `${manifest.generatedAt.replace(/[:.]/g, '-')}.json`);
  await writeFile(manifestPath, JSON.stringify(manifest, null, 2), 'utf8');
  console.log(`Wrote ${path.relative(repoRoot, manifestPath)}`);
}

function parseArgs(argv) {
  const args = {
    limit: 20,
    requireHero: false,
    slugs: [],
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--limit' && argv[index + 1]) {
      args.limit = Number(argv[index + 1]);
      index += 1;
      continue;
    }
    if (arg.startsWith('--limit=')) {
      args.limit = Number(arg.slice('--limit='.length));
      continue;
    }
    if (arg === '--slug' && argv[index + 1]) {
      args.slugs.push(argv[index + 1]);
      index += 1;
      continue;
    }
    if (arg.startsWith('--slug=')) {
      args.slugs.push(arg.slice('--slug='.length));
      continue;
    }
    if (arg === '--require-hero') {
      args.requireHero = true;
    }
  }

  return args;
}

async function loadEntries() {
  const files = (await readdir(municipalityRoot)).filter((fileName) => fileName.endsWith('.mdx'));
  const results = [];

  for (const fileName of files) {
    const filePath = path.join(municipalityRoot, fileName);
    const source = await readFile(filePath, 'utf8');
    results.push({
      filePath,
      source,
      slug: fileName.replace(/\.mdx$/i, ''),
      municipality: source.match(/^municipality:\s*"(.+)"$/m)?.[1] || fileName.replace(/\.mdx$/i, ''),
      score: Number(source.match(/^  score:\s*([0-9]+)$/m)?.[1] || '-1'),
      publishable: /^  publishable:\s*true$/m.test(source),
      draft: /^draft:\s*true$/m.test(source),
      hasHero: /^heroImage:/m.test(source),
    });
  }

  return results.sort((a, b) => b.score - a.score || a.municipality.localeCompare(b.municipality, 'nb'));
}

function selectTargets(entries, args) {
  if (args.slugs.length) {
    const wanted = new Set(args.slugs.map((value) => value.toLowerCase()));
    return entries.filter(
      (entry) => wanted.has(entry.slug.toLowerCase()) && entry.publishable && entry.draft,
    );
  }

  return entries
    .filter((entry) => entry.publishable && entry.draft)
    .filter((entry) => !args.requireHero || entry.hasHero)
    .slice(0, args.limit);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
