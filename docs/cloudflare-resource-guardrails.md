# Cloudflare Resource Guardrails

The autonomous control plane should be continuous, but it should not burn through Cloudflare services by accident.

This document defines the repo's default resource posture for:

- Workers CPU and subrequests
- D1 query volume
- Queues fan-out volume
- Workflow step breadth
- Durable Object host concurrency
- Browser Rendering usage

## Why This Exists

The repo is designed to run continuously on Cloudflare, but the safest autonomous system is one that refuses to expand faster than its platform budget.

That means:

- small host concurrency by default
- narrow browser-audit sampling by default
- explicit D1 and queue caps per run
- conservative defaults for free-tier or unverified environments

## Repo Surface

The current guardrail logic lives in:

- [packages/cloudflare-guardrails/src/index.ts](./../packages/cloudflare-guardrails/src/index.ts)
- [packages/host-control/src/index.ts](./../packages/host-control/src/index.ts)
- [apps/cloudflare/workers/orchestrator/src/index.ts](./../apps/cloudflare/workers/orchestrator/src/index.ts)
- [apps/cloudflare/workers/browser-audit-worker/src/index.ts](./../apps/cloudflare/workers/browser-audit-worker/src/index.ts)
- [scripts/check-cloudflare-guardrails.mjs](./../scripts/check-cloudflare-guardrails.mjs)

## Default Guardrail Model

The repo recognizes:

- `CF_PLAN_TIER=free|paid`
- `CF_RESOURCE_GUARD_MODE=conservative|balanced|aggressive`

The default worker configs ship with:

- `CF_PLAN_TIER=free`
- `CF_RESOURCE_GUARD_MODE=conservative`

That means the starting posture is intentionally narrow.

## Conservative Defaults

### Free Tier

- Browser Rendering disabled by default
- one host run per tick
- one audit URL per run at most when manually enabled
- low Worker CPU limits in the new control workers
- low D1 query and queue fan-out caps

### Paid Tier

- Browser Rendering allowed by default, but still sampled
- one or two hosts per tick depending on guard mode
- modest queue and D1 caps until the host proves stable

## Worker Config Rules

The new control-plane workers should always declare:

- `[limits]`
- `cpu_ms`
- `CF_PLAN_TIER`
- `CF_RESOURCE_GUARD_MODE`

The browser-audit worker must also declare:

- `BROWSER_AUDIT_ENABLED`
- `MAX_AUDIT_URLS_PER_RUN`

The orchestrator must also declare:

- `AUTONOMOUS_DB`
- `HOST_CONTROL`
- `MAX_HOST_RUNS_PER_TICK`
- `MAX_BROWSER_AUDIT_URLS_PER_RUN`
- `HOST_LOCK_TTL_SECONDS`
- `HOST_FAILURE_COOLDOWN_MINUTES`

## Host Lock Rule

Continuous execution must be host-gated, not just globally throttled.

The orchestrator now uses:

- D1-backed `host_runtime_state`
- D1-backed `host_run_events`
- a `HostControlDO` Durable Object per host name

That gives the system:

- one active run per host
- explicit cooldowns after failure
- durable host-state history instead of memory-only locking

## Operational Rules

1. Start every host in `draft_only`.
2. Keep `CF_RESOURCE_GUARD_MODE=conservative` until provider health, route audits, and publish blocking all behave cleanly.
3. Do not enable Browser Rendering for broad public-route sweeps on a free-tier posture.
4. Do not increase host concurrency and browser-audit breadth in the same change.
5. If a host reaches `publish_auto`, keep `MAX_HOST_RUNS_PER_TICK` low and keep browser-audit breadth sampled rather than exhaustive.

## QA Gate

Run:

```bash
pnpm qa:cloudflare
```

This checks that the repo still contains:

- the Cloudflare guardrail package
- the Cloudflare guardrail doc
- required worker vars and CPU limits in the new worker configs

## Source Notes

These guardrails are intentionally conservative and based on official Cloudflare product-limit documentation, not on guessing:

- [Cloudflare Workers limits](https://developers.cloudflare.com/workers/platform/limits/)
- [Cloudflare D1 limits](https://developers.cloudflare.com/d1/platform/limits/)
- [Cloudflare Queues limits](https://developers.cloudflare.com/queues/platform/limits/)
- [Cloudflare Durable Objects limits](https://developers.cloudflare.com/durable-objects/platform/limits/)
- [Cloudflare Workflows limits](https://developers.cloudflare.com/workflows/reference/limits/)
- [Cloudflare Browser Rendering limits](https://developers.cloudflare.com/browser-rendering/platform/limits/)

The repo defaults stay well below those ceilings on purpose.
