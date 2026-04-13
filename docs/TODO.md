# Active TODO

Last updated: 2026-04-13

This is the maintained backlog for `emdash-astro-sidecar`.

Use it as the execution list.
Use [world-class-quality-targets.md](./world-class-quality-targets.md) as the measurable target pack behind the list.

## Current State

- [x] Root `kurs.ing` landing page is separated from `/guide` and `/kommune` and protected by live route guards.
- [x] Cloudflare-native screenshot auditing exists.
- [x] Autonomous draft / eval / publish control-plane foundation exists.
- [x] Multisite and multi-concept separation exists.
- [x] Weak kommune pages now fail closed instead of staying published.
- [x] Kommune quality reporting exists.
- [x] Kommune hero-image workflow exists for the currently published municipality set.
- [x] First-party RUM exists for field CWV ingestion, `p50/p75/p95/p99` summaries, device splits, page-type splits, and top-page rollups.

## Current Published Kommune Set

- [x] `Arendal`
- [x] `Kristiansand`
- [x] `Lillehammer`
- [x] `Narvik`

Everything else in the current municipality rollout should stay drafted until it clears the quality threshold.

## P0: Measurable World-Class Baseline

- [ ] Turn the current RUM summary foundation into production release gating and dashboarding:
  - alerting on regressions
  - flagship-page tracking
  - persistent trend views
  - deploy summaries tied to field targets
- [x] Added reusable field-performance reporting and a strict gate entrypoint (`pnpm report:field`, `pnpm qa:field`).
- [x] Added field-performance summaries to the Cloudflare observability surface.
- [ ] Add a release gate for field-performance targets on flagship surfaces:
  - `LCP p75 <= 2.5s`
  - `INP p75 <= 200ms`
  - `CLS p75 <= 0.1`
  - `TTFB p75 <= 0.8s`
  - `FCP p75 <= 1.8s`
- [ ] Add stronger Lighthouse CI budgets for flagship pages:
  - `Performance >= 90`
  - `Accessibility >= 90`
  - `SEO >= 90`
  - `Best Practices >= 90`
  - `TBT < 200ms`
- [ ] Add a world-class `flagship` target tier for key landing pages and highest-value articles:
  - `Performance >= 95`
  - tighter LCP target toward `~1.2-1.5s` on hero pages
- [ ] Make these targets visible in operator dashboards and deployment summaries, not just in local CLI output.

## P0: Telemetry And Feedback Loop

- [ ] Finish live Google Search Console activation and ingestion.
- [ ] Finish live CrUX ingestion using the available API key and store trend history.
- [ ] Finish Bing Webmaster ingestion.
- [ ] Finish IndexNow submission plus outcome tracking.
- [ ] Tie telemetry to automatic refresh candidates:
  - falling CTR
  - rising impressions with weak clicks
  - stale page quality
  - weak internal-link support
- [ ] Add page-template quality dashboards that combine:
  - field CWV
  - Lighthouse
  - crawl/index state
  - publish quality state
  - conversion/funnel signals
- [ ] Add trustworthy live verification for real browser RUM samples on both `guide` and `kommune`, not just synthetic or manual validation paths.

## P0: Kommune Concept Quality

- [ ] Improve the 4 published kommune pages so they contain more true municipality-specific value:
  - stronger local takeaways
  - clearer process differences
  - better "what this means for you" interpretation
  - less repeated checklist language
- [ ] Extract more concrete local signals from municipality sources:
  - application flow differences
  - renewal and controls
  - local exceptions or seasonal distinctions
  - consumption-stop rules and enforcement nuances
- [ ] Make `Kort oppsummert` more decision-useful and less repetitive.
- [ ] Replace remaining generic "Det kommunen selv fremhever" content with stronger curated local source blocks or drop that block entirely when weak.
- [ ] Add a cache-purge or explicit invalidation path for kommune slugs that are drafted out, so stale live 200s disappear without relying on query-string cache busting.
- [ ] Add a municipality-specific release gate that blocks publishing if:
  - source cards are too generic
  - local differences are too weak
  - hero image is missing for flagship municipality pages
  - page remains too similar to another published municipality page

## P0: Accessibility

- [ ] Treat `WCAG 2.2 AA` as the standard target for key templates and flows.
- [ ] Add automated accessibility regression checks for:
  - contrast
  - alt text
  - form labels
  - keyboard reachability on core surfaces
- [ ] Add a manual accessibility review checklist for flagship pages and landing pages.
- [ ] Surface accessibility trend reporting in dashboards instead of only per-run CLI output.

## P0: Security And Transport

- [ ] Add an explicit header-quality gate for:
  - `HSTS`
  - `CSP`
  - `Referrer-Policy`
  - `Permissions-Policy`
  - `X-Content-Type-Options`
