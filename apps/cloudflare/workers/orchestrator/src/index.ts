import {
  buildAutonomousRunPlan,
  defaultHostBudgets,
  isHostMode,
  type HostBudgets,
  type HostMode,
} from '../../../../../packages/content-policy/src/index';
import {
  buildExecutionEnvelope,
  defaultCloudflareGuardrails,
  parseCloudflareGuardMode,
  parseCloudflarePlanTier,
} from '../../../../../packages/cloudflare-guardrails/src/index';
import {
  acquireHostRun,
  createInitialHostRuntimeState,
  normalizeHostRuntimeState,
  releaseHostRun,
  type HostLockDecision,
  type HostRuntimeState,
} from '../../../../../packages/host-control/src/index';
import {
  seedJobsFromRunPlan,
  type HostJobRow,
  type SeededHostJob,
} from '../../../../../packages/host-jobs/src/index';

export interface Env {
  SYSTEM_NAME: string;
  AUTONOMOUS_DB: D1Database;
  HOST_CONTROL: DurableObjectNamespace;
  CF_PLAN_TIER?: string;
  CF_RESOURCE_GUARD_MODE?: string;
  MAX_HOST_RUNS_PER_TICK?: string;
  MAX_BROWSER_AUDIT_URLS_PER_RUN?: string;
  HOST_LOCK_TTL_SECONDS?: string;
  HOST_FAILURE_COOLDOWN_MINUTES?: string;
}

interface OrchestratorPayload {
  action?: 'start' | 'complete' | 'fail';
  hostId?: string;
  hostName?: string;
  siteUrl?: string;
  basePath?: string;
  mode?: string;
  at?: string;
  reason?: string;
  requestedAuditUrls?: number;
  requestedHostRuns?: number;
  runId?: string;
}

interface HostRow {
  id: string;
  host_name: string;
  site_url: string;
  base_path: string;
}

interface HostModeRow {
  mode: HostMode;
}

interface HostBudgetRow {
  max_net_new_pages_per_week: number;
  max_auto_refreshes_per_day: number;
  max_draft_attempts_per_day: number;
  max_provider_retries_per_hour: number;
}

interface HostRuntimeRow {
  host_id: string;
  status: HostRuntimeState['status'];
  cooldown_until: string | null;
  lock_owner: string | null;
  lock_expires_at: string | null;
  last_run_started_at: string | null;
  last_run_finished_at: string | null;
  last_run_reason: string | null;
  consecutive_failures: number;
  updated_at: string;
}

interface DurableObjectActionPayload {
  action: 'acquire' | 'release';
  hostId: string;
  runId: string;
  now: string;
  lockTtlSeconds?: number;
  cooldownMinutesOnFailure?: number;
  outcome?: 'success' | 'failed';
  reason?: string;
}

