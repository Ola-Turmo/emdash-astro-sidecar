# Quality Gates

This repo now has reusable gates for the highest-value public quality risks.

## Current Gates

- `pnpm qa:lighthouse`
  Concept-aware Lighthouse budget gate for release-tier and flagship URLs.
- `pnpm qa:field`
  Field-performance gate for first-party RUM summaries plus tracked flagship paths.
- `pnpm qa:rum`
  Live browser proof that fresh `browser_rum` samples are actually arriving.
- `pnpm qa:accessibility`
  Automated accessibility regression checks for:
  - `html[lang]`
  - single `h1`
  - missing image `alt`
  - unlabeled form controls
  - basic keyboard tab reachability
  - best-effort contrast failures on visible text
- `pnpm qa:security`
  Live header-quality gate for:
  - `Strict-Transport-Security`
  - `Content-Security-Policy`
  - `Referrer-Policy`
  - `Permissions-Policy`
  - `X-Content-Type-Options`
- `pnpm qa:structured-data`
  Validates JSON-LD presence and parseability on tracked pages.
- `pnpm qa:crawlability`
  Checks sitemap freshness, canonical consistency, renderability, overlay regressions, and internal-link support.
- `pnpm qa:parity`
  Compares built Astro output against live edge-served pages for key parity signals.
- `pnpm qa:ownership`
  Enforces public route ownership boundaries so this sidecar only claims and deploys `kurs.ing/guide` and `kurs.ing/kommune`, while the main `kurs.ing` root stays on its separate origin.

## Current Limits

- `qa:accessibility` is an automated regression gate, not a full WCAG audit.
- contrast checks are best-effort and intentionally conservative where backgrounds are image-based or gradient-based.
- `qa:security` validates delivered headers on the public URLs; it does not replace a full ASVS review or passive scanner.
- `qa:parity` currently focuses on metadata, shell/navigation, canonical, JSON-LD count, and `og:image` rather than every DOM detail.

## Why This Exists

The goal is to stop obvious public regressions before they ship:

- weak mobile performance
- broken field telemetry
- inaccessible markup regressions
- missing transport/security headers
- stale sitemap/crawlability state
- structured-data drift
- live edge divergence from the Astro source of truth

Use this together with [world-class-quality-targets.md](./world-class-quality-targets.md) and [TODO.md](./TODO.md).

## Reporting Surfaces

Use the non-blocking report commands when you want artifacts and trend history without failing the current shell immediately:

- `pnpm report:lighthouse`
- `pnpm report:field`
- `pnpm report:accessibility`
- `pnpm report:security`
- `pnpm report:structured-data`
- `pnpm report:crawlability`
- `pnpm report:release -- --refresh`
