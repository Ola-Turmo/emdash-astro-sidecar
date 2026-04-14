# Quality Gates

This repo now has reusable gates for the highest-value public quality risks.

## Current Gates

- `pnpm qa:lighthouse`
  Concept-aware Lighthouse budget gate for flagship URLs.
- `pnpm qa:field`
  Field-performance gate for first-party RUM summaries.
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

## Current Limits

- `qa:accessibility` is an automated regression gate, not a full WCAG audit.
- contrast checks are best-effort and intentionally conservative where backgrounds are image-based or gradient-based.
- `qa:security` validates delivered headers on the public URLs; it does not replace a full ASVS review or passive scanner.

## Why This Exists

The goal is to stop obvious public regressions before they ship:

- weak mobile performance
- broken field telemetry
- inaccessible markup regressions
- missing transport/security headers

Use this together with [world-class-quality-targets.md](./world-class-quality-targets.md) and [TODO.md](./TODO.md).
