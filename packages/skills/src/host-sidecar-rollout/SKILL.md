---
name: host-sidecar-rollout
description: Onboard EmDash Astro Sidecar to a new host site end-to-end. Use when setting this repo up for a different site, cloning a host design, choosing a mount path like /guide or /blog, replacing demo content, deploying to Cloudflare Pages, wiring the route worker, and verifying that the live mounted path serves real CSS assets instead of HTML fallbacks.
---

# Host Sidecar Rollout

Use this skill as the starting point for the next host-site setup.

## Read First

Read these files in order:

1. `docs/host-rollout.md`
2. `docs/deployment.md`
3. `docs/troubleshooting.md`
4. `docs/copy-guidelines.md`
5. `apps/blog/src/site-config.ts`

## Working Surface

Treat these as the main control points:

- `apps/blog/src/site-config.ts`
- `apps/blog/astro.config.mjs`
- `apps/blog/wrangler.jsonc`
- `apps/cloudflare/workers/guide-proxy/wrangler.toml`
- `apps/cloudflare/workers/guide-proxy/src/index.ts`

## Default Workflow

1. Update the host profile in `apps/blog/src/site-config.ts`.
2. Keep Astro `site` and `base` aligned in `apps/blog/astro.config.mjs`.
3. Run `pnpm design:clone -- analyze <host-url>`.
4. Run `pnpm design:clone -- clone <host-url>` if theme output is needed.
5. Replace demo authors, categories, and posts with host-relevant content.
6. Rewrite visible copy so it uses end-user language instead of internal product or SEO jargon.
7. Run `pnpm verify`.
8. Run `pnpm qa`.
9. Deploy Pages.
10. Deploy the route worker.
11. Run `pnpm audit:deployed`.
12. Verify live HTML and CSS asset responses at the mounted path and on any legacy URLs you redirect.

## End-User Copy Guardrail

Never ship homepage, section, or CTA copy that sounds like internal strategy or architecture language.

Ban phrases like:

- sidecar
- GEO layer
- content wave
- support layer
- “how this blog is connected to the main site”

Use plain reader language that explains:

- what the person needs to know
- what the page helps with
- what to do next

## Non-Negotiable Live Checks

After deploy, verify all of these:

- `https://host/path/` returns `200`
- `https://host/path/_astro/<asset>.css` returns `200` with `text/css`
- the HTML contains the expected sidecar title, not an older deployment
- RSS and sitemap resolve under the mounted path
- legacy blog/article URLs either redirect cleanly to the mounted path or return an intentional 404
- preview routes are not public

If `_astro/*.css` returns HTML, stop and fix the route worker before doing anything else.

## Known Failure Pattern

When the site is mounted under `/guide` or another prefix, the worker must strip that prefix before requesting the Pages origin.

Bad:

- `/guide/_astro/app.css` -> `https://pages-origin/guide/_astro/app.css`

Good:

- `/guide/_astro/app.css` -> `https://pages-origin/_astro/app.css`

## References

- For command and rollout checklists, read `references/checklists.md`.
