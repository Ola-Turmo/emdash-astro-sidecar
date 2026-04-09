# EmDash Astro Sidecar

Reusable Astro sidecar for mounting a blog, GEO/SEO knowledge layer, and Cloudflare delivery path on top of an existing site.

The repo is designed for this workflow:

1. Analyze a host site and clone the visual system.
2. Configure one host profile for brand, mount path, and Cloudflare topology.
3. Generate or write the first GEO/SEO article set.
4. Deploy the static blog to Cloudflare Pages.
5. Mount the blog under a host-site subpath such as `/guide/` or `/blog/` with a small route worker.

## What Is In The Repo

- `apps/blog`
  The Astro site that renders the sidecar blog.
- `apps/cloudflare/workers/guide-proxy`
  The route worker used when the blog lives under a host-site subpath.
- `packages/design-clone`
  The site-analysis and theme-output pipeline.
- `packages/skills`
  Repo-local skills for design import, draft generation, publishing, and host rollout.
- `docs`
  The runbook for setup, rollout, deployment, and troubleshooting.

## Start Here

- Read [docs/setup.md](docs/setup.md) for local setup.
- Read [docs/architecture.md](docs/architecture.md) for the system map.
- Read [docs/host-rollout.md](docs/host-rollout.md) for the next-site onboarding workflow.
- Read [docs/deployment.md](docs/deployment.md) for Cloudflare Pages plus route-worker deployment.
- Read [docs/troubleshooting.md](docs/troubleshooting.md) when the live install looks wrong.

## Single Source Of Host Configuration

Edit [apps/blog/src/site-config.ts](apps/blog/src/site-config.ts) first when adapting the repo to a new host site.

That file defines:

- primary brand/site URLs
- mount path such as `/guide`
- support email and locale
- nav labels
- course or CTA links
- current Cloudflare project/worker names

Keep [apps/blog/astro.config.mjs](apps/blog/astro.config.mjs) aligned with the `siteUrl` and `basePath` values from that config.

## Core Commands

```bash
pnpm install
pnpm dev
pnpm design:clone -- analyze https://example.com
pnpm design:clone -- clone https://example.com
pnpm verify
pnpm qa
pnpm audit:deployed
pnpm audit:deployed:lighthouse
```

## Current Verification Standard

Use this before shipping:

```bash
pnpm verify
pnpm qa
```

That currently runs:

- `pnpm --filter @emdash-astro-sidecar/skills typecheck`
- `pnpm --filter @emdash/blog check`
- `pnpm --filter @emdash/blog build`
- copy-quality gate
- host-config gate
- SEO/XML integrity gate

For live deploy validation:

```bash
pnpm audit:deployed
pnpm audit:deployed:lighthouse
```

## Repo-Local Rollout Skill

For the next site onboarding, start from:

- [packages/skills/src/host-sidecar-rollout/SKILL.md](packages/skills/src/host-sidecar-rollout/SKILL.md)
- [packages/skills/src/quality-gates/SKILL.md](packages/skills/src/quality-gates/SKILL.md)
- [packages/skills/src/deployed-url-audit/SKILL.md](packages/skills/src/deployed-url-audit/SKILL.md)

That skill points to the exact files, commands, and Cloudflare checks needed to repeat this setup on a different host.

## Status Notes

- The repo now supports subpath mounting such as `/guide/`.
- The design-clone pipeline can be executed directly from the repo with `pnpm design:clone`.
- The guide-proxy worker handles prefix stripping for `_astro` assets, which is required when the blog lives under a host-site subpath.

## License

MIT
