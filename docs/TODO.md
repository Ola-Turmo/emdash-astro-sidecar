# Active TODO

Last updated: 2026-04-12

This is the maintained backlog for `emdash-astro-sidecar`. Keep it current when meaningful work lands.

## P0

- [x] Fix slug quality in autonomous Cloudflare-only publishing so malformed upstream text cannot produce routes like `pr-ven`.
- [ ] Add official telemetry connectors for Google Search Console, Bing Webmaster, CrUX, and IndexNow logging.
- [x] Add Cloudflare-native screenshot auditing so visual checks do not depend primarily on local Playwright runs.
- [ ] Tighten unattended publish policy with hard budgets, rollback rules, cooldowns, and review gates for net-new articles.
- [ ] Reach full parity between Astro-served articles and Cloudflare edge-served articles for metadata, shell, and navigation.
- [x] Fail weak kommune pages closed by default so municipalities with low-quality local data are drafted instead of published.

## P1

- [x] Add a first telemetry-ingestion foundation package and worker for Search Console, CrUX, Bing, and IndexNow.
- [x] Add a safer multisite / multi-concept registry so unrelated domains and mounted sections stop sharing one flat host config.
- [x] Add a first generated kommune content set from `Ola-Turmo/kommune.no.apimcp.site`.

- [ ] Improve first-party source quality in `research-worker` with richer extraction from course pages, FAQs, checkout, and support content.
- [x] Strengthen semantic tag generation and controlled taxonomy handling for static and edge-only articles.
- [x] Add a Cloudflare-hosted review UI on top of `content-api`, not just review endpoints.
- [ ] Add better observability for provider failures, host state, publish events, audits, and content quality trends.
- [ ] Add backup and recovery workflows for D1 review state, edge artifacts, publish history, and host runtime state.

## P1 Multisite / Multi-Concept

- [x] Add a site + concept registry so one repo can hold unrelated domains and multiple mounted sections per site.
- [x] Add `EMDASH_SITE_KEY` and `EMDASH_CONCEPT_KEY` selection at build time.
- [x] Add content scoping fields (`siteKey`, `conceptKey`) so future content can be filtered cleanly.
- [x] Scaffold `kurs-ing/kommune` as a separate concept with its own base path and page structure intent.
- [x] Scaffold an unrelated site example (`gatareba-ge`) to prove separation.
- [x] Add a dedicated route/template system for non-blog concepts like `/kommune/{slug}`.
- [x] Add separate audit targets and quality gates per site and per concept.
- [x] Split deploy surfaces further so each site/concept can choose its own Pages project, worker bindings, and release mode.
- [x] Add municipality-specific visual/audit checks when `EMDASH_CONCEPT_KEY=kommune`.

## P2

- [ ] Remove or archive remaining legacy demo content and categories that are not part of active host rollouts.
- [ ] Replace the placeholder newsletter UI or remove it from the shipped app surface.
- [ ] Finish repo-wide text cleanup where older internal/demo wording still leaks through.
- [ ] Improve Windows audit ergonomics further so Lighthouse and cleanup are fully quiet in normal success cases.
- [ ] Add a stronger post-publish summary/report layer for recurring runs, not just single-URL audits.

## Content Expansion

- [ ] Build the next Norwegian cluster for etablererprøven preparation.
- [ ] Build the next Norwegian cluster for skjenkebevilling role clarity and exam scope.
- [ ] Build the next Norwegian cluster for salgsbevilling comparisons and edge cases.
- [ ] Improve article-to-course and article-to-article internal linking across the existing cluster.
- [ ] Add refresh workflows that revisit old articles when query mix, CTR, or audit quality changes.

## Inputs Needed From User

These are only required when moving from generic infrastructure work into a real rollout.

### For a new site

- [ ] Canonical domain and mount path
- [ ] Brand reference URLs and the main conversion pages
- [ ] Preferred CTA targets and labels
- [ ] Locale, language, country, and support email
- [ ] Allowed topic clusters and categories
- [ ] Cloudflare zone / project decisions
- [ ] Search Console / Bing / IndexNow access details if telemetry should be live

### For a new concept on an existing site

- [ ] Route prefix, for example `/kommune`
- [ ] Page structure, for example blog, directory, landing pages, or local pages
- [ ] Taxonomy and content model
- [ ] CTA targets and business goal
- [ ] Copy direction for headings, intros, and footer text
- [ ] Content source or editorial source of truth

## Recently Completed

- [x] Tighten Norwegian kommune writing by removing internal/generic phrases from generated descriptions, municipality leads, and section labels, and codify those bans in the copy gate.
- [x] Add Cloudflare Browser Rendering screenshot audits and live JPEG capture through `browser-audit-worker`.
- [x] Re-establish and protect the real `kurs.ing` landing page with dedicated root proxy workers that bypass `/guide` and `/kommune`.
- [x] Add a root-routing guard that statically validates the root worker configs and live-checks that `kurs.ing` and `www.kurs.ing` never render kommune content.
- [x] Expand observability with provider summaries, prompt-run summaries, and richer audit links in the Cloudflare dashboards.
- [x] Add a first refresh-draft loop so existing published articles can re-enter generation and evaluation when there are no net-new topic candidates.
- [x] Add a controlled slug-repair and taxonomy layer so Cloudflare-only publishing cannot emit malformed slugs and generic tags.
- [x] Add Cloudflare-hosted review and observability dashboards on top of `content-api`.
- [x] Add metrics summary output from `metrics-worker` for host-level self-evaluation.
- [x] Add a Cloudflare auth preflight and Wrangler-first deploy/secret-sync flow so a bad `CLOUDFLARE_API_TOKEN` cannot silently override a healthy local OAuth session.
- [x] Added concept-aware build verification for `kurs-ing/guide`, `kurs-ing/kommune`, and `gatareba-ge/guide`.
- [x] Expanded the first generated kommune content set to cover multiple large municipalities from `Ola-Turmo/kommune.no.apimcp.site`.
- [x] Enriched generated kommune pages with municipality-specific official-source summaries, checklists, and related guide handoffs.
- [x] Expanded the kommune rollout set to a broader starter coverage across many Norwegian municipalities from the legal/municipality source.
- [x] Added concept-level Cloudflare deployment surfaces and a dedicated `/kommune` route worker.
- [x] Codified municipality-page quality rules so future local-content concepts start from source-backed facts, curated links, explicit uncertainty handling, and non-generic layouts.
- [x] Added a municipality quality report so published and drafted kommuner are summarized with reasons in reusable artifacts.
