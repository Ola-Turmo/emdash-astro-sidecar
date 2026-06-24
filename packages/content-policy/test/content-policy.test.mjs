// test/content-policy.test.mjs — unit tests for @emdash/content-policy
//
// Uses Node 22's built-in node:test runner. No new dependencies.
//
// Run with: pnpm test  (or: node --test test/content-policy.test.mjs)
//
// What this covers:
//   - defaultHostBudgets() — the default 4-field budget shape.
//   - isHostMode() — the 4 valid HostMode string literals.
//   - buildAutonomousRunPlan() — per-mode step list and publishAllowed flag.
//   - evaluatePublishDecision() — the full allow/deny matrix:
//     observe_only → always denied with the right reason
//     draft_only   → always denied with the right reason
//     all evals passed + within budget → allowed
//     each individual blocker (eval, audit, evidence, topic, dup, retry,
//     draft-attempt, refresh, net-new-budget, mode-vs-net-new) → denied
//     with the right reason
//
// The `reasons` array is the contract: each blocker must push a
// distinctive, machine-readable reason string. Tests pin those strings
// so a future refactor that rewrites them (or merges them) is caught
// in code review.

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  defaultHostBudgets,
  buildAutonomousRunPlan,
  isHostMode,
  evaluatePublishDecision,
} from '../src/index.ts';

// ----- defaults & type guards --------------------------------------------

test('defaultHostBudgets returns the documented conservative defaults', () => {
  const b = defaultHostBudgets();
  // Pin the numbers so a refactor that changes them intentionally
  // is caught in code review. The default host is meant to be
  // conservative — 1 net-new page / week, 2 refreshes / day,
  // 10 drafts / day, 3 provider retries / hour.
  assert.deepEqual(b, {
    maxNetNewPagesPerWeek: 1,
    maxAutoRefreshesPerDay: 2,
    maxDraftAttemptsPerDay: 10,
    maxProviderRetriesPerHour: 3,
  });
});

test('isHostMode accepts the 4 documented modes', () => {
  assert.equal(isHostMode('observe_only'), true);
  assert.equal(isHostMode('draft_only'), true);
  assert.equal(isHostMode('refresh_auto'), true);
  assert.equal(isHostMode('publish_auto'), true);
});

test('isHostMode rejects unrelated strings', () => {
  assert.equal(isHostMode('publish'), false);
  assert.equal(isHostMode('OBSERVE_ONLY'), false, 'case-sensitive');
  assert.equal(isHostMode(''), false);
  assert.equal(isHostMode(undefined), false);
  assert.equal(isHostMode(null), false);
});

// ----- buildAutonomousRunPlan --------------------------------------------

test('buildAutonomousRunPlan: observe_only has the common steps and no publish', () => {
  const plan = buildAutonomousRunPlan('observe_only');
  assert.equal(plan.mode, 'observe_only');
  assert.equal(plan.publishAllowed, false);
  assert.deepEqual(plan.steps, [
    'ingest_signals',
    'discover_topics',
    'sync_metrics',
    'audit_live_routes',
    'optimize_prompts',
  ]);
});

test('buildAutonomousRunPlan: draft_only adds draft steps but not publish', () => {
  const plan = buildAutonomousRunPlan('draft_only');
  assert.equal(plan.publishAllowed, false);
  assert.ok(plan.steps.includes('draft_candidates'), 'draft mode should draft');
  assert.ok(plan.steps.includes('evaluate_candidates'), 'draft mode should evaluate');
  assert.ok(!plan.steps.includes('publish_refreshes'), 'draft mode should not refresh-publish');
  assert.ok(!plan.steps.includes('publish_net_new'), 'draft mode should not net-new-publish');
});

test('buildAutonomousRunPlan: refresh_auto adds publish_refreshes but not publish_net_new', () => {
  const plan = buildAutonomousRunPlan('refresh_auto');
  assert.equal(plan.publishAllowed, true);
  assert.ok(plan.steps.includes('publish_refreshes'), 'refresh_auto should publish refreshes');
  assert.ok(!plan.steps.includes('publish_net_new'), 'refresh_auto should NOT publish net-new (this is enforced by evaluatePublishDecision too)');
});

