# Credentialless Telemetry Strategy

This repo should default to a telemetry stack that can keep running without depending on Google Search Console OAuth or Bing Webmaster account-level authorization.

## Core Principle

Treat provider-owned telemetry as enrichment, not as a hard dependency.

The autopilot loop should still work when:

- Google Search Console OAuth is missing
- Bing Webmaster site authorization is missing
- CrUX has no public data for the site yet

## What The Repo Can Rely On Without New Provider Credentials

### 1. First-party RUM

Already implemented.

Use:

- `pnpm report:field`
- `pnpm qa:field`
- `pnpm proof:rum`
- `pnpm qa:rum`

Why it matters:

- real visitors
- Core Web Vitals and support metrics
- concept/page-type/device splits
- fully first-party

### 2. Public Search-Readiness Signals

Already implemented.

Use:

- `pnpm report:google-public`
- `pnpm qa:google-public`

What it covers:

- `robots.txt`
- `sitemap.xml`
- canonical self-consistency
- no unexpected `noindex`
- `h1` presence
- current field summary availability
- current CrUX history availability

This is the default Google-facing fallback when Search Console OAuth is unavailable.

### 3. Cloudflare-Native Request Telemetry

Prefer Cloudflare-native telemetry before asking for third-party search credentials.

This is now implemented in the repo through first-party route-worker logging plus D1 summaries.

Use:

- `pnpm report:traffic`

Use these as the next default sources:

- Cloudflare request analytics
- Cloudflare logs / referrer analysis
- Cloudflare GraphQL analytics
- browser-audit worker results
- route-worker status and cache behavior

What to derive:

- organic landing pages from search referrers
- crawler hits by user agent
- 404/410 crawl waste
- cache hit/miss patterns
- route-level latency and error hotspots

The current implementation already captures:

- top referrer types
- top referrer hosts
- top landing pages from search
- best-effort search queries from referrer URLs when engines expose them
- crawler-vs-browser request split
- path/status distributions

### 4. Crawler Hints + IndexNow

These are useful because they reduce dependence on manual submission workflows.

If active:

- Crawler Hints helps search engines discover change signals automatically through Cloudflare
- IndexNow can be used with only the site key file, without a webmaster dashboard login

These are not the same as true search-performance telemetry, but they are valuable autopilot signals.

### 5. Synthetic + Edge Audits

Already implemented.

Use:

- `pnpm qa:lighthouse`
- `pnpm qa:accessibility`
- `pnpm qa:security`
- browser-audit worker
- deployed URL audit

These are not search-console data, but they cover the things that most often break search performance anyway:

- crawlability
- renderability
- CWV
- accessibility
- headers
- canonical integrity

### 6. Public PageSpeed API

Use:

- `pnpm report:pagespeed-public`

This works without a Search Console login and gives:

- public Lighthouse category results from Google's API surface
- field-data presence when Google has public data for the URL or origin

It is still not a replacement for Search Console query data, but it is useful as a public Google-facing quality signal.

## What Still Requires Provider Authorization

These are optional enrichment layers, not required for autopilot operation:

### Google Search Console

Officially requires OAuth 2.0 for Search Console API access to user data.

That means:

- search queries
- clicks
- impressions
- CTR
- URL Inspection API

cannot be treated as a no-credential dependency.

### Bing Webmaster

The API can still fail with `NotAuthorized` unless the site property is actually authorized in Bing Webmaster for the provided key.

So Bing should stay optional.

### CrUX

CrUX is credential-light because it only needs an API key, but data may simply not exist yet for a given origin or URL.

So even with a valid key, `crux_no_data` must remain a first-class non-blocking state.

## Recommended Autopilot Stack

### Default no-login baseline

This should run continuously with no additional provider accounts:

1. first-party RUM
2. browser proof
3. Lighthouse budgets
4. accessibility gate
5. security/header gate
6. public Google signals report
7. browser-audit worker
8. route/root guards

### Cloudflare-enriched baseline

Add when using the existing Cloudflare platform:

1. request/referrer aggregation
2. crawler detection from logs
3. route-level 404 and 5xx reporting
4. crawler-hints monitoring
5. IndexNow submission status if configured

### Provider enrichments

Only after the baseline is already working:

1. CrUX API key
2. Bing site authorization
3. GSC OAuth

## Repo Policy

The repo should not treat these as blockers anymore:

- missing GSC OAuth
- missing Bing site authorization
- CrUX no-data states

The repo should treat these as blockers:

- missing first-party RUM
- broken crawlability
- broken canonical/sitemap/robots
- broken mobile performance
- broken accessibility or security gates

## Source Notes

This strategy is based on a few important platform realities:

- Google Search Console API access to user data requires OAuth 2.0.
- URL Inspection API also works on properties you manage in Search Console.
- Cloudflare exposes request analytics and GraphQL analytics as first-party platform telemetry.
- Cloudflare Web Analytics is available without the traditional third-party analytics setup burden.

Treat those constraints as design inputs, not as reasons to stall the system.
