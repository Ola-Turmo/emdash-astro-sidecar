# Deployed URL Audit

## Purpose

Local build success is not enough. This audit checks what the live URLs actually return after deployment.

## Command

Run:

```bash
pnpm audit:deployed
```

Optional local Lighthouse category scores:

```bash
pnpm audit:deployed:lighthouse
```

Compatibility alias:

```bash
pnpm audit:deployed:psi
```

## URL Discovery

The audit reads:

- `apps/blog/src/site-config.ts`
- `apps/blog/dist/**/*.html` when a fresh build exists

It uses:

- every built public HTML route in `dist`
- `audit.sitemapUrls`
- `audit.extraUrls`

That means the repo can audit:

- every current public sidecar route
- any extra legacy or host-side URLs you explicitly care about
- the mounted guide/blog path as served live

## Output

The script writes:

- `audit.json`
- `SUMMARY.md`
- desktop screenshots
- mobile screenshots
- raw Lighthouse JSON reports when Lighthouse is enabled

to:

```text
output/playwright/deployed-audit/<timestamp>/
```

## What To Look For

- stale titles or descriptions
- wrong canonical URL
- unexpected redirect targets
- missing or multiple H1s
- failed asset requests
- missing alt text
- preview or thin utility pages that should not be public
- old pages still serving on legacy paths
- differences between local expectations and live output

## Recommended Habit

Run the audit after every production deployment and attach the artifact folder to your review or release notes.

For pre-deploy layout protection, pair it with:

```bash
pnpm qa:mobile
```

That gate audits the built local site at multiple narrow viewports and fails on mobile-specific layout regressions before anything goes live.

## Lighthouse Runtime

The Lighthouse pass runs locally against the live URLs. It does not call Google PageSpeed Insights.

On first use, the script bootstraps a cached Lighthouse CLI into a local tool directory under the current user profile and reuses that on later runs.

On Windows, Lighthouse may still emit a temp-folder cleanup note after the scores are already produced. When the report JSON is present and the category scores are populated, treat that as a successful run.
