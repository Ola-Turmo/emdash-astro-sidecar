# Architecture

## Goal

`emdash-astro-sidecar` exists to add a content layer to an existing site without rebuilding the host product site itself.

Typical shape:

- host site keeps its main landing pages and checkout
- sidecar blog handles GEO/SEO articles, explainers, FAQs, and supporting content
- Cloudflare Pages serves the static Astro build
- a small Worker mounts the sidecar under a host path such as `/guide/`

## Repo Map

### `apps/blog`

The Astro application.

Important files:

- `apps/blog/src/site-config.ts`
  Host-specific configuration for URLs, path mounting, CTA links, locale, and current Cloudflare identifiers.
- `apps/blog/astro.config.mjs`
  Astro `site` and `base` settings. Keep these aligned with `site-config.ts`.
- `apps/blog/src/content.config.ts`
  Collection schemas for blog posts, authors, categories, tags, docs, and backups.
- `apps/blog/src/pages`
  Static routes for index, articles, author pages, categories, RSS, robots, and sitemap.
- `apps/blog/src/layouts` and `apps/blog/src/components`
  Rendering layer for the active host theme.

### `packages/design-clone`

The design-analysis pipeline.

Current behavior:

- fetches the host page
- fetches linked stylesheets
- extracts colors, typography, spacing, borders, shadows, and some layout signals
- writes a report and generated theme output under `packages/theme-core/theme-output/<host>`

Repo entrypoint:

- `pnpm design:clone -- analyze <url>`
- `pnpm design:clone -- clone <url>`

CLI:

- `scripts/design-clone.mjs`

### `apps/cloudflare/workers/guide-proxy`

The production subpath-mount worker.

Use this when the host site should keep the apex site and mount the sidecar under a path like `/guide/`.

Critical behavior:

- strip `/guide` before fetching the Pages origin
- preserve enough headers for cache correctness
- do not proxy `/_astro/*` as `/guide/_astro/*` to the origin

### `packages/skills`

Repo-local Codex skills.

Current roles:

- `design-import`
  Theme/design analysis
- `draft-gen`
  Content generation
- `publishing`
  Validation/publishing guidance
- `host-sidecar-rollout`
  New orchestration skill for next-site onboarding

## Cloudflare Topology

There are two distinct delivery layers:

1. Cloudflare Pages
   Stores and serves the static Astro build.
2. Cloudflare Worker route
   Mounts the Pages deployment under the host-site path.

Example:

- Pages alias: `master.emdash-astro-sidecar.pages.dev`
- host path: `https://www.kurs.ing/guide/`
- worker route: `www.kurs.ing/guide*`

That Pages alias is an origin hostname, not a Git branch rule. The repo default branch can still be `main`.

## Configuration Surfaces

### Host-specific

- `apps/blog/src/site-config.ts`
- `apps/blog/astro.config.mjs`
- `apps/cloudflare/workers/guide-proxy/wrangler.toml`

### Deployment-specific

- `apps/blog/wrangler.jsonc`
- `apps/blog/deploy.ts`

## Verification Model

Local:

- `pnpm --filter @emdash/blog check`
- `pnpm --filter @emdash/blog build`

Repo:

- `pnpm verify`

Live:

- HTML route returns `200`
- `_astro/*.css` returns `text/css`, not HTML
- canonical URLs point at the mounted host path
- RSS and sitemap resolve under the mounted path
