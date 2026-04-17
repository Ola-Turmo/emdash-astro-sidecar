# Municipality Rollout Workflow

This is the current operator workflow for `kurs.ing/kommune`.

The rule is simple:

- do not publish weak municipalities
- improve generation and evidence logic until the next batch clears on its own
- publish only the municipalities that are already marked `publishable: true`

## Current Goal

There are two parallel goals:

1. publish as many municipality pages as possible without lowering the trust bar
2. convert each lesson into reusable code so the next batch becomes easier to clear

## Core Principle

`/kommune` is not a volume play.

If a municipality does not clear the evidence, editorial, and rendered-truth gates, it stays drafted.

That means batch size is capped by quality, not by ambition.

## Batch Loop

### 1. Regenerate municipality pages

Regenerate the current municipality inventory after changing extraction or scoring logic:

```bash
pnpm generate:municipal-pages -- --scope=existing
```

Use `--municipality=<name>` when isolating one municipality:

```bash
pnpm generate:municipal-pages -- --municipality=Bergen
```

Use `--scope=catalog` only when intentionally expanding beyond the current working inventory.

### 2. Run municipality gates

```bash
pnpm qa:municipality
```

Do not continue to promotion if this fails.

### 3. Audit the current publish set locally with screenshots

```bash
pnpm audit:municipality-batch -- --mode published --limit 20
```

Artifacts are written under:

- `output/playwright/municipality-batch/<timestamp>/SUMMARY.md`
- `output/playwright/municipality-batch/<timestamp>/summary.json`
- `output/playwright/municipality-batch/<timestamp>/screenshots/*.png`

Review the screenshots before deciding that the batch is good enough.

### 4. Promote only municipalities that already clear quality

```bash
pnpm promote:municipality-batch -- --require-hero --limit 20
```

Important:

- this does not invent quality
- it only undrafts municipalities already marked `publishable: true`
- `--require-hero` is the safer default for public rollout

### 5. Build and sync the kommune concept explicitly

Use the concept-specific wrappers so the wrong active concept does not leak into the workflow:

```bash
pnpm build:kommune
pnpm sync:kommune-seo
```

### 6. Deploy the kommune Pages project

```bash
pnpm deploy:kommune:pages
```

### 7. Purge kommune cache for current slugs

Use this after deploy when you need drafted-out slugs and refreshed live pages to stop relying on cache expiry:

```bash
pnpm purge:kommune-cache
```

Optional:

- `--published-only` if you only want the current live set plus core kommune routes
- `--dry-run` to print the purge list without calling Cloudflare

This script currently requires `CLOUDFLARE_API_TOKEN` because it uses the Cloudflare purge API directly.

### 8. Audit the live publish set with screenshots

```bash
pnpm audit:municipality-batch -- --mode published --limit 20 --live-base-url https://www.kurs.ing/kommune
```

Do not move on to the next batch until the live batch is clean.

## What To Improve Next

When the next municipalities are still drafted, inspect the reasons instead of overriding them.

Typical structural blockers:

- too few verified official sources
- too few distinct municipal link types
- too few operational rule signals
- too weak municipality-specific editorial interpretation
- missing hero assets for otherwise strong pages

Those should be solved in code first:

- improve link validation
- improve time-rule extraction
- derive more reusable editorial takeaways from verified data
- expand hero coverage intentionally

## Current Live Set

The current restored public set is:

- `Arendal`
- `Bjerkreim`
- `Bremanger`
- `Halden`
- `Lillehammer`
- `Nord-Aurdal`
- `Oslo`
- `Trysil`

Everything else stays drafted until the next batch truly clears.
