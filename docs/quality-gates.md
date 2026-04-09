# Quality Gates

## Goal

The repo should block obvious regressions before they reach production.

These gates are designed to catch:

- user-facing copy that sounds internal or careless
- stale brand/config values
- broken RSS, sitemap, and robots output
- unsynced guide SEO artifacts

## Commands

Run these before shipping:

```bash
pnpm verify
pnpm qa
pnpm audit:deployed
```

## What `pnpm qa` Runs

### `pnpm qa:copy`

Checks:

- banned internal jargon in user-facing files
- placeholder text
- likely mojibake
- published post metadata length limits

Script:

- `scripts/check-copy-quality.mjs`

### `pnpm qa:config`

Checks:

- `site-config.ts`, `astro.config.mjs`, and `wrangler.jsonc` alignment
- mounted path consistency
- route worker naming and route patterns
- stale project names in GitHub workflows

Script:

- `scripts/check-host-config.mjs`

### `pnpm qa:seo`

Checks:

- built RSS branding and locale
- sitemap integrity
- no `undefined` URLs
- robots output
- synced guide SEO artifacts

Script:

- `scripts/check-seo-integrity.mjs`

## 100-Target Principle

Treat 100 as the target for:

- copy clarity
- SEO file correctness
- route correctness
- accessibility and performance discipline

But do not confuse that with a promise that every Lighthouse or PageSpeed run will always be exactly 100. External fonts, network conditions, host-site changes, and Cloudflare cache state can change those scores.

What the repo can do is:

- block known regressions
- keep XML/SEO files correct
- enforce reader-first copy
- make verification mandatory

## Related Skill

Use:

- `packages/skills/src/quality-gates/SKILL.md`
- `packages/skills/src/deployed-url-audit/SKILL.md`

before host rollouts and production deploys.