test('buildAutonomousRunPlan: publish_auto includes the full pipeline', () => {
  const plan = buildAutonomousRunPlan('publish_auto');
  assert.equal(plan.publishAllowed, true);
  assert.deepEqual(plan.steps, [
    'ingest_signals',
    'discover_topics',
    'sync_metrics',
    'audit_live_routes',
    'optimize_prompts',
    'draft_candidates',
    'evaluate_candidates',
    'publish_refreshes',
    'publish_net_new',
  ]);
});

test('buildAutonomousRunPlan: every plan has the common 5 steps as a prefix', () => {
  const common = ['ingest_signals', 'discover_topics', 'sync_metrics', 'audit_live_routes', 'optimize_prompts'];
  for (const mode of ['observe_only', 'draft_only', 'refresh_auto', 'publish_auto']) {
    const plan = buildAutonomousRunPlan(mode);
    for (let i = 0; i < common.length; i++) {
      assert.equal(plan.steps[i], common[i], `mode ${mode} step ${i} should be ${common[i]}, got ${plan.steps[i]}`);
    }
  }
});

// ----- evaluatePublishDecision: helper to build a passing input ---------

const passingDecisionInput = (overrides = {}) => ({
  hostMode: 'publish_auto',
  budgets: defaultHostBudgets(),
  netNewPagesPublishedThisWeek: 0,
  autoRefreshesToday: 0,
  draftAttemptsToday: 0,
  providerRetriesThisHour: 0,
  allContentEvalsPassed: true,
  routeAuditPassed: true,
  evidenceThresholdMet: true,
  topicApproved: true,
  duplicateRiskDetected: false,
  isNetNewPage: false,
  ...overrides,
});

// ----- observe_only / draft_only are always denied ----------------------

test('evaluatePublishDecision: observe_only is always denied with the right reason', () => {
  const result = evaluatePublishDecision(passingDecisionInput({ hostMode: 'observe_only' }));
  assert.equal(result.allowed, false);
  assert.deepEqual(result.reasons, ['Host is in observe_only mode.']);
});

test('evaluatePublishDecision: draft_only is always denied with the right reason', () => {
  const result = evaluatePublishDecision(passingDecisionInput({ hostMode: 'draft_only' }));
  assert.equal(result.allowed, false);
  assert.deepEqual(result.reasons, ['Host is in draft_only mode.']);
});

// ----- happy path ---------------------------------------------------------

test('evaluatePublishDecision: all-passing publish_auto is allowed with zero reasons', () => {
  const result = evaluatePublishDecision(passingDecisionInput());
  assert.equal(result.allowed, true);
  assert.deepEqual(result.reasons, []);
});

test('evaluatePublishDecision: refresh_auto + refresh-only is allowed', () => {
  const result = evaluatePublishDecision(passingDecisionInput({ hostMode: 'refresh_auto', isNetNewPage: false }));
  assert.equal(result.allowed, true);
  assert.deepEqual(result.reasons, []);
});

// ----- each blocker independently produces its reason -------------------

test('evaluatePublishDecision: allContentEvalsPassed=false is denied with the right reason', () => {
  const result = evaluatePublishDecision(passingDecisionInput({ allContentEvalsPassed: false }));
  assert.equal(result.allowed, false);
  assert.ok(result.reasons.includes('One or more content evals failed.'));
});

test('evaluatePublishDecision: routeAuditPassed=false is denied with the right reason', () => {
  const result = evaluatePublishDecision(passingDecisionInput({ routeAuditPassed: false }));
  assert.equal(result.allowed, false);
  assert.ok(result.reasons.includes('Route or browser audit did not pass.'));
});

test('evaluatePublishDecision: evidenceThresholdMet=false is denied with the right reason', () => {
  const result = evaluatePublishDecision(passingDecisionInput({ evidenceThresholdMet: false }));
  assert.equal(result.allowed, false);
  assert.ok(result.reasons.includes('Evidence threshold not met.'));
});