const HOST_STATE_KEY = 'runtime-state';

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method !== 'POST') {
      return new Response('Method Not Allowed', { status: 405 });
    }

    const payload = (await request.json().catch(() => ({}))) as OrchestratorPayload;
    const now = payload.at ?? new Date().toISOString();
    const hostId = payload.hostId ?? 'default-host';
    const hostName = payload.hostName ?? hostId;
    const mode: HostMode = isHostMode(payload.mode) ? payload.mode : 'draft_only';
    const runId = payload.runId ?? crypto.randomUUID();
    const action = payload.action ?? 'start';

    const guardrails = defaultCloudflareGuardrails(
      parseCloudflarePlanTier(env.CF_PLAN_TIER),
      parseCloudflareGuardMode(env.CF_RESOURCE_GUARD_MODE),
    );
    const executionEnvelope = buildExecutionEnvelope(guardrails, {
      hostMode: mode,
      requestedAuditUrls: clampRequestedCount(
        payload.requestedAuditUrls ?? 1,
        env.MAX_BROWSER_AUDIT_URLS_PER_RUN,
      ),
      requestedHostRuns: clampRequestedCount(
        payload.requestedHostRuns ?? 1,
        env.MAX_HOST_RUNS_PER_TICK,
      ),
    });

    const host = await ensureHostRecord(env.AUTONOMOUS_DB, {
      id: hostId,
      hostName,
      siteUrl: payload.siteUrl ?? `https://${hostName}`,
      basePath: payload.basePath ?? '/guide',
      mode,
    });
    const budgets = await ensureHostBudgets(env.AUTONOMOUS_DB, hostId);

    if (action === 'start') {
      const lockDecision = await requestHostLock(env, {
        action: 'acquire',
        hostId,
        runId,
        now,
        lockTtlSeconds: clampRequestedCount(300, env.HOST_LOCK_TTL_SECONDS),
        reason: payload.reason ?? 'scheduled_tick',
      });

      await persistHostRuntimeState(env.AUTONOMOUS_DB, hostId, lockDecision.state);
      await insertHostRunEvent(env.AUTONOMOUS_DB, {
        hostId,
        runId,
        eventType: lockDecision.granted ? 'run_acquired' : 'run_blocked',
        detail: {
          action,
          reason: lockDecision.reason,
          mode,
          executionEnvelope,
        },
      });

      if (!lockDecision.granted) {
        return Response.json(
          {
            ok: false,
            system: env.SYSTEM_NAME,
            host,
            budgets,
            runId,
            action,
            lockDecision,
            cloudflareGuardrails: guardrails,
            executionEnvelope,
          },
          { status: lockDecision.reason === 'cooldown_active' ? 429 : 409 },
        );
      }

      const runPlan = buildAutonomousRunPlan(mode);
      const seededJobs = seedJobsFromRunPlan(runPlan, {
        hostId,
        runId,
        requestedAt: now,
        requestedAuditUrls: executionEnvelope.allowedAuditUrlsThisRun,
        maxJobs: executionEnvelope.queueMessagesThisRun,
      });
      await insertHostJobs(env.AUTONOMOUS_DB, seededJobs);
      const queuedJobs = await listHostJobs(env.AUTONOMOUS_DB, hostId, runId);

      return Response.json({
        ok: true,
        system: env.SYSTEM_NAME,
        host,
        budgets,
        runId,
        action,
        runPlan,
        lockDecision,
        queuedJobs,
        cloudflareGuardrails: guardrails,
        executionEnvelope,
        note: 'Host run acquired and bounded jobs were queued in D1. Next implementation pass should dispatch these jobs through dedicated workers, Queues, or Workflows.',
      });
    }

    const releaseDecision = await requestHostLock(env, {
      action: 'release',
      hostId,
      runId,
      now,
      outcome: action === 'fail' ? 'failed' : 'success',
      cooldownMinutesOnFailure: clampRequestedCount(10, env.HOST_FAILURE_COOLDOWN_MINUTES),
      reason: payload.reason ?? (action === 'fail' ? 'run_failed' : 'run_completed'),
    });

    await persistHostRuntimeState(env.AUTONOMOUS_DB, hostId, releaseDecision.state);
    await insertHostRunEvent(env.AUTONOMOUS_DB, {
      hostId,
      runId,
      eventType: action === 'fail' ? 'run_failed' : 'run_completed',
      detail: {
        action,
        reason: releaseDecision.reason,
        mode,
      },
    });

    return Response.json({
      ok: releaseDecision.granted,
      system: env.SYSTEM_NAME,
      host,
      budgets,
      runId,
      action,
      lockDecision: releaseDecision,
      cloudflareGuardrails: guardrails,
      executionEnvelope,
    });
  },
};

export class HostControlDO {
  constructor(private readonly state: DurableObjectState) {}

  async fetch(request: Request): Promise<Response> {
    if (request.method !== 'POST') {
      return new Response('Method Not Allowed', { status: 405 });
    }

    const payload = (await request.json()) as DurableObjectActionPayload;

    const decision = await this.state.blockConcurrencyWhile(async () => {
      const current =
        (await this.state.storage.get<HostRuntimeState>(HOST_STATE_KEY)) ??
        createInitialHostRuntimeState(payload.hostId, payload.now);

      if (payload.action === 'acquire') {
        const next = acquireHostRun(current, {
          hostId: payload.hostId,
          runId: payload.runId,
          now: payload.now,
          lockTtlSeconds: payload.lockTtlSeconds ?? 300,
          reason: payload.reason,
        });
        await this.state.storage.put(HOST_STATE_KEY, next.state);
        return next;
      }

      const next = releaseHostRun(current, {
        runId: payload.runId,
        now: payload.now,
        outcome: payload.outcome ?? 'success',
        cooldownMinutesOnFailure: payload.cooldownMinutesOnFailure,
        reason: payload.reason,
      });
      await this.state.storage.put(HOST_STATE_KEY, next.state);
      return next;
    });

    return Response.json(decision, { status: decision.granted ? 200 : 409 });
  }
}

