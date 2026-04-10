# PRD: Autonomous Content Control Plane

## Goal

Build `emdash-astro-sidecar` into a Cloudflare-native autonomous content system that can:

- discover content opportunities continuously
- generate and refresh sidecar content safely
- optimize its own prompts through an agentic improvement loop
- audit live URLs continuously
- measure SEO and GEO outcomes from official sources
- stay policy-safe for Google, Bing, and other services

This PRD assumes a **single integrated implementation push**, not a slow phase-by-phase product split. Runtime activation can still be conservative.

## Product Outcome

The finished system should support one or more host sites where:

- the host keeps its main site and checkout
- the sidecar runs under a mounted path such as `/guide`
- Cloudflare Pages serves the Astro build
- Cloudflare Workers, Workflows, Queues, D1, R2, and Durable Objects run the autonomous loop
- AI providers can be swapped per task without changing the rest of the system

## Non-Goals

- scraping Google Search results at scale
- mass-generating doorway pages, city pages, or thin keyword pages
- auto-publishing large volumes of net-new content from day one
- building a generic CMS unrelated to the sidecar workflow
- depending on PageSpeed Insights as the main continuous measurement system

## Core Principles

1. Treat SEO and GEO as one system.
   A page must first be crawlable, indexable, canonical, and snippet-eligible before it can realistically become citable in AI answers.
2. Automate research, scoring, refresh, and auditing more aggressively than publishing.
3. Use binary evals wherever possible.
4. Build provider flexibility into the AI layer from the start.
5. Use official or low-risk telemetry sources instead of scraping Google.
6. Make every automated publish decision traceable and reviewable.

## System Shape

The system is a continuous loop:

`discover -> prioritize -> draft/refresh -> score -> queue -> publish/skip -> audit -> measure -> mutate prompts -> repeat`

It should be implemented as 6 integrated subsystems:

1. Signal ingestion
2. Research and topic discovery
3. Agentic draft and refresh loop
4. Binary eval and policy engine
5. Publishing and routing
6. Live audit and measurement

## Cloudflare Architecture

### Control Plane

- `Cron Triggers`
  Starts scheduled runs.
- `Workflows`
  Coordinates multi-step jobs and long-running execution.
- `Queues`
  Handles fan-out, retries, and backpressure.
- `Durable Objects`
  Enforces host-level locking, publish budgets, cooldowns, and concurrency control.
- `D1`
  Stores long-lived state, prompt versions, run history, drafts, measurements, and policy events.
- `R2`
  Stores source snapshots, generated artifacts, screenshots, reports, and draft packages.

### Delivery Plane

- `apps/blog`
  Astro sidecar app and content renderer.
- `apps/cloudflare/workers/guide-proxy`
  Mounts the sidecar under host paths such as `/guide`.
- `apps/cloudflare/workers/seo-files`
  Serves root-level robots and sitemap files when needed.

### New Workers To Add

- `apps/cloudflare/workers/scheduler`
- `apps/cloudflare/workers/orchestrator`
- `apps/cloudflare/workers/research-worker`
- `apps/cloudflare/workers/draft-worker`
- `apps/cloudflare/workers/eval-worker`
- `apps/cloudflare/workers/publish-worker`
- `apps/cloudflare/workers/browser-audit-worker`
- `apps/cloudflare/workers/metrics-worker`

## AI Runtime

The continuous improvement loop must be AI-agent powered and provider-flexible.

### Provider Requirements

Support these provider classes:

- `openai_compatible`
- `minimax_native`
- `gemini_native`
- `anthropic_native`
- future `cloudflare_ai_gateway`

### Provider Interface

Create `packages/model-runtime` with interfaces like:

- `listModels()`
- `generateText()`
- `generateStructured()`
- `runAgentStep()`
- `estimateCost()`
- `normalizeUsage()`
- `normalizeErrors()`

### Routing Model

Store task routing in config or D1:

- `provider_id`
- `model_id`
- `capabilities`
- `cost_tier`
- `supports_json_mode`
- `supports_tool_calling`
- `supports_reasoning`
- `max_context`

### Initial Test Providers

The implementation should support testing with:

- `THECLAWBAY_API_KEY`
- `MINIMAX_API_KEY`

Current visible environment only shows `THECLAWBAY_API_KEY`, so MiniMax must be wired through Cloudflare secrets/config even if it is not visible locally right now.

## Autoresearch Loop Adaptation

Use the useful parts of the autoresearch pattern, but move them into cloud state.

Keep:

- prompt families
- fixed validation sets
- binary eval criteria
- keep/discard prompt promotion
- mutation operators
- plateau breaker
- append-only run history

Do not keep:

- local `.autoresearch` files as primary state
- prompt optimization disconnected from production measurements
- unconstrained infinite publishing

### Prompt Families

Implement prompt families for:

- `topic_brief_generation`
- `article_outline_generation`
- `article_draft_generation`
- `title_meta_excerpt_generation`
- `internal_link_suggestions`
- `faq_block_generation`
- `refresh_existing_article`
- `source_summary_generation`
- `publish_decision_reasoning`

Each family needs:

- its own validation set
- its own best prompt
- its own run history
- its own scoring logic

## Data Model

Create D1 tables for:

- `hosts`
- `host_modes`
- `host_budgets`
- `topics`
- `topic_candidates`
- `source_documents`
- `source_snapshots`
- `prompt_families`
- `prompt_versions`
- `prompt_runs`
- `drafts`
- `draft_sections`
- `draft_evals`
- `draft_sources`
- `publications`
- `publication_events`
- `audit_runs`
- `audit_findings`
- `metrics_gsc`
- `metrics_bing`
- `metrics_crux`
- `indexnow_submissions`
- `manual_reviews`
- `policy_events`

