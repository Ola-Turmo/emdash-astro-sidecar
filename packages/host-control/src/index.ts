export type HostRuntimeStatus = 'idle' | 'running' | 'cooldown';
export type HostRunOutcome = 'success' | 'failed';

export interface HostRuntimeState {
  hostId: string;
  status: HostRuntimeStatus;
  cooldownUntil?: string | null;
  lockOwner?: string | null;
  lockExpiresAt?: string | null;
  lastRunStartedAt?: string | null;
  lastRunFinishedAt?: string | null;
  lastRunReason?: string | null;
  consecutiveFailures: number;
  updatedAt: string;
}

export interface HostLockAcquireInput {
  hostId: string;
  runId: string;
  now: string;
  lockTtlSeconds: number;
  reason?: string;
}

export interface HostLockReleaseInput {
  runId: string;
  now: string;
  outcome: HostRunOutcome;
  cooldownMinutesOnFailure?: number;
  reason?: string;
}

export interface HostLockDecision {
  granted: boolean;
  status: HostRuntimeStatus;
  reason: 'acquired' | 'locked' | 'cooldown_active' | 'released' | 'lock_not_owned' | 'missing_state';
  state: HostRuntimeState;
}

export function createInitialHostRuntimeState(
  hostId: string,
  now = new Date().toISOString(),
): HostRuntimeState {
  return {
    hostId,
    status: 'idle',
    cooldownUntil: null,
    lockOwner: null,
    lockExpiresAt: null,
    lastRunStartedAt: null,
    lastRunFinishedAt: null,
    lastRunReason: null,
    consecutiveFailures: 0,
    updatedAt: now,
  };
}

export function isCooldownActive(state: HostRuntimeState, nowIso: string): boolean {
  return Boolean(state.cooldownUntil && Date.parse(state.cooldownUntil) > Date.parse(nowIso));
}

export function isLockActive(state: HostRuntimeState, nowIso: string): boolean {
  return Boolean(state.lockExpiresAt && Date.parse(state.lockExpiresAt) > Date.parse(nowIso));
}

export function acquireHostRun(
  state: HostRuntimeState,
  input: HostLockAcquireInput,
): HostLockDecision {
  if (isCooldownActive(state, input.now)) {
    return {
      granted: false,
      status: 'cooldown',
      reason: 'cooldown_active',
      state: withNormalizedStatus(state, input.now),
    };
  }

  if (isLockActive(state, input.now) && state.lockOwner !== input.runId) {
    return {
      granted: false,
      status: 'running',
      reason: 'locked',
      state: withNormalizedStatus(state, input.now),
    };
  }

  const nextState: HostRuntimeState = {
    ...state,
    status: 'running',
    cooldownUntil: null,
    lockOwner: input.runId,
    lockExpiresAt: new Date(Date.parse(input.now) + input.lockTtlSeconds * 1000).toISOString(),
    lastRunStartedAt: input.now,
    lastRunReason: input.reason ?? state.lastRunReason ?? null,
    updatedAt: input.now,
  };

  return {
    granted: true,
    status: nextState.status,
    reason: 'acquired',
    state: nextState,
  };
}

export function releaseHostRun(
  state: HostRuntimeState | undefined,
  input: HostLockReleaseInput,
): HostLockDecision {
  if (!state) {
    return {
      granted: false,
      status: 'idle',
      reason: 'missing_state',
      state: createInitialHostRuntimeState('unknown', input.now),
    };
  }

  if (state.lockOwner && state.lockOwner !== input.runId) {
    return {
      granted: false,
      status: state.status,
      reason: 'lock_not_owned',
      state: withNormalizedStatus(state, input.now),
    };
  }

  const consecutiveFailures =
    input.outcome === 'failed' ? state.consecutiveFailures + 1 : 0;
  const nextStatus: HostRuntimeStatus = input.outcome === 'failed' ? 'cooldown' : 'idle';
  const cooldownUntil =
    input.outcome === 'failed'
      ? new Date(
          Date.parse(input.now) + (input.cooldownMinutesOnFailure ?? cooldownMinutesForFailures(consecutiveFailures)) * 60_000,
        ).toISOString()
      : null;

  const nextState: HostRuntimeState = {
    ...state,
    status: nextStatus,
    cooldownUntil,
    lockOwner: null,
    lockExpiresAt: null,
    lastRunFinishedAt: input.now,
    lastRunReason: input.reason ?? state.lastRunReason ?? null,
    consecutiveFailures,
    updatedAt: input.now,
  };

  return {
    granted: true,
    status: nextState.status,
    reason: 'released',
    state: nextState,
  };
}

export function cooldownMinutesForFailures(consecutiveFailures: number): number {
  if (consecutiveFailures <= 1) return 10;
  if (consecutiveFailures === 2) return 30;
  if (consecutiveFailures === 3) return 60;
  return 180;
}

export function normalizeHostRuntimeState(
  state: HostRuntimeState,
  now = new Date().toISOString(),
): HostRuntimeState {
  return withNormalizedStatus(state, now);
}

function withNormalizedStatus(state: HostRuntimeState, nowIso: string): HostRuntimeState {
  if (isCooldownActive(state, nowIso)) {
    return {
      ...state,
      status: 'cooldown',
    };
  }

  if (isLockActive(state, nowIso)) {
    return {
      ...state,
      status: 'running',
    };
  }

  return {
    ...state,
    status: 'idle',
    cooldownUntil: null,
    lockOwner: null,
    lockExpiresAt: null,
    updatedAt: nowIso,
  };
}
