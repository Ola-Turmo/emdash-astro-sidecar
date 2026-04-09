#!/usr/bin/env node

import { mkdir, writeFile } from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  analyzePage,
  generateReport,
  summarizeDesign,
  exportAsJson,
  generateTheme,
} from '../packages/design-clone/src/index.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');

function resolveOutputDir(targetUrl, explicitOutputDir) {
  if (explicitOutputDir) {
    return path.resolve(repoRoot, explicitOutputDir);
  }

  const hostname = new URL(targetUrl).hostname.replace(/^www\./, '');
  return path.join(repoRoot, 'packages', 'theme-core', 'theme-output', hostname);
}

function printUsage() {
  console.log(`Usage:
  node scripts/design-clone.mjs analyze <url> [output-dir]
  node scripts/design-clone.mjs clone <url> [output-dir]

Examples:
  pnpm design:clone -- analyze https://www.kurs.ing/
  pnpm design:clone -- clone https://www.kurs.ing/ apps/blog/src/generated-theme
`);
}

async function main() {
  const [command, targetUrl, explicitOutputDir] = process.argv.slice(2);

  if (!command || !targetUrl || !['analyze', 'clone'].includes(command)) {
    printUsage();
    process.exit(command ? 1 : 0);
  }

  const outputDir = resolveOutputDir(targetUrl, explicitOutputDir);
  await mkdir(outputDir, { recursive: true });

  const design = await analyzePage(targetUrl);
  const report = generateReport(design);
  const summary = summarizeDesign(report);

  await writeFile(path.join(outputDir, 'design-report.json'), exportAsJson(report));
  await writeFile(path.join(outputDir, 'design-summary.txt'), `${summary}\n`);

  console.log(summary);
  console.log(`\nReport written to ${path.join(outputDir, 'design-report.json')}`);

  if (command === 'clone') {
    await generateTheme(design, outputDir);
    console.log(`Theme output written to ${outputDir}`);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
