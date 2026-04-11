#!/usr/bin/env node

import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

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
    textChecks: [
      {
        file: 'index.html',
        snippets: ['Forklart enkelt', 'Det du må vite om etablererprøven'],
      },
    ],
  },
  {
    siteKey: 'kurs-ing',
    conceptKey: 'kommune',
    expectedFiles: [
      'index.html',
      path.join('oslo', 'index.html'),
      path.join('bergen', 'index.html'),
      path.join('sandefjord', 'index.html'),
      path.join('alta', 'index.html'),
      path.join('trondheim', 'index.html'),
      path.join('stavanger', 'index.html'),
    ],
    textChecks: [
      {
        file: 'index.html',
        snippets: ['Kommuneguide', 'Velg kommunen du vil se nærmere på'],
      },
      {
        file: path.join('oslo', 'index.html'),
        snippets: ['Kontaktpunkter', 'Skjenking og servering', 'Datagrunnlag'],
      },
    ],
  },
  {
    siteKey: 'gatareba-ge',
    conceptKey: 'guide',
    expectedFiles: ['index.html'],
    textChecks: [
      {
        file: 'index.html',
        snippets: ['Replace this profile', 'Example only'],
      },
    ],
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
  const distRoot = path.join(blogAppRoot, 'dist');

  for (const relativePath of target.expectedFiles) {
    const absolutePath = path.join(distRoot, relativePath);
    if (!existsSync(absolutePath)) {
      throw new Error(`Missing expected build output for ${target.siteKey}/${target.conceptKey}: ${relativePath}`);
    }
  }

  for (const check of target.textChecks) {
    const absolutePath = path.join(distRoot, check.file);
    const html = readFileSync(absolutePath, 'utf8');
    for (const snippet of check.snippets) {
      if (!html.includes(snippet)) {
        throw new Error(
          `Missing expected concept text for ${target.siteKey}/${target.conceptKey} in ${check.file}: ${snippet}`,
        );
      }
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
