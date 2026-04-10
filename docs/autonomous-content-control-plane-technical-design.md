# Technical Design: Autonomous Content Control Plane

## Purpose

This design turns the autonomous-content PRD into a concrete repo shape for `emdash-astro-sidecar`.

The goal is to add a Cloudflare-native control plane that can:

- discover and prioritize new article opportunities
- draft or refresh content with AI agents
- score drafts with deterministic and LLM-backed quality gates
- publish only when policy and budget checks pass
- audit live URLs continuously
- improve its own prompts over time without turning into a spam machine

This design assumes a one-go implementation effort, but it keeps runtime activation conservative through host modes and publish budgets.

## What Already Exists

The repo already has a delivery layer:

- [apps/blog](./../apps/blog)
  Astro app that renders the mounted sidecar.
- [apps/cloudflare/workers/guide-proxy](./../apps/cloudflare/workers/guide-proxy)
  Route worker that mounts the blog under a path such as `/guide`.
- [apps/cloudflare/workers/seo-files](./../apps/cloudflare/workers/seo-files)
  Worker that serves root-level robots and sitemap files when the host needs them.
- [scripts/audit-deployed-urls.mjs](./../scripts/audit-deployed-urls.mjs)
  Deployed-URL audit and screenshot workflow.
- existing quality gates for copy, config, and SEO integrity

The autonomous system should extend those surfaces. It should not replace them.

## What Is Legacy

- [apps/cloudflare/workers/emdash-worker](./../apps/cloudflare/workers/emdash-worker)

That worker reads like an earlier dynamic edge layer. It should be treated as legacy scaffolding, not as the base for the new autonomous control plane.

## Runtime Topology

The runtime splits into two planes.

### Delivery Plane

This serves the reader-facing site:

- Astro Pages build in `apps/blog`
- `guide-proxy` for mounted routes
- `seo-files` for top-level XML and robots surfaces

### Control Plane

This runs the continuous loop:

- `scheduler` worker
  Starts recurring runs through Cron Triggers.
- `orchestrator` worker
  Accepts a host run request and dispatches the next steps.
- future `research-worker`
  Builds topic candidates from first-party data and official SEO telemetry.
- `research-worker`
  Now exists as the first bounded job consumer for research-class steps.
- `draft-worker`
  Now exists as the first bounded job consumer for draft-class steps.
- `eval-worker`
  Now exists as the bounded job consumer for `evaluate_candidates` and writes draft pass/fail outcomes.
- `publish-worker`
  Now exists as the bounded job consumer for publish steps and materializes durable publication artifacts.
- `content-api`
  Exposes bounded pending publication artifacts for local or CI materialization into the Astro content tree.
- future `publish-worker`
  Applies approved refreshes or publishes safe net-new pages.
- `browser-audit-worker`
  Runs live page checks and screenshot capture through Browser Rendering in later passes.

State should live in:

- D1 for durable operational state
- R2 for large artifacts, screenshots, snapshots, and reports
- Durable Objects for host-level locks, budgets, and cooldowns
- Queues and Workflows for fan-out and long-running orchestration

The current implementation now includes the first real host-control layer:

- D1-backed `host_runtime_state`
- D1-backed `host_run_events`
- D1-backed `host_jobs`
- D1-backed `source_documents`, `source_snapshots`, and `draft_sections`
- D1-backed `publication_artifacts`, `publication_events`, and `publication_materializations`
- a `HostControlDO` Durable Object exported from the orchestrator worker

## Package Responsibilities

The first implementation pass introduces four new packages.

### [packages/model-runtime](./../packages/model-runtime)

This package is the provider abstraction.

Responsibilities:

- define a stable interface for any model provider
- support task-based routing instead of hardcoding one model
- make TheClawBay and MiniMax pluggable behind the same contract
- normalize usage, capabilities, and fallback selection

Why it matters:

The autonomous loop must stay flexible. Research, drafting, judging, and prompt mutation should be able to use different providers and different models without changing the rest of the system.

### [packages/autoresearch-core](./../packages/autoresearch-core)

This package adapts the autoresearch pattern into repo-native primitives.

Responsibilities:

- define prompt families
- define prompt versions
- track run results
- decide whether a candidate prompt should be promoted
- choose the next mutation operator

Why it matters:

The loop should not “just prompt again.” It should optimize prompt families against fixed validation sets with promotion rules and append-only run history.

### [packages/content-evals](./../packages/content-evals)

This package defines binary gates for content and page quality.

Responsibilities:

- define eval criteria
- score criteria into pass counts
- keep a default reader-first quality baseline

Why it matters:

The system needs deterministic structure checks plus LLM-backed judgment checks. That is how we avoid shipping machine-sounding copy or unsupported content.

### Deterministic Draft Normalization

One important implementation lesson is that model output alone is not enough, even when the provider is good.

The autonomous draft path now also needs deterministic post-processing to:

- guarantee at least two first-party internal links
- guarantee a clear closing next step
- guarantee minimum useful depth before evaluation
- salvage partially malformed provider output instead of failing immediately

This logic belongs close to the content helper layer, not inside ad hoc prompts. That keeps the quality bar reusable across providers.

### [packages/content-policy](./../packages/content-policy)

This package is the publish policy engine.

Responsibilities:

- model host modes
- model publish budgets
- decide whether a draft may publish
- explain why publication is blocked

Why it matters:

The safest autonomous system is one that can clearly explain why it refused to publish.

## D1 Schema Intent

The first migration lives in:

