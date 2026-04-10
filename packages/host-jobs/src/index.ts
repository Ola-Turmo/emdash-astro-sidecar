export type HostMode = 'observe_only' | 'draft_only' | 'refresh_auto' | 'publish_auto';
export type AutonomousTaskStep =
  | 'ingest_signals'
  | 'discover_topics'
  | 'draft_candidates'
  | 'evaluate_candidates'
  | 'publish_refreshes'
  | 'publish_net_new'
  | 'audit_live_routes'
  | 'sync_metrics'
  | 'optimize_prompts';

export interface AutonomousRunPlan {
  mode: HostMode;
  steps: AutonomousTaskStep[];
  publishAllowed: boolean;
}

export type HostJobStatus = 'queued' | 'running' | 'completed' | 'failed' | 'skipped';
export type HostWorkerKind = 'research-worker' | 'draft-worker' | 'future-worker';

export interface HostJobPayload {
  hostId: string;
  runId: string;
  mode: HostMode;
  requestedAt: string;
  requestedAuditUrls: number;
}

export interface SeededHostJob {
  hostId: string;
  runId: string;
  step: AutonomousTaskStep;
  workerKind: HostWorkerKind;
  priority: number;
  payload: HostJobPayload;
}

export interface HostJobKindDefinition {
  step: AutonomousTaskStep;
  workerKind: HostWorkerKind;
  priority: number;
  bounded: boolean;
}

export interface HostJobRow {
  id: string;
  host_id: string;
  run_id: string;
  step: AutonomousTaskStep;
  worker_kind: HostWorkerKind;
  status: HostJobStatus;
  priority: number;
  payload_json: string;
  attempt_count: number;
  lease_owner: string | null;
  lease_expires_at: string | null;
  last_error: string | null;
  created_at: string;
  updated_at: string;
}

export const hostJobRegistry: Record<AutonomousTaskStep, HostJobKindDefinition> = {
  ingest_signals: {
    step: 'ingest_signals',
    workerKind: 'research-worker',
    priority: 10,
    bounded: true,
  },
  discover_topics: {
    step: 'discover_topics',
    workerKind: 'research-worker',
    priority: 20,
    bounded: true,
  },
  sync_metrics: {
    step: 'sync_metrics',
    workerKind: 'research-worker',
    priority: 30,
    bounded: true,
  },
  optimize_prompts: {
    step: 'optimize_prompts',
    workerKind: 'research-worker',
    priority: 40,
    bounded: true,
  },
  draft_candidates: {
    step: 'draft_candidates',
    workerKind: 'draft-worker',
    priority: 50,
    bounded: true,
  },
  evaluate_candidates: {
    step: 'evaluate_candidates',
    workerKind: 'future-worker',
    priority: 60,
    bounded: true,
  },
  audit_live_routes: {
    step: 'audit_live_routes',
    workerKind: 'future-worker',
    priority: 70,
    bounded: true,
  },
  publish_refreshes: {
    step: 'publish_refreshes',
    workerKind: 'future-worker',
    priority: 80,
    bounded: true,
  },
  publish_net_new: {
    step: 'publish_net_new',
    workerKind: 'future-worker',
    priority: 90,
    bounded: true,
  },
};

export function seedJobsFromRunPlan(
  runPlan: AutonomousRunPlan,
  input: {
    hostId: string;
    runId: string;
    requestedAt: string;
    requestedAuditUrls: number;
    maxJobs: number;
  },
): SeededHostJob[] {
  return runPlan.steps
    .map((step: AutonomousTaskStep) => {
      const definition = hostJobRegistry[step];
      return {
        hostId: input.hostId,
        runId: input.runId,
        step,
        workerKind: definition.workerKind,
        priority: definition.priority,
        payload: {
          hostId: input.hostId,
          runId: input.runId,
          mode: runPlan.mode,
          requestedAt: input.requestedAt,
          requestedAuditUrls: input.requestedAuditUrls,
        },
      } satisfies SeededHostJob;
    })
    .slice(0, Math.max(0, input.maxJobs));
}

export function nextLeaseExpiry(nowIso: string, leaseSeconds: number): string {
  return new Date(Date.parse(nowIso) + leaseSeconds * 1000).toISOString();
}

export function workerSupportsStep(
  workerKind: HostWorkerKind,
  step: AutonomousTaskStep,
): boolean {
  return hostJobRegistry[step].workerKind === workerKind;
}