## Safety Model

### Publish Modes

Every host must support runtime modes:

- `observe_only`
- `draft_only`
- `refresh_auto`
- `publish_auto`

Default mode for a fresh host should be `draft_only`.

### Hard Safety Rules

Never:

- scrape Google Search at scale
- auto-publish content outside approved topic clusters
- mass-generate local pages or keyword variants
- publish unsupported factual claims
- publish drafts that fail content, metadata, linking, or route audits
- burst-publish net-new pages

Always:

- require first-party topical relevance
- require evidence for factual claims
- enforce host budgets
- preserve canonical, sitemap, robots, and internal-link hygiene
- log every publish decision with scores and reasons

### Host Budgets

Every host should have policy-controlled limits such as:

- max net-new pages per week
- max auto refreshes per day
- max draft attempts per day
- max provider retries per hour
- cooldown windows after failures

Durable Objects should enforce these atomically.

## Measurement Model

### Must Implement

- Google Search Console ingestion
- CrUX ingestion
- Bing Webmaster ingestion
- IndexNow submission logging
- first-party route and content audit logging
- browser-rendered screenshot auditing

### Optional Per Host

- Bing AI citation signals when available
- Google Business Profile or local business metrics when relevant

### Explicitly Avoid

- direct Google SERP scraping as a production dependency
- PSI as the primary continuous score source

## Current Repo Surfaces To Build On

Use and extend:

- `apps/blog/src/site-config.ts`
- `scripts/audit-deployed-urls.mjs`
- `apps/cloudflare/workers/guide-proxy`
- `apps/cloudflare/workers/seo-files`
- existing copy, config, and SEO integrity gates

Treat `apps/cloudflare/workers/emdash-worker` as legacy and do not use it as the base of the autonomous system.

## One-Go Build Order

Build the whole system in one branch, but in this order:

1. D1 schema and R2 artifact layout
2. model runtime abstraction
3. host policy and budget engine
4. autoresearch core
5. content eval engine
6. topic discovery
7. workflow, queue, and DO orchestration
8. browser audit worker
9. metrics ingestion
10. publish engine
11. Cloudflare deployment wiring
12. docs, skills, and runbooks

## Acceptance Criteria

The one-go build is complete when:

- one host can run end-to-end in `observe_only`
- prompt-family loops can optimize prompts autonomously
- provider selection is configurable per task
- TheClawBay path works end-to-end
- MiniMax adapter exists and is secret-configurable
- drafts can be generated and scored
- refresh publishing can update an existing page under policy control
- browser audits run continuously on live routes
- metrics ingestion updates host health in D1
- no Google scraping exists in the production loop
- all automated publishes are budgeted and explainable

## TODO Checklist

### Foundation

- [ ] Add `packages/model-runtime`
- [ ] Add `packages/autoresearch-core`
- [ ] Add `packages/content-evals`
- [ ] Add `packages/content-policy`
- [ ] Add `packages/topic-discovery`
- [ ] Add `packages/metrics-ingestion`
- [ ] Add `packages/publish-engine`
- [ ] Add D1 migrations under `apps/cloudflare/d1/migrations`
- [ ] Add R2 artifact layout conventions

### Cloudflare Workers

- [ ] Add `scheduler` worker
- [ ] Add `orchestrator` worker
- [ ] Add `research-worker`
- [ ] Add `draft-worker`
- [ ] Add `eval-worker`
- [ ] Add `publish-worker`
- [ ] Add `browser-audit-worker`
- [ ] Add `metrics-worker`
- [ ] Add Durable Object for host locking and budgets

### AI Provider Layer

- [ ] Implement OpenAI-compatible adapter
- [ ] Implement TheClawBay test config using `THECLAWBAY_API_KEY`
- [ ] Implement MiniMax adapter and config surface
- [ ] Add provider routing config by task family
- [ ] Add provider health checks
- [ ] Add provider comparison benchmark runner

### Prompt Optimization

- [ ] Add prompt family registry
- [ ] Add validation set support
- [ ] Add binary eval engine
- [ ] Add keep/discard promotion logic
- [ ] Add mutation operators
- [ ] Add plateau breaker logic
- [ ] Add prompt run history storage

### Content System

- [ ] Add topic candidate generation
- [ ] Add source snapshot capture
- [ ] Add draft generation workflow
- [ ] Add refresh generation workflow
- [ ] Add metadata generation workflow
- [ ] Add internal link suggestion workflow
- [ ] Add FAQ generation workflow

### Publish Safety

- [ ] Add host modes
- [ ] Add host budgets
- [ ] Add topic allowlists
- [ ] Add publish decision engine
- [ ] Add duplicate-content protection
- [ ] Add evidence threshold checks
- [ ] Add route and XML pre-publish checks

### Measurement And Audit

- [ ] Add Search Console ingestion
- [ ] Add CrUX ingestion
- [ ] Add Bing Webmaster ingestion
- [ ] Add IndexNow logging
- [ ] Add browser screenshot audits
- [ ] Add live canonical/meta/H1 route checks
- [ ] Add D1-backed audit history

### Docs And Ops

- [ ] Add operator runbook for autonomous host mode
- [ ] Add provider secret configuration docs
- [ ] Add publish safety docs
- [ ] Add metrics and alerting docs
- [ ] Add skills for autonomous host operation

## Notes For Testing

For your environment:

- test TheClawBay first as the default provider path
- wire MiniMax through secrets and run it as the comparison provider
- begin in `draft_only`
- enable `refresh_auto` only after stable evals and audits
- delay `publish_auto` until the full measurement and policy engine is verified
