import { readFileSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(scriptDir, '..');

const requiredFiles = [
  'docs/cloudflare-resource-guardrails.md',
  'packages/cloudflare-guardrails/src/index.ts',
  'packages/host-control/src/index.ts',
  'packages/host-jobs/src/index.ts',
  'packages/publish-engine/src/index.ts',
  'apps/cloudflare/d1/migrations/0002_host_runtime_control.sql',
  'apps/cloudflare/d1/migrations/0003_host_jobs.sql',
  'apps/cloudflare/d1/migrations/0004_content_artifacts.sql',
  'apps/cloudflare/d1/migrations/0005_publication_artifacts.sql',
  'apps/cloudflare/workers/scheduler/wrangler.toml',
  'apps/cloudflare/workers/orchestrator/wrangler.toml',
  'apps/cloudflare/workers/browser-audit-worker/wrangler.toml',
  'apps/cloudflare/workers/research-worker/wrangler.toml',
  'apps/cloudflare/workers/draft-worker/wrangler.toml',
  'apps/cloudflare/workers/eval-worker/wrangler.toml',
  'apps/cloudflare/workers/publish-worker/wrangler.toml',
];

const workerExpectations = [
  {
    path: 'apps/cloudflare/workers/scheduler/wrangler.toml',
    checks: ['[limits]', 'cpu_ms', 'CF_PLAN_TIER', 'CF_RESOURCE_GUARD_MODE', 'MAX_HOST_RUNS_PER_TICK'],
  },
  {
    path: 'apps/cloudflare/workers/orchestrator/wrangler.toml',
    checks: [
      '[limits]',
      'cpu_ms',
      'AUTONOMOUS_DB',
      'HOST_CONTROL',
      'CF_PLAN_TIER',
      'CF_RESOURCE_GUARD_MODE',
      'MAX_HOST_RUNS_PER_TICK',
      'MAX_BROWSER_AUDIT_URLS_PER_RUN',
      'HOST_LOCK_TTL_SECONDS',
      'HOST_FAILURE_COOLDOWN_MINUTES',
    ],
  },
  {
    path: 'apps/cloudflare/workers/browser-audit-worker/wrangler.toml',
    checks: [
      '[limits]',
      'cpu_ms',
      'CF_PLAN_TIER',
      'CF_RESOURCE_GUARD_MODE',
      'BROWSER_AUDIT_ENABLED',
      'MAX_AUDIT_URLS_PER_RUN',
    ],
  },
];

const failures = [];

for (const relativePath of requiredFiles) {
  const absolutePath = resolve(repoRoot, relativePath);
  if (!existsSync(absolutePath)) {
    failures.push(`Missing required Cloudflare guardrail file: ${relativePath}`);
  }
}

for (const expectation of workerExpectations) {
  const absolutePath = resolve(repoRoot, expectation.path);
  const content = readFileSync(absolutePath, 'utf8');
  for (const token of expectation.checks) {
    if (!content.includes(token)) {
      failures.push(`${expectation.path} is missing required guardrail token: ${token}`);
    }
  }
}

if (failures.length > 0) {
  console.error('Cloudflare resource guardrail gate failed:\n');
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log('Cloudflare resource guardrail gate passed');