async function ensureHostRecord(
  db: D1Database,
  input: {
    id: string;
    hostName: string;
    siteUrl: string;
    basePath: string;
    mode: HostMode;
  },
): Promise<HostRow> {
  await db
    .prepare(
      `
        INSERT INTO hosts (id, host_name, site_url, base_path)
        VALUES (?1, ?2, ?3, ?4)
        ON CONFLICT(id) DO UPDATE SET
          host_name = excluded.host_name,
          site_url = excluded.site_url,
          base_path = excluded.base_path
      `,
    )
    .bind(input.id, input.hostName, input.siteUrl, input.basePath)
    .run();

  await db
    .prepare(
      `
        INSERT INTO host_modes (host_id, mode)
        VALUES (?1, ?2)
        ON CONFLICT(host_id) DO UPDATE SET
          mode = excluded.mode,
          updated_at = CURRENT_TIMESTAMP
      `,
    )
    .bind(input.id, input.mode)
    .run();

  await db
    .prepare(
      `
        INSERT INTO host_runtime_state (
          host_id,
          status,
          cooldown_until,
          lock_owner,
          lock_expires_at,
          last_run_started_at,
          last_run_finished_at,
          last_run_reason,
          consecutive_failures,
          updated_at
        )
        VALUES (?1, 'idle', NULL, NULL, NULL, NULL, NULL, NULL, 0, CURRENT_TIMESTAMP)
        ON CONFLICT(host_id) DO NOTHING
      `,
    )
    .bind(input.id)
    .run();

  const host = await db
    .prepare(
      `
        SELECT id, host_name, site_url, base_path
        FROM hosts
        WHERE id = ?1
      `,
    )
    .bind(input.id)
    .first<HostRow>();

  if (!host) {
    throw new Error(`Failed to resolve host record for ${input.id}.`);
  }

  return host;
}

async function ensureHostBudgets(db: D1Database, hostId: string): Promise<HostBudgets> {
  const defaults = defaultHostBudgets();

  await db
    .prepare(
      `
        INSERT INTO host_budgets (
          host_id,
          max_net_new_pages_per_week,
          max_auto_refreshes_per_day,
          max_draft_attempts_per_day,
          max_provider_retries_per_hour
        )
        VALUES (?1, ?2, ?3, ?4, ?5)
        ON CONFLICT(host_id) DO NOTHING
      `,
    )
    .bind(
      hostId,
      defaults.maxNetNewPagesPerWeek,
      defaults.maxAutoRefreshesPerDay,
      defaults.maxDraftAttemptsPerDay,
      defaults.maxProviderRetriesPerHour,
    )
    .run();

  const row = await db
    .prepare(
      `
        SELECT
          max_net_new_pages_per_week,
          max_auto_refreshes_per_day,
          max_draft_attempts_per_day,
          max_provider_retries_per_hour
        FROM host_budgets
        WHERE host_id = ?1
      `,
    )
    .bind(hostId)
    .first<HostBudgetRow>();

  return row
    ? {
        maxNetNewPagesPerWeek: row.max_net_new_pages_per_week,
        maxAutoRefreshesPerDay: row.max_auto_refreshes_per_day,
        maxDraftAttemptsPerDay: row.max_draft_attempts_per_day,
        maxProviderRetriesPerHour: row.max_provider_retries_per_hour,
      }
    : defaults;
}

