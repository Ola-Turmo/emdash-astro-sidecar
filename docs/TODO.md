# Active TODO

Last updated: 2026-04-15

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
- [x] The current evidence-backed published municipality set has text-free municipality-specific hero images plus derivative assets.
- [x] Kommune landing cards now use dedicated thumbnail derivatives instead of loading full hero assets in the listing grid.
- [x] Kommune publishing is now driven by a curated municipality set with structured editorial takeaways and practical steps instead of the old generic 30-page generator.
- [x] First-party RUM exists for field CWV ingestion, `p50/p75/p95/p99` summaries, device splits, page-type splits, and top-page rollups.
- [x] The browser RUM client is now embedded directly in generated HTML, removing the fragile external `rum-client.js` delivery path from `guide` and `kommune`.
- [x] The current mobile Lighthouse budget gate passes for the active `guide` and `kommune` flagship URLs.
- [x] Lighthouse audit policy is now concept-specific, so volatile concepts like `kommune` can use warmups plus median-of-runs without slowing all other deployments.

## Current Published Kommune Set

- [x] `Arendal`
- [x] `Bjerkreim`

Everything else in the current municipality rollout should stay drafted until it clears the evidence gate and quality threshold.

## P0: Measurable World-Class Baseline

- [ ] Turn the current RUM summary foundation into production release gating and dashboarding:
  - alerting on regressions
  - flagship-page tracking
  - persistent trend views
  - deploy summaries tied to field targets
- [x] Added reusable field-performance reporting and a strict gate entrypoint (`pnpm report:field`, `pnpm qa:field`).
- [x] Added field-performance summaries to the Cloudflare observability surface.
- [x] Split field summaries by explicit sample source so `browser_rum` can be gated separately from synthetic/manual tests.
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
- [x] Added a reusable Lighthouse budget gate entrypoint (`pnpm qa:lighthouse`) for the active concept's flagship URLs.
- [x] Wired the Lighthouse budget gate into the production deploy path for the active concept.
- [ ] Add a world-class `flagship` target tier for key landing pages and highest-value articles:
  - `Performance >= 95`
  - tighter LCP target toward `~1.2-1.5s` on hero pages
- [ ] Make these targets visible in operator dashboards and deployment summaries, not just in local CLI output.

## P0: Telemetry And Feedback Loop

- [ ] Finish live Google Search Console activation and ingestion.
- [x] Added a GSC-free Google public-signals fallback (`pnpm report:google-public`, `pnpm qa:google-public`) so search-readiness work does not block on OAuth setup.
- [x] Added a reusable CrUX ingestion path for the active site/concept (`pnpm telemetry:crux`) plus persistent D1 history in `metrics_crux_samples`.
- [x] Resolved the metrics-worker secret visibility issue by adding a Cloudflare-side D1 fallback for runtime secrets when worker secret bindings drift.
- [x] CrUX no longer acts like a blocker when Google has no data for the queried origin/URLs; it now resolves as a clean `crux_no_data` state.
- [ ] Finish Bing Webmaster ingestion.
- [x] Bing no longer acts like a blocker when the current key/site pairing is unauthorized; it now resolves as a clean `bing_not_authorized` state after trying realistic site variants.
- [x] Added a Cloudflare-native request/referrer telemetry report so organic landings and crawler behavior can be measured without GSC or Bing auth.
- [x] Added crawler-detection reporting from first-party edge request signals.
- [x] Added a public PageSpeed report path that works without Search Console credentials.
- [x] Codified a credentialless autopilot telemetry strategy in `docs/credentialless-telemetry-strategy.md`.
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
- [x] Added trustworthy live verification for real browser RUM samples on both `guide` and `kommune`, not just synthetic or manual validation paths.
- [x] Proved automatic browser-to-`/__rum` collection on live `guide` and `kommune` pages after the inline-client fix.
- [x] Turned `pnpm proof:rum` into a stricter operator gate that can fail when fresh browser samples do not appear.
- [x] Wired browser RUM freshness proof into the production deploy path for the active concept.
- [ ] Add recurring scheduled/browser-proof reporting outside deploys so fresh browser samples stay continuously verified between releases.

