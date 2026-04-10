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

export interface HostBudgets {
  maxNetNewPagesPerWeek: number;
  maxAutoRefreshesPerDay: number;
  maxDraftAttemptsPerDay: number;
  maxProviderRetriesPerHour: number;
}

export interface PublishDecisionInput {
  hostMode: HostMode;
  budgets: HostBudgets;
  netNewPagesPublishedThisWeek: number;
  autoRefreshesToday: number;
  draftAttemptsToday: number;
  providerRetriesThisHour: number;
  allContentEvalsPassed: boolean;
  routeAuditPassed: boolean;
  evidenceThresholdMet: boolean;
  topicApproved: boolean;
  duplicateRiskDetected: boolean;
  isNetNewPage: boolean;
}

export interface PublishDecision {
  allowed: boolean;
  reasons: string[];
}

export interface AutonomousRunPlan {
  mode: HostMode;
  steps: AutonomousTaskStep[];
  publishAllowed: boolean;
}

export function defaultHostBudgets(): HostBudgets {
  return {
    maxNetNewPagesPerWeek: 1,
    maxAutoRefreshesPerDay: 2,
    maxDraftAttemptsPerDay: 10,
    maxProviderRetriesPerHour: 3,
  };
}

export function buildAutonomousRunPlan(mode: HostMode): AutonomousRunPlan {
  const commonSteps: AutonomousTaskStep[] = [
    'ingest_signals',
    'discover_topics',
    'sync_metrics',
    'audit_live_routes',
    'optimize_prompts',
  ];

  if (mode === 'observe_only') {
    return {
      mode,
      steps: commonSteps,
      publishAllowed: false,
    };
  }

  const draftSteps: AutonomousTaskStep[] = [...commonSteps, 'draft_candidates', 'evaluate_candidates'];

  if (mode === 'draft_only') {
    return {
      mode,
      steps: draftSteps,
      publishAllowed: false,
    };
  }

  if (mode === 'refresh_auto') {
    return {
      mode,
      steps: [...draftSteps, 'publish_refreshes'],
      publishAllowed: true,
    };
  }

  return {
    mode,
    steps: [...draftSteps, 'publish_refreshes', 'publish_net_new'],
    publishAllowed: true,
  };
}

export function isHostMode(value: string | undefined): value is HostMode {
  return (
    value === 'observe_only' ||
    value === 'draft_only' ||
    value === 'refresh_auto' ||
    value === 'publish_auto'
  );
}

export function evaluatePublishDecision(input: PublishDecisionInput): PublishDecision {
  const reasons: string[] = [];

  if (input.hostMode === 'observe_only') {
    reasons.push('Host is in observe_only mode.');
  }
  if (input.hostMode === 'draft_only') {
    reasons.push('Host is in draft_only mode.');
  }
  if (!input.allContentEvalsPassed) {
    reasons.push('One or more content evals failed.');
  }
  if (!input.routeAuditPassed) {
    reasons.push('Route or browser audit did not pass.');
  }
  if (!input.evidenceThresholdMet) {
    reasons.push('Evidence threshold not met.');
  }
  if (!input.topicApproved) {
    reasons.push('Topic is outside approved host scope.');
  }
  if (input.duplicateRiskDetected) {
    reasons.push('Duplicate or near-duplicate content risk detected.');
  }
  if (input.providerRetriesThisHour > input.budgets.maxProviderRetriesPerHour) {
    reasons.push('Provider retry budget exceeded.');
  }
  if (input.draftAttemptsToday > input.budgets.maxDraftAttemptsPerDay) {
    reasons.push('Draft attempt budget exceeded.');
  }
  if (input.autoRefreshesToday > input.budgets.maxAutoRefreshesPerDay) {
    reasons.push('Auto refresh budget exceeded.');
  }
  if (
    input.isNetNewPage &&
    input.netNewPagesPublishedThisWeek > input.budgets.maxNetNewPagesPerWeek
  ) {
    reasons.push('Net-new publish budget exceeded.');
  }
  if (input.isNetNewPage && input.hostMode === 'refresh_auto') {
    reasons.push('refresh_auto mode cannot publish net-new pages.');
  }

  return {
    allowed: reasons.length === 0,
    reasons,
  };
}
