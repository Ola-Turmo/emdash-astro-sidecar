#!/usr/bin/env node

import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

const repoRoot = process.cwd();
const localSecretsPath = path.join(repoRoot, 'config', 'secrets.local.json');

let cachedSecrets = null;

export function loadLocalSecrets() {
  if (cachedSecrets) {
    return cachedSecrets;
  }

  if (!existsSync(localSecretsPath)) {
    cachedSecrets = {};
    return cachedSecrets;
  }

  const text = readFileSync(localSecretsPath, 'utf8').replace(/^\uFEFF/, '');
  cachedSecrets = JSON.parse(text);
  return cachedSecrets;
}

export function getSecretValue(secretName) {
  return process.env[secretName] || loadLocalSecrets()[secretName] || null;
}

export function getLocalSecretsPath() {
  return localSecretsPath;
}
