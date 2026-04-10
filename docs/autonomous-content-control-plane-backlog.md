# Backlog: Autonomous Content Control Plane

This backlog breaks the one-go implementation into buildable milestones while still treating the whole system as one integrated mission.

Each milestone includes:

- the outcome it should produce
- the concrete tasks to complete
- how to verify that the milestone is actually done

## Milestone 1: Control Plane Foundation

### Outcome

The repo has a durable structural base for the autonomous system:

- provider abstraction
- prompt-optimization primitives
- content-eval primitives
- publish-policy primitives
- D1 schema foundation
- host runtime control state
- Cloudflare control-plane worker entrypoints

### Tasks

- [x] add `packages/model-runtime`
- [x] add `packages/autoresearch-core`
- [x] add `packages/content-evals`
- [x] add `packages/content-policy`
- [x] add first D1 migration under `apps/cloudflare/d1/migrations`
- [x] add host runtime control migration
- [x] add `scheduler` worker stub
- [x] add `orchestrator` worker with host lock and cooldown control
- [x] add `browser-audit-worker` stub
- [x] add technical design doc
- [x] add this backlog doc

### Verification

- targeted package typechecks pass
- worker source files exist and parse cleanly
- migration file exists and matches the technical design

## Milestone 2: Provider Runtime

### Outcome

The system can choose providers and models per task family without hardcoding one vendor.

### Tasks

- [ ] implement real OpenAI-compatible execution in `packages/model-runtime`
- [ ] add TheClawBay runtime config surface
- [ ] add MiniMax config surface and adapter boundary
- [ ] add provider health-check utility
- [ ] add provider comparison benchmark command
- [ ] add cost, usage, and failure normalization helpers
- [ ] document secrets and variables for local and Cloudflare environments

### Verification

- TheClawBay can complete a test generation through the runtime
- MiniMax config can be loaded from env or secrets without code changes
- provider routing selects preferred and fallback providers correctly

## Milestone 3: Prompt Optimization Core

### Outcome

Prompt families can improve over time with validation sets, mutation operators, and promotion logic.

### Tasks

- [ ] add prompt-family registry and seed families
- [ ] define validation-set storage approach
- [ ] add prompt-run persistence helpers
- [ ] connect prompt promotion logic to D1
- [ ] add mutation-operator execution flow
- [ ] add plateau-breaker path
- [ ] define append-only prompt run reports in R2 or local artifacts

### Verification

- a seed prompt family can run multiple candidate prompts
- only improved prompts get promoted
- prompt-run history is stored and reviewable

## Milestone 4: Content Eval + Policy Engine

### Outcome

Drafts can be blocked before publishing for structural, editorial, and policy reasons.

### Tasks

- [ ] expand `packages/content-evals` beyond seed criteria
- [ ] add deterministic HTML and metadata checks
- [ ] add LLM-judge criteria prompts
- [ ] add duplicate-risk input contract
- [ ] add evidence-threshold input contract
- [ ] connect eval results to policy decisions
- [ ] write audit-friendly publish-decision logs

### Verification

- a good draft passes the suite
- a jargon-heavy or weakly supported draft fails
- `evaluatePublishDecision` returns understandable block reasons

## Milestone 5: Research + Draft Loop

### Outcome

The system can discover opportunities, capture sources, and produce drafts or refresh proposals.

### Tasks

- [ ] add `packages/topic-discovery`
- [ ] add topic-candidate generation workflow
- [ ] add source snapshot capture rules
- [ ] add draft generation workflow
- [ ] add refresh generation workflow
- [ ] add title, meta, excerpt generation workflow
- [ ] add internal-link suggestion workflow
- [ ] add FAQ generation workflow

### Verification

- one host can produce a topic candidate list
- one candidate can produce a draft package
- the draft package includes enough metadata for later eval and publish steps

## Milestone 6: Metrics + Audit

### Outcome

The system can continuously audit live pages and ingest official measurement data.

### Tasks

- [ ] integrate Browser Rendering into `browser-audit-worker`
- [ ] store screenshots and audit artifacts in R2
- [ ] add live canonical, meta, H1, and route checks
- [ ] add Search Console ingestion package or worker
- [ ] add Bing Webmaster ingestion package or worker
- [ ] add CrUX ingestion package or worker
- [ ] add IndexNow submission logging

### Verification

- one live URL can be audited from Cloudflare
- screenshots and audit results are stored and retrievable
- metrics rows are written to D1 for one host

## Milestone 7: Publish Engine

### Outcome

The system can safely refresh existing pages and later publish bounded net-new content.

### Tasks

- [ ] add `packages/publish-engine`
- [ ] define file-write or content-materialization strategy
- [x] add host-mode enforcement entrypoint in orchestrator
- [x] add host lock and cooldown Durable Object
- [ ] add host-budget enforcement with Durable Objects
- [ ] add publish-worker
- [ ] add deploy trigger path
- [ ] add post-publish audit handoff

### Verification

- `draft_only` blocks publishing
- `refresh_auto` allows only refreshes
- one approved refresh can move through publish and post-publish audit

## Milestone 8: Ops + Safety Docs

### Outcome

An operator can run the system without guessing how it works or how it stays safe.

### Tasks

- [ ] add autonomous host operation runbook
- [ ] add provider secret configuration doc
- [ ] add publish safety and anti-spam doc
- [ ] add metrics and alerting doc
- [ ] add skills for autonomous host rollout and control-plane ops
- [ ] add incident and rollback guidance

### Verification

- a new operator can configure one host end to end using docs only
- the runtime modes and safety boundaries are easy to understand
- docs clearly explain what the system will refuse to do
