# Checklists

## Next-Site Rollout Checklist

1. Edit `apps/blog/src/site-config.ts`.
2. Update `apps/blog/astro.config.mjs`.
3. Update `apps/blog/wrangler.jsonc` if project or site URL changes.
4. Update `apps/cloudflare/workers/guide-proxy/wrangler.toml`.
5. Run `pnpm design:clone -- analyze <host-url>`.
6. Curate the generated theme output under `packages/theme-core/theme-output/<host>/`.
7. Replace demo content with host-specific content.
8. Review visible copy against `docs/copy-guidelines.md`.
9. Run `pnpm verify`.
10. Deploy Pages.
11. Deploy the route worker.
12. Verify mounted HTML, CSS asset responses, RSS, and sitemap.

## Pages Commands

```bash
cd apps/blog
pnpm exec wrangler pages deploy dist --project-name=<project> --branch=<branch> --commit-dirty=true
```

## Worker Commands

```bash
cd apps/cloudflare/workers/guide-proxy
npx wrangler deploy
```

## Fast Live Verification

```bash
curl -I https://host.example/guide/
curl -I https://host.example/guide/_astro/<asset>.css
curl -I https://host.example/guide/rss.xml
curl -I https://host.example/guide/sitemap.xml
```

The CSS request must return `text/css`, not HTML.