async function requestHostLock(env: Env, payload: DurableObjectActionPayload): Promise<HostLockDecision> {
  const objectId = env.HOST_CONTROL.idFromName(payload.hostId);
  const stub = env.HOST_CONTROL.get(objectId);
  const response = await stub.fetch('https://host-control.internal', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok && response.status !== 409) {
    throw new Error(`Host control Durable Object returned ${response.status}.`);
  }

  return (await response.json()) as HostLockDecision;
}

async function persistHostRuntimeState(
  db: D1Database,
  hostId: string,
  state: HostRuntimeState,
): Promise<void> {
  const normalized = normalizeHostRuntimeState(state, state.updatedAt);
  await db
    .prepare(
      `
        INSERT INTO host_runtime_state (
          host_id,
          status,
          cooldown_until,
          lock_owner,
          lock_expires_at,
          last_run_started_at,
          last_run_finished_at,
          last_run_reason,
          consecutive_failures,
          updated_at
        )
        VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)
        ON CONFLICT(host_id) DO UPDATE SET
          status = excluded.status,
          cooldown_until = excluded.cooldown_until,
          lock_owner = excluded.lock_owner,
          lock_expires_at = excluded.lock_expires_at,
          last_run_started_at = excluded.last_run_started_at,
          last_run_finished_at = excluded.last_run_finished_at,
          last_run_reason = excluded.last_run_reason,
          consecutive_failures = excluded.consecutive_failures,
          updated_at = excluded.updated_at
      `,
    )
    .bind(
      hostId,
      normalized.status,
      normalized.cooldownUntil,
      normalized.lockOwner,
      normalized.lockExpiresAt,
      normalized.lastRunStartedAt,
      normalized.lastRunFinishedAt,
      normalized.lastRunReason,
      normalized.consecutiveFailures,
      normalized.updatedAt,
    )
    .run();
}

async function insertHostRunEvent(
  db: D1Database,
  input: {
    hostId: string;
    runId: string;
    eventType: 'run_requested' | 'run_acquired' | 'run_blocked' | 'run_completed' | 'run_failed';
    detail: Record<string, unknown>;
  },
): Promise<void> {
  await db
    .prepare(
      `
        INSERT INTO host_run_events (id, host_id, run_id, event_type, detail_json)
        VALUES (?1, ?2, ?3, ?4, ?5)
      `,
    )
    .bind(crypto.randomUUID(), input.hostId, input.runId, input.eventType, JSON.stringify(input.detail))
    .run();
}

async function insertHostJobs(db: D1Database, jobs: SeededHostJob[]): Promise<void> {
  for (const job of jobs) {
    await db
      .prepare(
        `
          INSERT INTO host_jobs (
            id,
            host_id,
            run_id,
            step,
            worker_kind,
            status,
            priority,
            payload_json,
            attempt_count,
            lease_owner,
            lease_expires_at,
            last_error,
            updated_at
          )
          VALUES (?1, ?2, ?3, ?4, ?5, 'queued', ?6, ?7, 0, NULL, NULL, NULL, ?8)
        `,
      )
      .bind(
        crypto.randomUUID(),
        job.hostId,
        job.runId,
        job.step,
        job.workerKind,
        job.priority,
        JSON.stringify(job.payload),
        job.payload.requestedAt,
      )
      .run();
  }
}

async function listHostJobs(db: D1Database, hostId: string, runId: string): Promise<HostJobRow[]> {
  const result = await db
    .prepare(
      `
        SELECT
          id,
          host_id,
          run_id,
          step,
          worker_kind,
          status,
          priority,
          payload_json,
          attempt_count,
          lease_owner,
          lease_expires_at,
          last_error,
          created_at,
          updated_at
        FROM host_jobs
        WHERE host_id = ?1 AND run_id = ?2
        ORDER BY priority ASC, created_at ASC
      `,
    )
    .bind(hostId, runId)
    .all<HostJobRow>();

  return result.results;
}

function clampRequestedCount(requestedValue: number, envLimit: string | undefined): number {
  const normalized = Number.isFinite(requestedValue) ? requestedValue : 1;
  const envCap = envLimit ? Number(envLimit) : undefined;

  if (envCap && Number.isFinite(envCap) && envCap > 0) {
    return Math.min(Math.max(1, normalized), envCap);
  }

  return Math.max(1, normalized);
}
