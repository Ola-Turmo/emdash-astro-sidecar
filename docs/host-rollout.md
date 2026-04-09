# Host Rollout

This is the end-to-end checklist for onboarding the sidecar to a new site.

## 1. Decide The Mount Strategy

Choose the path the host site will use:

- `/guide/`
- `/blog/`
- `/academy/`

Then keep these in sync:

- `apps/blog/src/site-config.ts`
- `apps/blog/astro.config.mjs`
- `apps/cloudflare/workers/guide-proxy/wrangler.toml`

## 2. Set The Host Profile

Edit:

- `apps/blog/src/site-config.ts`

Update:

- host site URL
- mounted blog URL
- locale
- support email
- nav labels
- CTA/course links
- Cloudflare project and worker names

## 3. Analyze The Host Design

Run:

```bash
pnpm design:clone -- analyze https://host.example
pnpm design:clone -- clone https://host.example
```

Review generated output in:

```text
packages/theme-core/theme-output/<host>/
```

Use it as input, not as blind truth. Human curation is expected.

## 4. Adapt The Blog Theme

Update:

- `apps/blog/src/styles/global.css`
- `apps/blog/src/layouts/*`
- `apps/blog/src/components/*`

Goal:

- match the host brand
- keep the sidecar visually related but not a broken copy
- make CTA paths back to the host site obvious

Before locking the UI copy, read:

- `docs/copy-guidelines.md`

Do not ship internal implementation language in visible copy.

## 5. Replace Demo Content

Update:

- `apps/blog/src/content/authors`
- `apps/blog/src/content/categories`
- `apps/blog/src/content/blog`

Do this:

- add the real author profile
- create host-specific categories
- mark demo posts as drafts
- publish the first host-relevant article set
- rewrite all reader-facing copy so it sounds natural to the actual customer

## 6. Verify Locally

Run:

```bash
pnpm verify
pnpm qa
```

Do not deploy before this passes.

## 7. Deploy To Cloudflare

Pages:

```bash
cd apps/blog
pnpm exec wrangler pages deploy dist --project-name=<project> --branch=<branch> --commit-dirty=true
```

Sync guide feed and sitemap artifacts:

```bash
pnpm sync:guide-seo
```

Route worker:

```bash
cd apps/cloudflare/workers/guide-proxy
npx wrangler deploy
```

## 8. Verify Live

Check:

- mounted page returns `200`
- `_astro/*.css` returns `text/css`
- HTML is the sidecar, not an old deployment
- RSS and sitemap resolve under the mounted path
- links back to the host site are correct
- screenshots and live analytics are captured with `pnpm audit:deployed`

## 9. Common Failure Pattern

Symptom:

- page loads as plain HTML without styles

Cause:

- worker forwards `/guide/_astro/*` to the Pages origin without stripping `/guide`

Fix:

- patch `apps/cloudflare/workers/guide-proxy/src/index.ts`
- redeploy worker

## 10. Keep A Repeatable Record

When a host rollout succeeds, keep these artifacts current:

- `apps/blog/src/site-config.ts`
- `docs/deployment.md`
- `docs/troubleshooting.md`
- `packages/skills/src/host-sidecar-rollout/SKILL.md`
