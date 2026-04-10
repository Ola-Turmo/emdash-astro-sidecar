export type CloudflarePlanTier = 'free' | 'paid';
export type CloudflareGuardMode = 'conservative' | 'balanced' | 'aggressive';
export type AuditSamplingPolicy = 'disabled' | 'homepage_only' | 'critical_routes' | 'all_public_routes';
export type RuntimeHostMode = 'observe_only' | 'draft_only' | 'refresh_auto' | 'publish_auto';

export interface WorkerGuardrails {
  cpuMsPerInvocation: number;
  maxSubrequestsPerRun: number;
}

export interface D1Guardrails {
  maxQueriesPerRun: number;
  maxWriteStatementsPerRun: number;
  maxRowsPerWriteBatch: number;
}

export interface QueueGuardrails {
  maxMessagesPerRun: number;
  maxPayloadBytes: number;
}

export interface WorkflowGuardrails {
  maxStepsPerRun: number;
  maxSleepTransitionsPerRun: number;
}

export interface BrowserRenderingGuardrails {
  enabledByDefault: boolean;
  maxUrlsPerRun: number;
  maxParallelSessions: number;
  samplingPolicy: AuditSamplingPolicy;
}

export interface DurableObjectGuardrails {
  maxHotHostsPerTick: number;
  lockTtlSeconds: number;
}

export interface CloudflareServiceGuardrails {
  planTier: CloudflarePlanTier;
  guardMode: CloudflareGuardMode;
  workers: WorkerGuardrails;
  d1: D1Guardrails;
  queues: QueueGuardrails;
  workflows: WorkflowGuardrails;
  browserRendering: BrowserRenderingGuardrails;
  durableObjects: DurableObjectGuardrails;
}

export interface ExecutionEnvelopeInput {
  hostMode: RuntimeHostMode;
  requestedAuditUrls?: number;
  requestedHostRuns?: number;
}

export interface CloudflareExecutionEnvelope {
  allowedHostRunsThisTick: number;
  allowedAuditUrlsThisRun: number;
  browserAuditEnabled: boolean;
  queueMessagesThisRun: number;
  maxD1QueriesThisRun: number;
  warnings: string[];
}

export function parseCloudflarePlanTier(value?: string): CloudflarePlanTier {
  return value === 'paid' ? 'paid' : 'free';
}

export function parseCloudflareGuardMode(value?: string): CloudflareGuardMode {
  if (value === 'balanced' || value === 'aggressive') return value;
  return 'conservative';
}

