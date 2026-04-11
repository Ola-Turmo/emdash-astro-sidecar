#!/usr/bin/env node

import { execFileSync } from 'node:child_process';
import crypto from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

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

function readWranglerOAuthToken() {
  const configPath = path.join(os.homedir(), '.wrangler', 'config', 'default.toml');
  if (!existsSync(configPath)) {
    return null;
  }

  const text = readFileSync(configPath, 'utf8');
  return text.match(/^oauth_token\s*=\s*"([^"]+)"/m)?.[1] ?? null;
}

function getApiToken() {
  return process.env.CLOUDFLARE_API_TOKEN || readWranglerOAuthToken();
}

function getAccountId() {
  if (process.env.CLOUDFLARE_ACCOUNT_ID) {
    return process.env.CLOUDFLARE_ACCOUNT_ID;
  }

  try {
    const output =
      process.platform === 'win32'
        ? execFileSync(process.env.ComSpec || 'cmd.exe', ['/c', 'pnpm', 'exec', 'wrangler', 'whoami', '--json'], {
            cwd: repoRoot,
            env: process.env,
            encoding: 'utf8',
            stdio: ['ignore', 'pipe', 'pipe'],
          })
        : execFileSync('pnpm', ['exec', 'wrangler', 'whoami', '--json'], {
            cwd: repoRoot,
            env: process.env,
            encoding: 'utf8',
            stdio: ['ignore', 'pipe', 'pipe'],
          });
    const parsed = JSON.parse(output);
    const accountId =
      parsed?.accounts?.[0]?.id ??
      parsed?.account?.id ??
      parsed?.memberships?.[0]?.account?.id ??
      null;
    if (accountId) {
      return accountId;
    }
  } catch {
    // fall through
  }

  throw new Error('Unable to resolve Cloudflare account id. Set CLOUDFLARE_ACCOUNT_ID or log in with wrangler.');
}

function buildSecretValue(secretName, options) {
  const explicit = process.env[secretName];
  if (explicit) {
    return explicit;
  }

  if (secretName === 'CONTENT_API_TOKEN' && options.rotateContentApiToken) {
    return crypto.randomBytes(32).toString('base64url');
  }

  return null;
}

async function putWorkerSecret({ accountId, apiToken, workerName, secretName, secretValue, dryRun }) {
  const endpoint = `https://api.cloudflare.com/client/v4/accounts/${accountId}/workers/scripts/${workerName}/secrets`;
  if (dryRun) {
    console.log(`[dry-run] Would set ${secretName} on ${workerName}`);
    return;
  }

  const response = await fetch(endpoint, {
    method: 'PUT',
    headers: {
      authorization: `Bearer ${apiToken}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      name: secretName,
      text: secretValue,
      type: 'secret_text',
    }),
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload?.success === false) {
    throw new Error(
      `Failed to set ${secretName} on ${workerName}: ${payload?.errors?.[0]?.message || response.status}`,
    );
  }

  console.log(`Set ${secretName} on ${workerName}`);
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const workers = resolveWorkers(options);

  if (!workers.length) {
    throw new Error('No workers matched the provided filters.');
  }

  const apiToken = getApiToken();
  if (!apiToken) {
    throw new Error('Missing Cloudflare API/OAuth token. Log in with wrangler or set CLOUDFLARE_API_TOKEN.');
  }

  const accountId = getAccountId();
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

      await putWorkerSecret({
        accountId,
        apiToken,
        workerName,
        secretName,
        secretValue,
        dryRun: options.dryRun,
      });

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
