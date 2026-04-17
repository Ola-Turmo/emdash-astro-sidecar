#!/usr/bin/env node

import { execFileSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');
const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
const outputDir = path.join(repoRoot, 'output', 'control-plane-backups', timestamp);

function maybeCopy(source, targetName, manifest) {
  if (!existsSync(source)) return;
  const target = path.join(outputDir, targetName);
  cpSync(source, target, { recursive: true });
  manifest.copied.push(targetName);
}

function main() {
  mkdirSync(outputDir, { recursive: true });
  const manifest = {
    generatedAt: new Date().toISOString(),
    copied: [],
    exports: [],
    warnings: [],
  };

  maybeCopy(path.join(repoRoot, 'apps', 'cloudflare', 'd1', 'migrations'), 'd1-migrations', manifest);
  maybeCopy(path.join(repoRoot, '.autonomous'), 'autonomous-state', manifest);

  for (const reportDir of [
    'release-health',
    'field-performance',
    'lighthouse-budgets',
    'accessibility',
    'security-headers',
    'structured-data',
    'crawlability',
    'edge-parity',
    'dependency-audit',
  ]) {
    maybeCopy(path.join(repoRoot, 'output', reportDir), path.join('quality-output', reportDir), manifest);
  }

  const wranglerConfig = path.join(repoRoot, 'apps', 'cloudflare', 'workers', 'orchestrator', 'wrangler.toml');
  if (existsSync(wranglerConfig) && process.env.CLOUDFLARE_API_TOKEN) {
    try {
      const exportPath = path.join(outputDir, 'autonomous-db.sql');
      execFileSync(
        process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm',
        ['exec', 'wrangler', 'd1', 'export', 'emdash-autonomous-control-plane', '--remote', '--output', exportPath, '--config', wranglerConfig],
        { cwd: repoRoot, stdio: 'pipe' },
      );
      manifest.exports.push('autonomous-db.sql');
    } catch (error) {
      manifest.warnings.push(`Remote D1 export failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  } else {
    manifest.warnings.push('Skipped remote D1 export because CLOUDFLARE_API_TOKEN is unavailable.');
  }

  writeFileSync(path.join(outputDir, 'manifest.json'), JSON.stringify(manifest, null, 2));
  writeFileSync(
    path.join(outputDir, 'README.md'),
    `# Control-plane backup\n\nGenerated: ${manifest.generatedAt}\n\n## Copied\n${manifest.copied.map((entry) => `- ${entry}`).join('\n') || '- None'}\n\n## Exports\n${manifest.exports.map((entry) => `- ${entry}`).join('\n') || '- None'}\n\n## Warnings\n${manifest.warnings.map((entry) => `- ${entry}`).join('\n') || '- None'}\n`,
  );

  console.log(`Control-plane backup written to ${outputDir}`);
}

main();