test('evaluatePublishDecision: topicApproved=false is denied with the right reason', () => {
  const result = evaluatePublishDecision(passingDecisionInput({ topicApproved: false }));
  assert.equal(result.allowed, false);
  assert.ok(result.reasons.includes('Topic is outside approved host scope.'));
});

test('evaluatePublishDecision: duplicateRiskDetected=true is denied with the right reason', () => {
  const result = evaluatePublishDecision(passingDecisionInput({ duplicateRiskDetected: true }));
  assert.equal(result.allowed, false);
  assert.ok(result.reasons.includes('Duplicate or near-duplicate content risk detected.'));
});

// ----- budget gates ------------------------------------------------------

test('evaluatePublishDecision: provider retries over the hourly budget is denied', () => {
  const result = evaluatePublishDecision(passingDecisionInput({ providerRetriesThisHour: 4 }));
  assert.equal(result.allowed, false);
  assert.ok(result.reasons.includes('Provider retry budget exceeded.'));
});

test('evaluatePublishDecision: provider retries exactly at the budget is still allowed', () => {
  // The check is `> budgets.maxProviderRetriesPerHour`, so equal-to-budget is OK.
  const result = evaluatePublishDecision(passingDecisionInput({ providerRetriesThisHour: 3 }));
  assert.equal(result.allowed, true);
});

test('evaluatePublishDecision: draft attempts over the daily budget is denied', () => {
  const result = evaluatePublishDecision(passingDecisionInput({ draftAttemptsToday: 11 }));
  assert.equal(result.allowed, false);
  assert.ok(result.reasons.includes('Draft attempt budget exceeded.'));
});

test('evaluatePublishDecision: auto refreshes over the daily budget is denied', () => {
  const result = evaluatePublishDecision(passingDecisionInput({ autoRefreshesToday: 3 }));
  assert.equal(result.allowed, false);
  assert.ok(result.reasons.includes('Auto refresh budget exceeded.'));
});

// ----- net-new gates -----------------------------------------------------

test('evaluatePublishDecision: net-new page in publish_auto over weekly budget is denied', () => {
  const result = evaluatePublishDecision(passingDecisionInput({
    isNetNewPage: true,
    netNewPagesPublishedThisWeek: 2,
  }));
  assert.equal(result.allowed, false);
  assert.ok(result.reasons.includes('Net-new publish budget exceeded.'));
});

test('evaluatePublishDecision: net-new page in publish_auto at weekly budget is still allowed', () => {
  // The check is `> budgets.maxNetNewPagesPerWeek`, so equal-to-budget is OK.
  const result = evaluatePublishDecision(passingDecisionInput({
    isNetNewPage: true,
    netNewPagesPublishedThisWeek: 1,
  }));
  assert.equal(result.allowed, true);
});

test('evaluatePublishDecision: net-new page in refresh_auto is denied with the right reason', () => {
  // refresh_auto has publishAllowed=true at the plan level, but a
  // net-new publish in refresh_auto mode is blocked because it
  // doesn't fit the mode's intent. The decision logic enforces this
  // even though the plan-level step list doesn't include
  // publish_net_new (which is also a separate defense-in-depth).
  const result = evaluatePublishDecision(passingDecisionInput({
    hostMode: 'refresh_auto',
    isNetNewPage: true,
  }));
  assert.equal(result.allowed, false);
  assert.ok(result.reasons.includes('refresh_auto mode cannot publish net-new pages.'));
});

test('evaluatePublishDecision: net-new budget gate is not checked for refresh-only pages', () => {
  // isNetNewPage=false should skip the net-new-publish-budget check
  // entirely, regardless of the counter. (We use a high counter to
  // prove the gate is gated by isNetNewPage, not by the counter.)
  const result = evaluatePublishDecision(passingDecisionInput({
    isNetNewPage: false,
    netNewPagesPublishedThisWeek: 999,
  }));
  assert.equal(result.allowed, true);
});

// ----- combinations ------------------------------------------------------

