---
name: autonomous-host-operator
description: Operate the autonomous EmDash Astro Sidecar control plane safely for a host site. Use when configuring provider secrets, choosing host mode, testing TheClawBay or MiniMax, running provider health checks, reviewing run-plan behavior, or preparing the system for continuous research, drafting, refresh, and audit loops on Cloudflare.
---

# Autonomous Host Operator

Use this skill when the repo is being prepared or operated as a continuous Cloudflare-native content system rather than a one-off blog deployment.

## Read First

Read these files in order:

1. `docs/provider-runtime.md`
2. `docs/cloudflare-resource-guardrails.md`
3. `docs/prd-autonomous-content-control-plane.md`
4. `docs/autonomous-content-control-plane-technical-design.md`
5. `docs/autonomous-content-control-plane-backlog.md`
6. `docs/copy-guidelines.md`
7. `docs/quality-gates.md`

## Main Working Surfaces

- `packages/model-runtime/src/index.ts`
- `packages/autoresearch-core/src/index.ts`
- `packages/content-evals/src/index.ts`
- `packages/content-policy/src/index.ts`
- `apps/cloudflare/d1/migrations/0001_autonomous_content_control_plane.sql`
- `apps/cloudflare/workers/scheduler/src/index.ts`
- `apps/cloudflare/workers/orchestrator/src/index.ts`
- `apps/cloudflare/workers/browser-audit-worker/src/index.ts`

## Provider Rules

Treat provider setup as configuration, not as a hardcoded app decision.

Seed providers:

- TheClawBay
- MiniMax

Secrets and vars:

- `THECLAWBAY_API_KEY`
- `THECLAWBAY_BASE_URL`
- `THECLAWBAY_MODEL`
- `MINIMAX_API_KEY`
- `MINIMAX_BASE_URL`
- `MINIMAX_MODEL`

Run the provider reachability check before trying to automate anything:

1. `pnpm providers:health`
2. `pnpm providers:health -- --provider theclawbay`
3. `pnpm providers:health -- --provider minimax`

If a provider returns a billing, auth, or quota error, do not pretend the runtime is healthy.

## Cloudflare Resource Rule

Before enabling any continuous host loop, run:

1. `pnpm qa:cloudflare`
2. `pnpm verify`

Treat these as blocking checks.

Default rule:

- `CF_PLAN_TIER=free`
- `CF_RESOURCE_GUARD_MODE=conservative`

Only loosen those values deliberately after verifying:

- provider health
- route audits
- publish blocking
- D1 and queue behavior
- browser-audit sampling costs

## Host-Mode Rule

Start every new host in `draft_only`.

Promote only when the lower mode is stable:

1. `observe_only`
2. `draft_only`
3. `refresh_auto`
4. `publish_auto`

Do not skip straight to `publish_auto`.

## Reader-First Rule

The autonomous loop must never publish copy that sounds like internal operator language.

Ban visible phrases like:

- sidecar
- GEO layer
- content wave
- control plane
- orchestration flow
- how this blog connects to the main site

Reader-facing copy should explain:

- what the user wants to know
- what the page helps them decide or do
- what the next practical step is

## Publish Safety Rule

Do not publish unless all of these are true:

- host mode allows it
- budgets allow it
- topic is in scope
- content evals pass
- evidence threshold is met
- duplicate risk is low
- route and live audit checks pass

If any of these fail, the correct outcome is to block publishing and log the reason.

## Command Baseline

Before shipping or enabling stronger automation modes:

1. `pnpm verify`
2. `pnpm qa`
3. `pnpm qa:cloudflare`
4. `pnpm audit:deployed`
5. `pnpm audit:deployed:lighthouse`

## Cloudflare Rule

Keep long-running intelligence in:

- D1
- R2
- Workflows
- Queues
- Durable Objects

Do not bolt new autonomous behavior onto the legacy `emdash-worker`.

## Success Criteria

Treat the system as ready only when:

- provider health is known
- host mode is intentional
- live route audits are clean
- copy stays reader-first
- publish decisions are explainable
