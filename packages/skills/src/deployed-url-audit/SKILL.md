---
name: deployed-url-audit
description: Audit deployed URLs with screenshots and live-page analytics. Use after deploying the sidecar to capture desktop and mobile screenshots, inspect live titles/canonicals/H1s/links/images/load timings, discover URLs from sitemap.xml, and write a deploy report for every live page.
---

# Deployed URL Audit

Use this skill after a deployment when you need proof of what the live pages actually serve.

## Default Command

Run:

```bash
pnpm audit:deployed
```

For local Lighthouse category scores too:

```bash
pnpm audit:deployed:lighthouse
```

Compatibility alias:

```bash
pnpm audit:deployed:psi
```

## What It Does

- loads URLs from `apps/blog/src/site-config.ts`
- discovers public route URLs from `apps/blog/dist/**/*.html`
- discovers page URLs from configured sitemap(s)
- includes any extra URLs configured there
- captures desktop and mobile screenshots
- records live-page analytics
- writes `audit.json` and `SUMMARY.md`

## Output Location

Artifacts are written under:

```text
output/playwright/deployed-audit/<timestamp>/
```

## Current Analytics

For each live URL, the audit captures:

- HTTP status
- final URL
- title
- meta description
- canonical
- document language
- H1 count and text
- internal/external link counts
- image count and missing alt count
- basic navigation timing
- failed requests
- redirect chains and final URL
- optional Lighthouse category scores and raw JSON reports

## When To Use

Use after:

- Cloudflare Pages deploys
- route worker changes
- feed/sitemap changes
- copy revisions that need visual confirmation
- legacy-path redirects such as `/blog/* -> /guide/blog/*`

## Important Rule

Trust the live audit over assumptions.

If the screenshot or analytics disagree with local output, debug the deployment path until they match.

Do not treat legacy URLs, preview routes, or thin utility routes as acceptable just because they return `200`.

If Windows reports a Lighthouse temp-folder cleanup note but the category scores and raw JSON reports were written, treat the run as valid and keep the artifact.