test('evaluatePublishDecision: multiple blockers accumulate reasons', () => {
  const result = evaluatePublishDecision(passingDecisionInput({
    allContentEvalsPassed: false,
    topicApproved: false,
    providerRetriesThisHour: 99,
  }));
  assert.equal(result.allowed, false);
  assert.equal(result.reasons.length, 3);
  assert.ok(result.reasons.includes('One or more content evals failed.'));
  assert.ok(result.reasons.includes('Topic is outside approved host scope.'));
  assert.ok(result.reasons.includes('Provider retry budget exceeded.'));
});

test('evaluatePublishDecision: observe_only + every other gate failing surfaces ALL reasons, not just the mode reason', () => {
  // Documented contract: evaluatePublishDecision accumulates EVERY
  // failing reason, not just the first. The host-mode reason
  // (observe_only / draft_only) is NOT short-circuiting — the
  // operator wants to see all the things that need fixing in one
  // audit pass, not just the mode flag.
  const result = evaluatePublishDecision(passingDecisionInput({
    hostMode: 'observe_only',
    allContentEvalsPassed: false,
    topicApproved: false,
    duplicateRiskDetected: true,
  }));
  assert.equal(result.allowed, false);
  assert.ok(result.reasons.includes('Host is in observe_only mode.'));
  assert.ok(result.reasons.includes('One or more content evals failed.'));
  assert.ok(result.reasons.includes('Topic is outside approved host scope.'));
  assert.ok(result.reasons.includes('Duplicate or near-duplicate content risk detected.'));
});

// ----- regression: the 8 documented gate reasons -------------------------

test('evaluatePublishDecision: the gate set is stable (regression)', () => {
  // Pin the full set of reason strings the decision function can
  // produce. A future refactor that rewrites or merges them would
  // silently break downstream log-based monitoring / alerts. This
  // test forces the rename to be a deliberate code change.
  const allGates = evaluatePublishDecision(passingDecisionInput({
    hostMode: 'observe_only',   // 1
    allContentEvalsPassed: false,  // 2
    routeAuditPassed: false,    // 3
    evidenceThresholdMet: false,  // 4
    topicApproved: false,       // 5
    duplicateRiskDetected: true,  // 6
    providerRetriesThisHour: 99,  // 7
    draftAttemptsToday: 99,      // 8
    autoRefreshesToday: 99,      // 9
    isNetNewPage: true,          // 10
    netNewPagesPublishedThisWeek: 99,  // (10 continues)
  }));
  // observe_only + draft_only = 1 reason (the mode). Plus 8 from the
  // rest of the gates. Net-new-budget + refresh-auto-mode-net-new
  // can both fire (the net-new-budget reason fires when the counter
  // is over; the mode reason fires when isNetNewPage+refresh_auto).
  // We don't pin an exact count; we pin the SET of reason strings.
  const expected = new Set([
    'Host is in observe_only mode.',
    'One or more content evals failed.',
    'Route or browser audit did not pass.',
    'Evidence threshold not met.',
    'Topic is outside approved host scope.',
    'Duplicate or near-duplicate content risk detected.',
    'Provider retry budget exceeded.',
    'Draft attempt budget exceeded.',
    'Auto refresh budget exceeded.',
    'Net-new publish budget exceeded.',
  ]);
  for (const r of allGates.reasons) {
    assert.ok(expected.has(r), `unexpected reason: ${r}`);
  }
  // Refresh-auto + net-new only fires when hostMode is refresh_auto;
  // we didn't toggle that, so the reason should NOT be in the set.
  assert.ok(!allGates.reasons.includes('refresh_auto mode cannot publish net-new pages.'));
});

test('evaluatePublishDecision: refresh_auto + net-new exposes the mode-specific reason alongside others', () => {
  const result = evaluatePublishDecision(passingDecisionInput({
    hostMode: 'refresh_auto',
    isNetNewPage: true,
    allContentEvalsPassed: false,  // add a second reason
  }));
  assert.equal(result.allowed, false);
  assert.ok(result.reasons.includes('refresh_auto mode cannot publish net-new pages.'));
  assert.ok(result.reasons.includes('One or more content evals failed.'));
  // The 2 reasons are exactly these two; nothing else fires.
  assert.equal(result.reasons.length, 2);
});
