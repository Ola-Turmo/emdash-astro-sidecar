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
  'packages/metrics-ingestion/src/index.ts',
  'apps/cloudflare/d1/migrations/0002_host_runtime_control.sql',
  'apps/cloudflare/d1/migrations/0003_host_jobs.sql',
  'apps/cloudflare/d1/migrations/0004_content_artifacts.sql',
  'apps/cloudflare/d1/migrations/0005_publication_artifacts.sql',
  'apps/cloudflare/d1/migrations/0006_publication_materializations.sql',
  'apps/cloudflare/d1/migrations/0007_host_jobs_publish_worker.sql',
  'apps/cloudflare/d1/migrations/0008_draft_metadata.sql',
  'apps/cloudflare/d1/migrations/0010_metrics_ingestion.sql',
  'apps/cloudflare/workers/scheduler/wrangler.toml',
  'apps/cloudflare/workers/orchestrator/wrangler.toml',
  'apps/cloudflare/workers/browser-audit-worker/wrangler.toml',
  'apps/cloudflare/workers/content-api/wrangler.toml',
  'apps/cloudflare/workers/router-worker/wrangler.toml',
  'apps/cloudflare/workers/apex-site-proxy/wrangler.toml',
  'apps/cloudflare/workers/research-worker/wrangler.toml',
  'apps/cloudflare/workers/draft-worker/wrangler.toml',
  'apps/cloudflare/workers/eval-worker/wrangler.toml',
  'apps/cloudflare/workers/publish-worker/wrangler.toml',
  'apps/cloudflare/workers/metrics-worker/wrangler.toml',
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
    path: 'apps/cloudflare/workers/draft-worker/wrangler.toml',
    checks: [
      '[limits]',
      'cpu_ms',
      'AUTONOMOUS_DB',
      'AUTONOMOUS_ALLOW_FALLBACK_DRAFTS',
      'DRAFT_MAX_OUTPUT_TOKENS',
      'AUTONOMOUS_PROVIDER_ID',
      'AUTONOMOUS_FALLBACK_PROVIDER_ID',
    ],
  },
  {
    path: 'apps/cloudflare/workers/eval-worker/wrangler.toml',
    checks: ['[limits]', 'cpu_ms', 'AUTONOMOUS_DB', 'JOB_LEASE_SECONDS', 'EVAL_MAX_JOBS_PER_RUN'],
  },
  {
    path: 'apps/cloudflare/workers/content-api/wrangler.toml',
    checks: ['[limits]', 'cpu_ms', 'AUTONOMOUS_DB', 'MATERIALIZE_BATCH_LIMIT'],
  },
  {
    path: 'apps/cloudflare/workers/metrics-worker/wrangler.toml',
    checks: ['[limits]', 'cpu_ms', 'AUTONOMOUS_DB', 'JOB_LEASE_SECONDS', 'METRICS_MAX_SOURCES_PER_RUN'],
  },
  {
    path: 'apps/cloudflare/workers/router-worker/wrangler.toml',
    checks: ['ROOT_SITE_ORIGIN', 'https://new.kurs.ing'],
  },
  {
    path: 'apps/cloudflare/workers/apex-site-proxy/wrangler.toml',
    checks: ['ROOT_SITE_ORIGIN', 'kurs.ing/*', 'https://new.kurs.ing'],
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
