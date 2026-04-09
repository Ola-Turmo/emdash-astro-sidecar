# Setup

## Prerequisites

- Node.js 20+
- pnpm 9+
- Cloudflare account if you will deploy

## Install

```bash
git clone <repo-url>
cd emdash-astro-sidecar
pnpm install
```

## Why `.npmrc` Exists

This repo includes a Windows-friendly pnpm setup:

- `node-linker=hoisted`
- `package-import-method=copy`

This reduces rename/link failures in synced folders such as Google Drive, which has already been a real issue in this repo.

## Local Development

Run:

```bash
pnpm dev
```

Astro will start the blog app from `apps/blog`.

## First Files To Read Before Adapting The Repo

1. `apps/blog/src/site-config.ts`
2. `apps/blog/astro.config.mjs`
3. `apps/blog/wrangler.jsonc`
4. `apps/cloudflare/workers/guide-proxy/wrangler.toml`

## Verification Before Any Deploy

Run:

```bash
pnpm verify
```

This is the minimum standard before shipping.

## Design Analysis

To inspect a host site:

```bash
pnpm design:clone -- analyze https://example.com
```

To also generate theme output:

```bash
pnpm design:clone -- clone https://example.com
```

Generated output goes to:

```text
packages/theme-core/theme-output/<host>/
```

## What To Edit For A New Host Site

### 1. Host profile

Edit:

- `apps/blog/src/site-config.ts`

### 2. Astro path mounting

Edit:

- `apps/blog/astro.config.mjs`

Keep `site` and `base` aligned with `site-config.ts`.

### 3. Cloudflare Pages runtime variables

Edit:

- `apps/blog/wrangler.jsonc`

### 4. Route worker

Edit:

- `apps/cloudflare/workers/guide-proxy/wrangler.toml`

Update:

- route patterns
- `GUIDE_ORIGIN`

## Typical Local Checks

```bash
pnpm --filter @emdash/blog check
pnpm --filter @emdash/blog build
pnpm --filter @emdash-astro-sidecar/skills typecheck
```

## If Install Or Build Fails

Go straight to [troubleshooting.md](./troubleshooting.md).
