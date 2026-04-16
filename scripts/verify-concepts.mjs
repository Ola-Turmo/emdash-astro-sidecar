#!/usr/bin/env node

import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { getResolvedSiteCopy } from '../apps/blog/site-copy.mjs';
import { getConceptOutputDir } from '../apps/blog/site-profiles.mjs';

const repoRoot = process.cwd();
const blogAppRoot = path.join(repoRoot, 'apps', 'blog');
const astroCacheDir = path.join(blogAppRoot, 'node_modules', '.astro');

mkdirSync(astroCacheDir, { recursive: true });

const concepts = [
  {
    siteKey: 'kurs-ing',
    conceptKey: 'guide',
    expectedFiles: [
      'index.html',
      path.join('blog', 'hvordan-besta-etablererproven', 'index.html'),
    ],
  },
  {
    siteKey: 'kurs-ing',
    conceptKey: 'kommune',
    expectedFiles: [
      'index.html',
      path.join('arendal', 'index.html'),
      path.join('bjerkreim', 'index.html'),
      path.join('bremanger', 'index.html'),
      path.join('nord-aurdal', 'index.html'),
    ],
  },
  {
    siteKey: 'gatareba-ge',
    conceptKey: 'guide',
    expectedFiles: ['index.html'],
  },
];

for (const target of concepts) {
  console.log(`\nVerifying concept ${target.siteKey}/${target.conceptKey}`);
  const env = {
    ...process.env,
    EMDASH_SITE_KEY: target.siteKey,
    EMDASH_CONCEPT_KEY: target.conceptKey,
  };

  exec('pnpm', ['--filter', '@emdash/blog', 'check'], env);
  exec('pnpm', ['--filter', '@emdash/blog', 'build'], env);
  verifyBuildOutputs(target);
}

function verifyBuildOutputs(target) {
  const distRoot = path.join(
    blogAppRoot,
    getConceptOutputDir(target.siteKey, target.conceptKey).replace(/^\.\//u, ''),
  );
  const resolvedCopy = getResolvedSiteCopy(target.siteKey, target.conceptKey);

  for (const relativePath of target.expectedFiles) {
    const absolutePath = path.join(distRoot, relativePath);
    if (!existsSync(absolutePath)) {
      throw new Error(`Missing expected build output for ${target.siteKey}/${target.conceptKey}: ${relativePath}`);
    }
  }

  const landingHtml = readFileSync(path.join(distRoot, 'index.html'), 'utf8');
  const expectedSnippets = [
    resolvedCopy.shell.homeTitle,
    resolvedCopy.shell.homeDescription,
    resolvedCopy.shell.listingTitle,
    resolvedCopy.shell.footerTitle,
  ].filter(Boolean);

  for (const snippet of expectedSnippets) {
    if (!landingHtml.includes(snippet)) {
      throw new Error(
        `Missing expected concept shell copy for ${target.siteKey}/${target.conceptKey} in index.html: ${snippet}`,
      );
    }
  }
}

function exec(command, args, env) {
  if (process.platform === 'win32' && command === 'pnpm') {
    const commandLine = ['pnpm', ...args].map(quoteForCmd).join(' ');
    execFileSync('cmd.exe', ['/d', '/s', '/c', commandLine], {
      cwd: repoRoot,
      stdio: 'inherit',
      env,
    });
    return;
  }

  execFileSync(command, args, {
    cwd: repoRoot,
    stdio: 'inherit',
    env,
  });
}

function quoteForCmd(value) {
  if (!/[\s"]/u.test(value)) {
    return value;
  }

  return `"${value.replace(/"/g, '""')}"`;
}
