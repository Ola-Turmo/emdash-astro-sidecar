# Troubleshooting

## Unstyled Live Page

### Symptom

The live page renders raw HTML with working links but no theme/styling.

### Cause

The browser is receiving HTML at a CSS URL, usually because the route worker forwarded the mounted path to the Pages origin without stripping the prefix.

### Check

Request a live asset URL:

```bash
curl -I https://host.example/guide/_astro/<asset>.css
```

The response must be:

- `200`
- `Content-Type: text/css`

If it returns HTML, fix the route worker.

### Fix

Patch:

- `apps/cloudflare/workers/guide-proxy/src/index.ts`

Make sure:

- `/guide/_astro/foo.css` becomes `/_astro/foo.css` at the Pages origin

## Wrong Site Appears At The Mounted Path

### Symptom

The host path shows an older sidecar or the wrong HTML entirely.

### Cause

The route worker points at the wrong Pages alias or production branch deployment.

### Check

Inspect:

- `apps/cloudflare/workers/guide-proxy/wrangler.toml`

Verify `GUIDE_ORIGIN`.

### Fix

Point the worker at the actual active Pages alias, then redeploy the worker.

## `pnpm install` Fails In Synced Folder On Windows

### Symptom

Rename/link errors inside `node_modules` during install.

### Cause

The repo is in a synced path and pnpm’s default linking strategy collides with the filesystem watcher/sync layer.

### Fix

Keep:

- `.npmrc`

with:

- `node-linker=hoisted`
- `package-import-method=copy`

## Blog Build Fails On Content References

### Symptom

Build crashes with `Cannot read properties of undefined` for author/category data.

### Cause

Astro content references are being treated as fully hydrated objects without calling `getEntry`.

### Fix

Resolve author/category references explicitly in:

- `apps/blog/src/components/ArticleCard.astro`
- `apps/blog/src/layouts/ArticleLayout.astro`

## Pages Deploy Warns About `wrangler.jsonc`

### Symptom

Pages deploy works but warns about unsupported top-level fields.

### Cause

`apps/blog/wrangler.jsonc` contains fields not supported by Pages config.

### Fix

Keep only supported Pages fields plus the bindings/vars you actually need.

## Cached Broken CSS

### Symptom

The route is fixed, but one browser still shows the broken unstyled page.

### Cause

The browser cached the old incorrect HTML response at the CSS asset URL.

### Fix

- hard refresh
- open the page in an incognito window
- if necessary, force a new asset hash by rebuilding after a small stylesheet change

## Raw XML Tree View In Browser

### Symptom

The browser says:

- `This XML file does not appear to have any style information associated with it`

### Meaning

That message by itself is normal. Browsers often render valid XML as an unstyled tree.

### Treat It As A Real Bug Only If

- the feed title or description are stale
- the sitemap contains broken URLs such as `undefined`
- the response contains HTML instead of XML

### Current Repo Fix

The guide route worker now serves:

- `/guide/rss.xml`
- `/guide/sitemap.xml`
- `/guide/robots.txt`

from synced build artifacts so those endpoints stay correct even when Pages XML routes are stale.
