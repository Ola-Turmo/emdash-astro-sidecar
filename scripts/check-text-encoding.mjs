#!/usr/bin/env node

import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';

const repoRoot = process.cwd();
const roots = ['apps/blog/src', 'apps/cloudflare', 'docs', 'packages', 'scripts', '.github'];
const exts = new Set(['.ts', '.tsx', '.astro', '.md', '.mdx', '.mjs', '.json', '.jsonc', '.toml', '.yml', '.yaml']);
const ignoredDirs = new Set(['node_modules', 'dist', '.astro', 'readme-assets']);
const ignoredFiles = new Set([
  path.join(repoRoot, 'scripts', 'check-text-encoding.mjs'),
  path.join(repoRoot, 'scripts', 'check-copy-quality.mjs'),
  path.join(repoRoot, 'packages', 'model-runtime', 'src', 'slug.ts'),
]);
const suspiciousPatterns = [
  'Ã¥',
  'Ã¸',
  'Ã¦',
  'Â',
  'â€”',
  'â†’',
  'â€',
  'ï¿½',
  '\uFFFD',
];

function walk(dir, files = []) {
  for (const entry of readdirSync(dir)) {
    const fullPath = path.join(dir, entry);
    const stats = statSync(fullPath);
    if (stats.isDirectory()) {
      if (ignoredDirs.has(entry)) continue;
      walk(fullPath, files);
      continue;
    }

    if (exts.has(path.extname(entry))) {
      if (!ignoredFiles.has(fullPath)) {
        files.push(fullPath);
      }
    }
  }
  return files;
}

const findings = [];
for (const root of roots) {
  const absoluteRoot = path.join(repoRoot, root);
  for (const file of walk(absoluteRoot)) {
    const text = readFileSync(file, 'utf8');
    const matched = suspiciousPatterns.filter((pattern) => text.includes(pattern));
    if (matched.length) {
      findings.push({
        file: path.relative(repoRoot, file),
        patterns: matched,
      });
    }
  }
}

if (findings.length) {
  console.error('Detected likely mojibake or bad text encoding sequences:');
  for (const finding of findings) {
    console.error(`- ${finding.file}: ${finding.patterns.join(', ')}`);
  }
  process.exitCode = 1;
} else {
  console.log('Text encoding gate passed');
}
