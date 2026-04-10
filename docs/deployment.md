# Deployment

## Recommended Production Shape

Use:

1. Cloudflare Pages for the static Astro build
2. A small Worker for the host-site mount path

This is the correct shape when the blog lives under a host path such as:

- `/guide/`
- `/blog/`
- `/academy/`

## Pages Deployment

Build first:

```bash
pnpm --filter @emdash/blog build
```

Deploy the generated `dist` folder:

```bash
cd apps/blog
pnpm exec wrangler pages deploy dist --project-name=<pages-project> --branch=<branch> --commit-dirty=true
```

After building the blog, sync the feed and sitemap artifacts into the guide worker:

```bash
pnpm sync:guide-seo
```

Important:

- `apps/blog/wrangler.jsonc` must include `pages_build_output_dir: "dist"`
- the project name in `apps/blog/wrangler.jsonc` and `apps/blog/deploy.ts` must match the real Pages project

## Route Worker Deployment

When the blog is mounted under a subpath, deploy:

```bash
cd apps/cloudflare/workers/guide-proxy
npx wrangler deploy
```

Key file:

- `apps/cloudflare/workers/guide-proxy/src/index.ts`

Key rule:

- strip the mount prefix before requesting the Pages origin
- serve `/guide/rss.xml`, `/guide/sitemap.xml`, and `/guide/robots.txt` from synced artifacts so feed correctness does not depend on stale Pages XML behavior
- redirect legacy top-level content paths such as `/blog/*` to the mounted sidecar path when old host pages still exist
- block `/guide/preview/*` from public access

Example:

- incoming request: `https://www.example.com/guide/_astro/app.css`
- origin request must become: `https://<pages-alias>/_astro/app.css`

Not:

- `https://<pages-alias>/guide/_astro/app.css`

If you get that wrong, CSS requests return HTML and the live site appears unstyled.

## Current Repo Defaults

Current settings are stored in:

- `apps/blog/src/site-config.ts`

That file includes:

- Pages project name
- Pages preview alias
- route worker name

## Deploy Script

There is a convenience script at:

- `apps/blog/deploy.ts`

It now assumes:

- Astro output lives in `dist`
- the Pages project is `emdash-astro-sidecar`

## Autonomous Stack Deployment

The autonomous layer now has its own reusable deployment path.

Registry:

- `docs/autonomous-worker-registry.json`

Environment contract check:

```bash
pnpm autonomous:check-env
```

Deploy only route workers:

```bash
pnpm autonomous:deploy-workers -- --kind=route
```

Deploy autonomous control-plane workers:

```bash
pnpm autonomous:deploy-workers -- --kind=control-plane
```

The GitHub workflow at `.github/workflows/cloudflare-deploy.yml` now uses the same registry-driven path instead of hardcoding only the old workers.

## Autonomous Materialization And Release

The publication handoff is now:

1. `publish-worker` creates publication artifacts in D1
2. `content-api` exposes bounded pending materializations
3. `materialize-publications.mjs` writes approved MDX into the Astro content tree
4. the same script can optionally run `pnpm verify`, deploy, audit, and mark artifacts as deployed

Examples:

```bash
pnpm materialize:publications -- --limit 3
pnpm materialize:publications -- --apply --verify
pnpm materialize:publications -- --apply --verify --audit --deploy=preview
pnpm materialize:publications -- --apply --verify --audit --deploy=production
```

## Live Verification Checklist

After deployment, verify all of these:

1. `https://host/path/` returns `200`
2. `https://host/path/_astro/<asset>.css` returns `200` with `text/css`
3. `https://host/path/rss.xml` resolves
4. `https://host/path/sitemap.xml` resolves
5. HTML canonical URLs point at the mounted host path
6. page HTML matches the intended sidecar, not the old deployment
7. legacy `/blog/...` URLs redirect to the mounted path or return an intentional `404`
8. `pnpm audit:deployed` produces screenshots and analytics for every public route

## Branch / Alias Notes

Cloudflare Pages aliases matter.

If the production branch on the Pages project is not the one you are actively deploying, you may need the route worker to point at a stable preview alias such as:

- `master.<project>.pages.dev`

That is acceptable as an operational workaround, but it should be documented and normalized later.

## Unsupported `wrangler.jsonc` Fields

Pages deployment will warn if you keep unsupported top-level fields in `apps/blog/wrangler.jsonc`.

Keep that file limited to supported Pages config plus the variables/bindings you actually use.
