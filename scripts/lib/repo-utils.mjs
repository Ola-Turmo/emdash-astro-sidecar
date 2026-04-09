import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';

export async function walkFiles(rootDir, predicate = () => true) {
  const entries = await readdir(rootDir, { withFileTypes: true });
  const results = [];

  for (const entry of entries) {
    if (entry.name === 'node_modules' || entry.name === '.git' || entry.name === 'dist' || entry.name === '.astro') {
      continue;
    }

    const fullPath = path.join(rootDir, entry.name);
    if (entry.isDirectory()) {
      results.push(...await walkFiles(fullPath, predicate));
      continue;
    }

    if (predicate(fullPath)) {
      results.push(fullPath);
    }
  }

  return results;
}

export async function readUtf8(filePath) {
  return readFile(filePath, 'utf8');
}

export function extractStringValue(source, fieldName) {
  const regex = new RegExp(`${fieldName}:\\s*'([^']+)'`);
  const match = source.match(regex);
  if (!match) {
    throw new Error(`Could not find string field "${fieldName}"`);
  }
  return match[1];
}

export function failIfFindings(findings, heading) {
  if (!findings.length) {
    return;
  }

  console.error(`\n${heading}`);
  for (const finding of findings) {
    console.error(`- ${finding}`);
  }
  process.exit(1);
}
