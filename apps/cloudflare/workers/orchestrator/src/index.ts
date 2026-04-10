import {
  buildAutonomousRunPlan,
  defaultHostBudgets,
  isHostMode,
  type HostMode,
} from '@emdash/content-policy';
import {
  buildExecutionEnvelope,
  defaultCloudflareGuardrails,
  parseCloudflareGuardMode,
  parseCloudflarePlanTier,
} from '@emdash/cloudflare-guardrails';

export interface Env {
  SYSTEM_NAME: string;
  CF_PLAN_TIER?: string;
  CF_RESOURCE_GUARD_MODE?: string;
  MAX_HOST_RUNS_PER_TICK?: string;
  MAX_BROWSER_AUDIT_URLS_PER_RUN?: string;
}

interface OrchestratorPayload {
  hostId?: string;
  hostName?: string;
  mode?: string;
  at?: string;
  reason?: string;
  requestedAuditUrls?: number;
  requestedHostRuns?: number;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method !== 'POST') {
      return new Response('Method Not Allowed', { status: 405 });
    }

    const payload = (await request.json().catch(() => ({}))) as OrchestratorPayload;
    const mode: HostMode = isHostMode(payload.mode) ? payload.mode : 'draft_only';
    const runPlan = buildAutonomousRunPlan(mode);
    const hostId = payload.hostId ?? 'default-host';
    const guardrails = defaultCloudflareGuardrails(
      parseCloudflarePlanTier(env.CF_PLAN_TIER),
      parseCloudflareGuardMode(env.CF_RESOURCE_GUARD_MODE),
    );
    const requestedHostRuns = clampRequestedCount(
      payload.requestedHostRuns ?? 1,
      env.MAX_HOST_RUNS_PER_TICK,
    );
    const requestedAuditUrls = clampRequestedCount(
      payload.requestedAuditUrls ?? 1,
      env.MAX_BROWSER_AUDIT_URLS_PER_RUN,
    );
    const executionEnvelope = buildExecutionEnvelope(guardrails, {
      hostMode: mode,
      requestedAuditUrls,
      requestedHostRuns,
    });

    return Response.json({
      ok: true,
      system: env.SYSTEM_NAME,
      received: payload,
      host: {
        id: hostId,
        name: payload.hostName ?? hostId,
        mode,
        budgets: defaultHostBudgets(),
      },
      runPlan,
      cloudflareGuardrails: guardrails,
      executionEnvelope,
      note: 'Reusable orchestrator pass: host mode resolves into a deterministic run plan and a Cloudflare-safe execution envelope. Next implementation pass should persist host state in D1 and dispatch Queues, Workflows, and Durable Object locks.',
    });
  },
};

function clampRequestedCount(requestedValue: number, envLimit: string | undefined): number {
  const normalized = Number.isFinite(requestedValue) ? requestedValue : 1;
  const envCap = envLimit ? Number(envLimit) : undefined;

  if (envCap && Number.isFinite(envCap) && envCap > 0) {
    return Math.min(Math.max(1, normalized), envCap);
  }

  return Math.max(1, normalized);
}
