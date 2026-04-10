import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const repoRoot = process.cwd();
const registryPath = resolve(repoRoot, 'docs', 'autonomous-worker-registry.json');
const registry = JSON.parse(readFileSync(registryPath, 'utf8'));

const missingShared = registry.sharedSecrets.filter((name) => !process.env[name]);
const workersWithMissingSecrets = registry.workers
  .map((worker) => ({
    ...worker,
    missingSecrets: (worker.requiredSecrets || []).filter((name) => !process.env[name]),
  }))
  .filter((worker) => worker.missingSecrets.length > 0);

console.log(
  JSON.stringify(
    {
      ok: missingShared.length === 0 && workersWithMissingSecrets.length === 0,
      missingShared,
      workersWithMissingSecrets,
      optionalSecretsPresent: registry.optionalSecrets.filter((name) => Boolean(process.env[name])),
    },
    null,
    2,
  ),
);

if (missingShared.length > 0 || workersWithMissingSecrets.length > 0) {
  process.exitCode = 1;
}
