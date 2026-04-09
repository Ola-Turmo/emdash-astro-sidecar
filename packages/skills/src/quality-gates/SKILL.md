---
name: quality-gates
description: Run the EmDash Astro Sidecar release gates before shipping content or a new host-site rollout. Use when validating reader-facing copy, checking for stale brand strings, enforcing host-config consistency, verifying RSS/sitemap/robots artifacts, and blocking deploys until the repo passes all quality checks.
---

# Quality Gates

Use this skill before any deploy, host rollout, or major content update.

## Required Commands

Run these in order:

1. `pnpm verify`
2. `pnpm qa`
3. `pnpm audit:deployed`

Do not treat a deploy as ready until both commands pass.

## What The Gates Cover

### Copy gate

- bans internal jargon in user-facing UI
- catches placeholder text
- catches broken encoding or mojibake
- checks published post title, description, and excerpt lengths

### Host configuration gate

- ensures `site-config.ts`, `astro.config.mjs`, and `wrangler.jsonc` agree
- checks route-worker names and mounted path patterns
- checks workflows for stale Pages project names and old worker references

### SEO integrity gate

- validates built `rss.xml`, `sitemap.xml`, and `robots.txt`
- blocks stale feed branding such as `EmDash Blog`
- blocks sitemap regressions such as `/category/undefined/`
- blocks public preview routes and thin utility routes from shipping in `dist`
- blocks stale public routes such as legacy demo authors or categories
- ensures guide worker SEO artifacts are synced from the current build

### Live deploy audit

- captures screenshots for each deployed URL
- records live-page analytics
- discovers URLs from the built public routes, sitemap.xml, and configured legacy URLs
- catches legacy pages that still serve unexpected content

## Reader-First Rule

Visible copy must sound natural to a customer, not to an internal operator.

If a headline or section label sounds like strategy language, rewrite it before shipping.

## References

- `docs/copy-guidelines.md`
- `docs/troubleshooting.md`
- `references/checklist.md`