- [ ] Tighten CSP toward a reusable strict baseline and document allowed exceptions.
- [ ] Add passive vulnerability scanning into normal verification or scheduled audits.
- [ ] Add an `OWASP ASVS`-aligned checklist for the app + worker surfaces that are exposed publicly.

## P0: Reliability And Operations

- [ ] Define real SLOs for:
  - availability
  - latency
  - error rate
  - queue/workflow health
- [ ] Add error-budget style reporting and alerting for the Cloudflare control plane.
- [ ] Add better host-state visibility:
  - locked host runs
  - cooldown state
  - worker failure rate
  - retry churn
  - publish event timelines
- [ ] Add backup/export workflows for:
  - D1 runtime state
  - review state
  - publish history
  - edge artifacts
  - audit history

## P1: SEO / Discoverability / Search Readiness

- [ ] Add a first-class indexability audit:
  - should-index URLs
  - should-not-index URLs
  - canonical correctness
  - noindex correctness
- [ ] Add structured-data validity checks to recurring verification.
- [ ] Track sitemap freshness and error rate as a first-class quality signal.
- [ ] Add a guard against intrusive overlays/interstitial patterns on production pages.
- [ ] Add explicit crawlability and renderability checks for key templates.

## P1: Astro / Edge Parity

- [ ] Reach closer parity between Astro-served articles and edge-served articles for:
  - metadata
  - shell
  - navigation
  - structured data
  - image handling
- [ ] Add parity regression tests so edge-only pages cannot quietly diverge from the Astro standard.

## P1: Multisite / Multi-Concept Maturity

- [ ] Add site-onboarding tooling so a new domain can be added with less manual configuration.
- [ ] Add concept-specific template families beyond `guide` and `kommune`.
- [ ] Add per-site and per-concept budgets, model routing defaults, and publish policies.
- [ ] Add concept-specific dashboards so unrelated sites do not blend into one operator view.

## P1: Content Growth

- [ ] Build the next Norwegian article cluster for `etablererprøven`.
- [ ] Build the next Norwegian article cluster for `skjenkebevilling`.
- [ ] Build the next Norwegian article cluster for `salgsbevilling`.
- [ ] Strengthen article-to-course and article-to-article internal linking.
- [ ] Add refresh workflows for strong existing articles, not just net-new drafts.

## P2: UX / Business / Monetization

- [ ] Add task-success and funnel metrics for key user journeys.
- [ ] Add rage-click/dead-click style UX frustration signals where appropriate.
- [ ] Add conversion and revenue-safe release reporting so UX improvements are tied to outcome changes.
- [ ] If monetization is added later, enforce ad-quality guardrails:
  - no intrusive interstitials
  - no ad-induced CLS
  - no heavy third-party script regressions
  - prefer native or choiceful placements

## P2: Repo Cleanup

- [ ] Remove or archive remaining legacy demo content that should not survive active rollouts.
- [ ] Replace or remove the placeholder newsletter UI.
- [ ] Finish repo-wide copy cleanup for older internal/demo language.
- [ ] Improve Windows audit ergonomics further so normal success cases stay quiet.
- [x] Isolated Astro build output per `site/concept` to avoid shared `dist` collisions across guide/kommune deploys.
- [ ] Keep generated artifacts organized so quality reports do not become clutter.

## Inputs Still Needed From User

These are not blockers for generic platform work, but they are needed for specific rollouts.

### For a new site

- [ ] Canonical domain and mount path
- [ ] Brand reference URLs and core conversion pages
- [ ] CTA targets and labels
- [ ] Locale, language, geography, and support email
- [ ] Allowed topic clusters and categories
- [ ] Cloudflare zone / Pages / route-worker decisions
- [ ] Search Console / Bing / IndexNow access if telemetry should go live

### For a new concept on an existing site

- [ ] Route prefix
- [ ] Page structure
- [ ] Taxonomy and content model
- [ ] CTA targets and business goal
- [ ] Copy direction
- [ ] Source of truth for content

## Recently Completed

- [x] Added a reusable municipality quality report with publish/draft reasons.
- [x] Added fail-closed kommune publishing so weak municipality pages are drafted out.
- [x] Added text-free municipality hero-image support with reusable prompt files.
- [x] Tightened Norwegian kommune writing and codified banned synthetic phrases.
- [x] Added Cloudflare-native screenshot auditing.
- [x] Re-established and protected the real `kurs.ing` landing page.
- [x] Added multisite and multi-concept separation.
- [x] Added live first-party RUM ingestion with percentile summaries, device splits, page-type splits, and top-page rollups.
