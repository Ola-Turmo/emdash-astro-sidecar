# Active TODO

Last updated: 2026-04-17

This is the maintained backlog for `emdash-astro-sidecar`.

Use it as the execution list.
Use [world-class-quality-targets.md](./world-class-quality-targets.md) as the measurable target pack behind the list.

## Current Status

- [x] Root `kurs.ing` landing page is separated from `/guide` and `/kommune` and protected by live route guards.
- [x] Cloudflare-native screenshot auditing exists.
- [x] Multisite and multi-concept separation exists.
- [x] Autonomous draft / eval / publish control-plane foundation exists.
- [x] Full `pnpm qa` currently passes.
- [x] `guide` has registry-driven shell copy, generalized smoke tests, synced SEO artifacts, green security/root-routing checks, and a first-class built-route indexability audit.
- [x] `kommune` is fail-closed, quality-gated, batch-audited, and deployable through a curated publish workflow instead of a bulk generator.

## Current Published Kommune Set

- [x] `Arendal`
- [x] `Bjerkreim`
- [x] `Bremanger`
- [x] `Halden`
- [x] `Lillehammer`
- [x] `Nord-Aurdal`
- [x] `Oslo`
- [x] `Trysil`

Everything else in the current municipality rollout should stay drafted until it clears the evidence gate and quality threshold.

## P0: Release Quality And Operator Visibility

- [ ] Turn the current RUM summary foundation into production release gating and dashboarding:
  - alerting on regressions
  - flagship-page tracking
  - persistent trend views
  - deploy summaries tied to field targets
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
- [ ] Make performance and release targets visible in operator dashboards and deployment summaries, not just in CLI output.

## P0: Telemetry And Feedback Loop

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
- [ ] Add recurring scheduled/browser-proof reporting outside deploys so fresh browser samples stay continuously verified between releases.

## P0: Kommune Concept Quality

- [ ] Extract more concrete local signals from municipality sources:
  - application flow differences
  - renewal and controls
  - local exceptions or seasonal distinctions
  - consumption-stop rules and enforcement nuances
- [ ] Execute real Cloudflare kommune cache purges after deploys when `CLOUDFLARE_API_TOKEN` is available locally or in CI.

## P0: Accessibility

- [ ] Surface accessibility trend reporting in dashboards instead of only per-run CLI output.

## P0: Security And Transport

- [ ] Tighten CSP toward a reusable strict baseline and document allowed exceptions.
- [ ] Add passive vulnerability scanning into normal verification or scheduled audits.

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
- [ ] Finish repo-wide copy cleanup for older internal/demo language.
- [ ] Improve Windows audit ergonomics further so normal success cases stay quiet.
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

### For a new concept on an existing site

- [ ] Route prefix
- [ ] Page structure
- [ ] Taxonomy and content model
- [ ] CTA targets and business goal
- [ ] Copy direction
- [ ] Source of truth for content

## Recently Completed

- [x] Added a first-class indexability audit and wired it into `pnpm qa:seo`.
- [x] Added an explicit kommune cache-purge path and rollout documentation for post-deploy invalidation.
- [x] Improved `Kort oppsummert` so published kommune pages prioritize local differences instead of generic summary rows.
- [x] Fixed the Windows concept-command wrapper so `pnpm build:kommune` works reliably.
- [x] Restored `www.kurs.ing` root worker coverage and the missing security-header layer on the `www` host.
- [x] Synced guide SEO artifacts and clarified the `audit:deployed:psi` compatibility alias.
- [x] Generalized blog smoke tests to the active site/concept runtime instead of hard-coded `Kurs.ing` assumptions.
- [x] Removed the placeholder newsletter UI and added a guard against fake interactive placeholder components.
- [x] Refreshed multisite / concept documentation to match the current curated kommune rollout.
- [x] Trimmed the maintained backlog to remove Search Console, Bing Webmaster, and IndexNow completion work.
