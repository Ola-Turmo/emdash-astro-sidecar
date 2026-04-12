# EmDash Astro Sidecar

Add a search-ready Astro guide or blog to an existing site without rebuilding the main product experience.

`emdash-astro-sidecar` is built for teams that want to:

- keep the host site's landing pages and checkout in place
- publish reader-first articles, explainers, and GEO/SEO content under a mounted path like `/guide`
- match the host site's visual language instead of dropping in a generic blog
- deploy on Cloudflare Pages and verify the live result with screenshots, feeds, route checks, and local Lighthouse reports

<p align="center">
  <img src="docs/readme-assets/hero.png" alt="EmDash Astro Sidecar hero illustration showing a host site and a mounted guide with a matching visual system." width="960" />
</p>

## Why Use It

Most content stacks force a full site rebuild, a disconnected subdomain, or a blog that looks like it belongs to another company.

This repo solves the more practical job:

1. analyze the existing host site
2. clone the brand and layout signals
3. publish clear support content for real readers
4. mount the sidecar under the host path
5. verify the deployed URLs instead of guessing

## What You Get

- `apps/blog`
  The Astro sidecar app for articles, author pages, categories, RSS, robots, and sitemap output.
- `packages/design-clone`
  The host-site analysis pipeline that extracts theme signals and generates reusable output.
- `apps/cloudflare/workers/guide-proxy`
  The route worker that mounts the Pages deployment under a host path such as `/guide`.
- `scripts/audit-deployed-urls.mjs`
  The live deploy audit that captures screenshots, metadata, redirect chains, and Lighthouse category scores.
- `packages/skills`
  Repo-local rollout and quality skills for future site onboardings.

## How It Works

<p align="center">
  <img src="docs/readme-assets/workflow.png" alt="Workflow illustration showing host-site analysis, design cloning and content shaping, then Cloudflare deployment under a mounted path." width="960" />
</p>

### 1. Analyze The Host Site

Run the design-clone workflow against the production site you want to support. The analyzer fetches the page, follows linked stylesheets, and extracts usable design signals for colors, spacing, typography, borders, and layout.

### 2. Shape The Sidecar Around The Host

Update the host profile in [`apps/blog/src/site-config.ts`](apps/blog/src/site-config.ts), replace demo content with real articles, and keep the reader-facing copy plain and specific. The sidecar should sound like part of the host product, not like an internal SEO experiment.

### 3. Mount It On Cloudflare

Build the Astro app, deploy it to Pages, and mount it with the guide worker so the live URLs resolve under the host path you choose. The current repo includes a production-grade `kurs.ing` rollout as a working example.

## Ship With Proof

<p align="center">
  <img src="docs/readme-assets/audit.png" alt="Deploy audit illustration showing live article screenshots, routing and feed checks, and local Lighthouse score panels." width="960" />
</p>

The deploy audit is meant to answer the question that usually gets skipped: "What are the live URLs actually serving right now?"

It checks:

- desktop and mobile screenshots for every discovered public route
- title, description, canonical, language, H1 count, link counts, and image alt coverage
- redirect chains on legacy paths
- RSS, sitemap, and robots correctness
- local Lighthouse category scores with raw JSON artifacts, without depending on Google PSI rate limits

Commands:

```bash
pnpm audit:deployed
pnpm audit:deployed:lighthouse
```

## Quick Start

```bash
pnpm install
pnpm design:clone -- analyze https://example.com
pnpm design:clone -- clone https://example.com
pnpm verify
pnpm audit:deployed
pnpm audit:deployed:lighthouse
```

Then edit:

- [`apps/blog/src/site-config.ts`](apps/blog/src/site-config.ts)
- [`apps/blog/site-profiles.mjs`](apps/blog/site-profiles.mjs)
- [`apps/blog/astro.config.mjs`](apps/blog/astro.config.mjs)
- [`apps/cloudflare/workers/guide-proxy/wrangler.toml`](apps/cloudflare/workers/guide-proxy/wrangler.toml)

## Release Standard

Do not treat the sidecar as ready just because the local build passed.

Use this baseline:

```bash
pnpm verify
pnpm qa
pnpm audit:deployed
pnpm audit:deployed:lighthouse
pnpm autonomous:check-env
```

That workflow gives you:

- schema and type checks
- Astro build validation
- feed and sitemap integrity checks
- copy-quality and host-config gates
- live screenshots and URL analytics
- local Lighthouse artifacts for deployed pages

## Read Next

- [`docs/setup.md`](docs/setup.md)
- [`docs/architecture.md`](docs/architecture.md)
- [`docs/host-rollout.md`](docs/host-rollout.md)
- [`docs/deployment.md`](docs/deployment.md)
- [`docs/troubleshooting.md`](docs/troubleshooting.md)
- [`docs/cloudflare-resource-guardrails.md`](docs/cloudflare-resource-guardrails.md)
- [`docs/provider-runtime.md`](docs/provider-runtime.md)
- [`docs/telemetry-ingestion.md`](docs/telemetry-ingestion.md)
- [`docs/multisite-and-multi-concept.md`](docs/multisite-and-multi-concept.md)
- [`docs/TODO.md`](docs/TODO.md)
- [`docs/prd-autonomous-content-control-plane.md`](docs/prd-autonomous-content-control-plane.md)

## Repo Skills

For repeatable future rollouts, start from:

- [`packages/skills/src/host-sidecar-rollout/SKILL.md`](packages/skills/src/host-sidecar-rollout/SKILL.md)
- [`packages/skills/src/autonomous-host-operator/SKILL.md`](packages/skills/src/autonomous-host-operator/SKILL.md)
- [`packages/skills/src/quality-gates/SKILL.md`](packages/skills/src/quality-gates/SKILL.md)
- [`packages/skills/src/deployed-url-audit/SKILL.md`](packages/skills/src/deployed-url-audit/SKILL.md)

## Kommune Content

The repo can now generate kommune concept pages from the structured municipality dataset in `Ola-Turmo/kommune.no.apimcp.site`.

The kommune generator now also enriches those pages with summaries from official municipality URLs when available, plus municipality-specific checklists and direct guide handoffs into the main `kurs.ing/guide` concept.

Run:

```bash
pnpm generate:municipal-pages
```

Concept separation is also enforced in normal verification:

```bash
pnpm verify:concepts
```

## License

MIT
