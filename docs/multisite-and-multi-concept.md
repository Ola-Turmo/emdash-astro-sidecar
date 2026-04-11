# Multisite And Multi-Concept

This repo is now prepared for two different axes of separation:

1. `site`
   A completely different domain, brand, deployment target, and content scope.
2. `concept`
   A separate mounted section on the same site, with its own route prefix, page structure, shell copy, and audit targets.

## Current Model

Shared registry:

- [apps/blog/site-profiles.mjs](G:\My Drive\_local\_myrepos\emdash-astro-sidecar\apps\blog\site-profiles.mjs)

Runtime selection:

- `EMDASH_SITE_KEY`
- `EMDASH_CONCEPT_KEY`

Current scaffolded examples:

- `kurs-ing / guide`
- `kurs-ing / kommune`
- `gatareba-ge / guide`

## What A Site Owns

A site profile owns:

- main domain and locale
- wordmark and support identity
- Cloudflare Pages and worker names
- shared product links and CTA targets
- concepts that belong to that site

## What A Concept Owns

A concept owns:

- mounted base path such as `/guide` or `/kommune`
- canonical site URL for that mounted section
- page structure intent such as `blog` or `directory`
- navigation for that section
- shell copy for header, homepage, article cards, article aside, and footer
- route prefixes for article, category, and author style pages
- audit targets for that section

## Current Limitation

The app is fully wired for one active site/concept build at a time.

That means:

- `kurs-ing / guide` works today
- `kurs-ing / kommune` is scaffolded in config, but still needs its own page templates and routes
- unrelated sites can now be represented cleanly in config, but still need their own content, copy, and deployment settings

## Content Separation

Content collections now support optional scope fields:

- `siteKey`
- `conceptKey`

If those fields are missing, content is treated as compatible with the active profile for backward compatibility.

If those fields are present, published-content helpers only surface entries that match the active site/concept.

Relevant files:

- [apps/blog/src/content.config.ts](G:\My Drive\_local\_myrepos\emdash-astro-sidecar\apps\blog\src\content.config.ts)
- [apps/blog/src/lib/published-content.ts](G:\My Drive\_local\_myrepos\emdash-astro-sidecar\apps\blog\src\lib\published-content.ts)

## What Still Needs To Be Added

To support concepts like `kurs.ing/kommune/oslo` cleanly, the next implementation step is:

1. add a dedicated collection for municipality pages
2. add routes and templates for directory-style concepts
3. add concept-specific sitemap/audit handling
4. add concept-specific worker routing where needed

## Recommended Usage

Examples:

```bash
EMDASH_SITE_KEY=kurs-ing EMDASH_CONCEPT_KEY=guide pnpm --filter @emdash/blog build
EMDASH_SITE_KEY=kurs-ing EMDASH_CONCEPT_KEY=kommune pnpm --filter @emdash/blog build
EMDASH_SITE_KEY=gatareba-ge EMDASH_CONCEPT_KEY=guide pnpm --filter @emdash/blog build
```

For a new rollout, add a new site profile or a new concept first. Do not start by editing component copy directly.