export function defaultCloudflareGuardrails(
  planTier: CloudflarePlanTier,
  guardMode: CloudflareGuardMode,
): CloudflareServiceGuardrails {
  const presets: Record<CloudflareGuardMode, Omit<CloudflareServiceGuardrails, 'planTier' | 'guardMode'>> =
    planTier === 'paid'
      ? {
          conservative: {
            workers: { cpuMsPerInvocation: 10_000, maxSubrequestsPerRun: 50 },
            d1: { maxQueriesPerRun: 40, maxWriteStatementsPerRun: 10, maxRowsPerWriteBatch: 50 },
            queues: { maxMessagesPerRun: 20, maxPayloadBytes: 128 * 1024 },
            workflows: { maxStepsPerRun: 18, maxSleepTransitionsPerRun: 4 },
            browserRendering: {
              enabledByDefault: true,
              maxUrlsPerRun: 2,
              maxParallelSessions: 1,
              samplingPolicy: 'critical_routes',
            },
            durableObjects: { maxHotHostsPerTick: 1, lockTtlSeconds: 300 },
          },
          balanced: {
            workers: { cpuMsPerInvocation: 20_000, maxSubrequestsPerRun: 75 },
            d1: { maxQueriesPerRun: 60, maxWriteStatementsPerRun: 15, maxRowsPerWriteBatch: 100 },
            queues: { maxMessagesPerRun: 40, maxPayloadBytes: 128 * 1024 },
            workflows: { maxStepsPerRun: 24, maxSleepTransitionsPerRun: 6 },
            browserRendering: {
              enabledByDefault: true,
              maxUrlsPerRun: 5,
              maxParallelSessions: 2,
              samplingPolicy: 'critical_routes',
            },
            durableObjects: { maxHotHostsPerTick: 2, lockTtlSeconds: 300 },
          },
          aggressive: {
            workers: { cpuMsPerInvocation: 30_000, maxSubrequestsPerRun: 100 },
            d1: { maxQueriesPerRun: 80, maxWriteStatementsPerRun: 20, maxRowsPerWriteBatch: 150 },
            queues: { maxMessagesPerRun: 75, maxPayloadBytes: 128 * 1024 },
            workflows: { maxStepsPerRun: 30, maxSleepTransitionsPerRun: 8 },
            browserRendering: {
              enabledByDefault: true,
              maxUrlsPerRun: 8,
              maxParallelSessions: 2,
              samplingPolicy: 'all_public_routes',
            },
            durableObjects: { maxHotHostsPerTick: 3, lockTtlSeconds: 300 },
          },
        }
      : {
          conservative: {
            workers: { cpuMsPerInvocation: 5_000, maxSubrequestsPerRun: 25 },
            d1: { maxQueriesPerRun: 20, maxWriteStatementsPerRun: 5, maxRowsPerWriteBatch: 25 },
            queues: { maxMessagesPerRun: 8, maxPayloadBytes: 64 * 1024 },
            workflows: { maxStepsPerRun: 12, maxSleepTransitionsPerRun: 2 },
            browserRendering: {
              enabledByDefault: false,
              maxUrlsPerRun: 0,
              maxParallelSessions: 0,
              samplingPolicy: 'disabled',
            },
            durableObjects: { maxHotHostsPerTick: 1, lockTtlSeconds: 300 },
          },
          balanced: {
            workers: { cpuMsPerInvocation: 8_000, maxSubrequestsPerRun: 35 },
            d1: { maxQueriesPerRun: 30, maxWriteStatementsPerRun: 8, maxRowsPerWriteBatch: 40 },
            queues: { maxMessagesPerRun: 12, maxPayloadBytes: 64 * 1024 },
            workflows: { maxStepsPerRun: 16, maxSleepTransitionsPerRun: 3 },
            browserRendering: {
              enabledByDefault: true,
              maxUrlsPerRun: 1,
              maxParallelSessions: 1,
              samplingPolicy: 'homepage_only',
            },
            durableObjects: { maxHotHostsPerTick: 1, lockTtlSeconds: 300 },
          },
          aggressive: {
            workers: { cpuMsPerInvocation: 10_000, maxSubrequestsPerRun: 50 },
            d1: { maxQueriesPerRun: 40, maxWriteStatementsPerRun: 10, maxRowsPerWriteBatch: 50 },
            queues: { maxMessagesPerRun: 20, maxPayloadBytes: 64 * 1024 },
            workflows: { maxStepsPerRun: 20, maxSleepTransitionsPerRun: 4 },
            browserRendering: {
              enabledByDefault: true,
              maxUrlsPerRun: 2,
              maxParallelSessions: 1,
              samplingPolicy: 'critical_routes',
            },
            durableObjects: { maxHotHostsPerTick: 1, lockTtlSeconds: 300 },
          },
        };

  return {
    planTier,
    guardMode,
    ...presets[guardMode],
  };
}

export function buildExecutionEnvelope(
  guardrails: CloudflareServiceGuardrails,
  input: ExecutionEnvelopeInput,
): CloudflareExecutionEnvelope {
  const warnings: string[] = [];
  const requestedAuditUrls = Math.max(0, input.requestedAuditUrls ?? 0);
  const requestedHostRuns = Math.max(1, input.requestedHostRuns ?? 1);

  const browserAuditEnabled =
    guardrails.browserRendering.enabledByDefault && input.hostMode !== 'observe_only';
  const allowedAuditUrlsThisRun = browserAuditEnabled
    ? Math.min(requestedAuditUrls || 1, guardrails.browserRendering.maxUrlsPerRun)
    : 0;

  if (requestedHostRuns > guardrails.durableObjects.maxHotHostsPerTick) {
    warnings.push(
      `Requested ${requestedHostRuns} host runs, capped at ${guardrails.durableObjects.maxHotHostsPerTick}.`,
    );
  }

  if (!browserAuditEnabled && requestedAuditUrls > 0) {
    warnings.push('Browser Rendering audit is disabled by the current Cloudflare guardrail profile.');
  } else if (requestedAuditUrls > allowedAuditUrlsThisRun) {
    warnings.push(
      `Requested ${requestedAuditUrls} audit URLs, capped at ${allowedAuditUrlsThisRun} for this run.`,
    );
  }

  if (input.hostMode === 'publish_auto' && guardrails.guardMode === 'conservative') {
    warnings.push('publish_auto requested under conservative Cloudflare guardrails; keep host count and audit breadth low.');
  }

  return {
    allowedHostRunsThisTick: Math.min(requestedHostRuns, guardrails.durableObjects.maxHotHostsPerTick),
    allowedAuditUrlsThisRun,
    browserAuditEnabled,
    queueMessagesThisRun: guardrails.queues.maxMessagesPerRun,
    maxD1QueriesThisRun: guardrails.d1.maxQueriesPerRun,
    warnings,
  };
}