## P0: Kommune Concept Quality

- [x] `/kommune` now fails closed on an evidence basis and only keeps municipalities that still have verified source coverage.
- [x] Legacy or previously published municipalities outside the current evidence-backed set are drafted out automatically by the municipality generator.
- [x] The `/kommune` worker now derives sitemap and allowlist from the active Pages origin, so live route exposure follows the actual evidence-backed deploy instead of stale worker artifacts.
- [x] Added a Bergen-specific hero image to stabilize the last major Lighthouse outlier in the current `/kommune` audit set.
- [ ] Extract more concrete local signals from municipality sources:
  - application flow differences
  - renewal and controls
  - local exceptions or seasonal distinctions
  - consumption-stop rules and enforcement nuances
- [ ] Make `Kort oppsummert` more decision-useful and less repetitive across all 10 published pages.
- [x] Replaced the old generic municipality title/description/lead pattern with a stricter end-user-focused generator and gate.
- [x] `Kort oppsummert` now prioritizes operator decisions like øl og vin, brennevin, åpningstid, søknad, kontroll and innsyn instead of echoing raw timeline rows.
- [x] Added a derived `Driftsprofil` summary signal so the sidebar surfaces whether the municipality is oriented around sen nattdrift, strammere spritgrense, arrangementsløp, ute/inne split, or explicit kontrollspor.
- [x] Kommune link classification now prioritizes arrangement, kontroll, prøver and other specific local paths before generic skjenking/service-hub buckets.
- [x] Added hero images for the full current curated municipality set without regressing the kommune gate.
- [x] Kommune HTML responses now force upstream revalidation plus `no-store` on the proxy layer to reduce stale page deploys.
- [x] Added a separate municipality evidence gate that validates published links against real page content and blocks inferred rules from being published as confirmed facts.
- [ ] Add a cache-purge or explicit invalidation path for kommune slugs that are drafted out, so stale live 200s disappear without relying on query-string cache busting.
- [ ] Add a municipality-specific release gate that blocks publishing if:
  - source cards are too generic
  - local differences are too weak
  - hero image is missing for flagship municipality pages
  - page remains too similar to another published municipality page

## P0: Accessibility

- [x] Treat `WCAG 2.2 AA` as the standard target for key templates and flows.
- [x] Added automated accessibility regression checks for:
  - contrast
  - alt text
  - form labels
  - keyboard reachability on core surfaces
- [x] Added a manual accessibility review checklist for flagship pages and landing pages.
- [ ] Surface accessibility trend reporting in dashboards instead of only per-run CLI output.

## P0: Security And Transport

- [x] Added an explicit header-quality gate for:
  - `HSTS`
  - `CSP`
  - `Referrer-Policy`
  - `Permissions-Policy`
  - `X-Content-Type-Options`
- [ ] Tighten CSP toward a reusable strict baseline and document allowed exceptions.
- [ ] Add passive vulnerability scanning into normal verification or scheduled audits.
- [x] Added an `OWASP ASVS`-aligned checklist for the app + worker surfaces that are exposed publicly.

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
- [x] Rebuilt `/kommune` around a curated 10-page publish set with municipality-specific editorial takeaways and practical steps.
- [x] Redeployed `/kommune` so the live route worker returns `404` for drafted-out municipalities like `Kristiansand`.
- [x] Added text-free municipality hero-image support with reusable prompt files.
- [x] Added a Bergen-specific hero image and derivative assets to stabilize live kommune Lighthouse performance.
- [x] Tightened Norwegian kommune writing and codified banned synthetic phrases.
- [x] Added Cloudflare-native screenshot auditing.
- [x] Re-established and protected the real `kurs.ing` landing page.
- [x] Added multisite and multi-concept separation.
- [x] Added live first-party RUM ingestion with percentile summaries, device splits, page-type splits, and top-page rollups.
- [x] Removed the separate `rum-client.js` dependency by embedding the browser collector directly in generated HTML.
- [x] Added a reusable Playwright-based browser proof for first-party RUM on both `guide` and `kommune`.
- [x] Added `pnpm qa:rum` plus `/rum/recent` support so browser proof can verify fresh rows, not only cumulative summaries.