- [apps/cloudflare/d1/migrations/0001_autonomous_content_control_plane.sql](./../apps/cloudflare/d1/migrations/0001_autonomous_content_control_plane.sql)

This first pass creates the minimum durable state for:

- hosts and per-host mode/budget control
- prompt families, versions, and runs
- topic candidates and drafts
- draft eval records
- publication records
- audit history
- Search Console, Bing, and CrUX metrics

This is not the final schema. It is the first durable backbone for the one-go implementation.

Tables that still need to be added in later coding passes:

- `source_documents`
- `source_snapshots`
- `draft_sections`
- `draft_sources`
- `publication_events`
- `audit_findings`
- `indexnow_submissions`
- `manual_reviews`
- `policy_events`

## Orchestration Flow

The intended runtime flow is:

1. `scheduler` fires on a cron schedule.
2. `scheduler` posts a run request to `orchestrator`.
3. `orchestrator` resolves the host, host mode, and budgets.
4. `orchestrator` acquires a Durable Object lock for that host.
5. `orchestrator` schedules or dispatches:
   - research jobs
   - draft or refresh jobs
   - eval jobs
   - audit jobs
   - metrics ingestion jobs
6. results are written to D1 and R2.
7. only drafts that pass policy are allowed to reach the publish step.
8. live pages are audited after deployment.
9. prompt-family runs update best-prompt state only if validation improves.

The repo now has the first host lock and cooldown layer, plus a bounded D1-backed job queue and first data-producing worker passes. It still stops short of Cloudflare Queue or Workflow fan-out.

One practical design lesson from live runs: workers should tolerate partial queue drift. If drafts remain in `queued_eval` without matching `evaluate_candidates` jobs, the eval worker should be able to recover them in a bounded fallback path instead of waiting forever for perfect queue state.

For operational recovery, the eval worker should also support a direct host-targeted invocation path. That keeps the system recoverable when a host needs to be advanced without rebuilding the whole queue.

## Publish Safety Flow

Every publish attempt should pass through these checks, in this order:

1. host mode allows publishing
2. topic is approved for the host
3. draft is not a duplicate or near-duplicate
4. evidence threshold is satisfied
5. content evals pass
6. route audit passes
7. host budgets are still available
8. publish decision is logged with reasons

The current implementation surface for that logic is:

- [packages/content-policy/src/index.ts](./../packages/content-policy/src/index.ts)

This first pass only models the decision logic. Later passes need to connect it to:

- D1-backed host state
- real draft-eval results
- duplicate detection
- evidence-source tracking
- route and XML audit results

## Provider Strategy

The system must support multiple provider classes, not just one API vendor.

### TheClawBay

Use TheClawBay first because it is already visible in the current environment and it can fit the OpenAI-compatible adapter path.

Near-term use:

- default development provider
- first integration benchmark
- drafting, summarization, and prompt-mutation experiments

### MiniMax

MiniMax should be supported through a dedicated adapter or a provider-specific wrapper behind the same runtime interface.

Near-term use:

- secondary benchmark provider
- fallback for specific task families
- comparison path for score, latency, and output quality

### Routing Rules

Routing should be stored as task-family policy, not scattered conditionals.

Examples:

- cheap fast model for topic discovery
- stronger model for article drafting
- compact model for binary evals
- reasoning model for prompt mutation and publish-decision explanation

## Testing Strategy

The first pass should prove the new control plane in layers.

### Package Checks

Run targeted typecheck commands for:

- `@emdash/model-runtime`
- `@emdash/autoresearch-core`
- `@emdash/content-evals`
- `@emdash/content-policy`

### Worker Checks

Smoke-test:

- `scheduler` scheduled handler behavior
- `orchestrator` POST acceptance
- `browser-audit-worker` query validation

### Provider Checks

At minimum:

- register a TheClawBay-backed adapter in the runtime
- prove routing chooses the configured provider
- add a secret-driven config path for MiniMax even if live credentials are only added in Cloudflare

### Safety Checks

Before any autonomous publishing:

- verify host mode logic
- verify publish budgets
- verify route and XML audits
- verify copy gates still reject internal jargon in public text

## First Implementation Boundaries

This first implementation pass deliberately includes:

- the provider abstraction
- autoresearch primitives
- binary eval definitions
- publish-policy logic
- first D1 migration
- host runtime control migration
- Cloudflare worker stubs
- this technical design
- the milestone backlog

It deliberately does not yet include:

- real provider calls inside `model-runtime`
- Queue or Workflow dispatch
- Search Console or Bing ingestion
- Browser Rendering integration
- automatic content writing or publishing

That boundary is intentional. It makes the first pass a clean control-plane skeleton instead of a partially hidden production system.

## Open Questions

These still need concrete repo decisions in the next implementation pass:

1. Should provider routing live in D1, config files, or both?
2. Where should prompt validation sets be stored: D1 rows, JSON fixtures, or mixed?
3. Which tasks deserve a dedicated MiniMax adapter versus an OpenAI-compatible bridge?
4. How should host policy allowlists be authored: file-based config, D1-managed UI, or both?
5. Should publish actions write MDX directly into the repo, or stage content in D1/R2 and only materialize approved changes?
6. Which Browser Rendering artifacts should be stored permanently in R2 versus retained for short-term debugging only?

## Immediate Next Coding Steps

After this design lands, the next pass should implement:

1. real provider adapters for TheClawBay and MiniMax
2. Queue or Workflow dispatch from `orchestrator`
3. a prompt-family registry with seed families
4. a D1-backed draft-eval writer
5. Browser Rendering integration in `browser-audit-worker`
6. host-budget enforcement at the Durable Object layer
