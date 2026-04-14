#!/usr/bin/env node

import crypto from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { detectCloudflareAuth, runWrangler } from './cloudflare-auth.mjs';
import { getSecretValue } from './local-secret-store.mjs';

const repoRoot = process.cwd();
const registryPath = path.join(repoRoot, 'docs', 'autonomous-worker-registry.json');
const registry = JSON.parse(readFileSync(registryPath, 'utf8'));

function parseArgs(argv) {
  return {
    kind: argv.find((arg) => arg.startsWith('--kind='))?.replace('--kind=', ''),
    worker: argv.find((arg) => arg.startsWith('--worker='))?.replace('--worker=', ''),
    rotateContentApiToken: argv.includes('--rotate-content-api-token'),
    dryRun: argv.includes('--dry-run'),
  };
}

function resolveWorkers(options) {
  return registry.workers.filter((worker) => {
    if (options.worker) return worker.name === options.worker;
    if (options.kind) return worker.kind === options.kind;
    return true;
  });
}

function readWranglerName(configPath) {
  const text = readFileSync(path.join(repoRoot, configPath), 'utf8');
  const match = text.match(/^name\s*=\s*"([^"]+)"/m);
  if (!match) {
    throw new Error(`Could not find worker name in ${configPath}`);
  }
  return match[1];
}

function buildSecretValue(secretName, options) {
  const explicit = getSecretValue(secretName);
  if (explicit) {
    return explicit;
  }

  if (secretName === 'CONTENT_API_TOKEN' && options.rotateContentApiToken) {
    return crypto.randomBytes(32).toString('base64url');
  }

  return null;
}

function putSecret({ configPath, workerName, secretName, secretValue, dryRun }) {
  if (dryRun) {
    console.log(`[dry-run] Would set ${secretName} on ${workerName}`);
    return;
  }

  runWrangler(['secret', 'put', secretName, '--config', configPath], {
    cwd: repoRoot,
    input: `${secretValue}\n`,
    stdio: 'inherit',
  });
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const workers = resolveWorkers(options);

  if (!workers.length) {
    throw new Error('No workers matched the provided filters.');
  }

  const authState = detectCloudflareAuth();
  console.log(`[cloudflare-auth] ${authState.recommendation}`);

  const generatedSecrets = [];

  for (const worker of workers) {
    const workerName = readWranglerName(worker.wranglerConfig);
    const requiredSecrets = worker.requiredSecrets ?? [];
    const optionalSecrets = worker.optionalSecrets ?? [];

    for (const secretName of [...requiredSecrets, ...optionalSecrets]) {
      const secretValue = buildSecretValue(secretName, options);
      if (!secretValue) {
        if (requiredSecrets.includes(secretName)) {
          throw new Error(`Missing required secret value for ${secretName}.`);
        }
        continue;
      }

      putSecret({
        configPath: worker.wranglerConfig,
        workerName,
        secretName,
        secretValue,
        dryRun: options.dryRun,
      });

      console.log(`Set ${secretName} on ${workerName}`);

      if (secretName === 'CONTENT_API_TOKEN' && options.rotateContentApiToken) {
        generatedSecrets.push(secretName);
      }
    }
  }

  if (generatedSecrets.length) {
    console.log(
      `Generated and pushed ${generatedSecrets.join(', ')} directly to Cloudflare. Save your operator copy now if an external client still needs it.`,
    );
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
