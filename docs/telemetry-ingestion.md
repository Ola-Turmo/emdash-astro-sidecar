# Telemetry Ingestion

The autonomous control plane now has a first telemetry-ingestion foundation instead of leaving measurement as a pure TODO.

## Current Surfaces

- [packages/metrics-ingestion/src/index.ts](G:\My Drive\_local\_myrepos\emdash-astro-sidecar\packages\metrics-ingestion\src\index.ts)
  Shared clients for:
  - Google Search Console Search Analytics
  - Chrome UX Report API
  - Bing Webmaster query stats
  - IndexNow submissions
- [apps/cloudflare/workers/metrics-worker/src/index.ts](G:\My Drive\_local\_myrepos\emdash-astro-sidecar\apps\cloudflare\workers\metrics-worker\src\index.ts)
  Cloudflare worker that ingests telemetry into D1 for one host at a time.
- [apps/cloudflare/d1/migrations/0010_metrics_ingestion.sql](G:\My Drive\_local\_myrepos\emdash-astro-sidecar\apps\cloudflare\d1\migrations\0010_metrics_ingestion.sql)
  D1 tables for `metrics_gsc`, `metrics_crux`, `metrics_bing`, and `indexnow_submissions`.
- [apps/cloudflare/d1/migrations/0011_rum_metrics.sql](G:\My Drive\_local\_myrepos\emdash-astro-sidecar\apps\cloudflare\d1\migrations\0011_rum_metrics.sql)
  D1 table for first-party `metrics_rum`.
- [apps/blog/src/scripts/rum.ts](G:\My Drive\_local\_myrepos\emdash-astro-sidecar\apps\blog\src\scripts\rum.ts)
  Browser-side collection for `LCP`, `INP`, `CLS`, `TTFB`, and `FCP`.

## Why This Exists

The repo already had live audits, screenshots, and route checks, but it did not yet have a real place for first-party search telemetry.

This foundation is meant to support:

- query and page performance from Google Search Console
- origin-level UX metrics from CrUX
- Bing search metrics through Bing Webmaster
- explicit IndexNow logging for submitted URLs
- first-party field-performance measurement for real users

## Current Limits

This is a first foundation, not the finished measurement system.

What it does now:

- fetch data for a single host
- store raw telemetry payloads in D1
- support optional IndexNow submissions for a set of URLs
- expose a host summary endpoint through `metrics-worker` at `GET /summary?hostId=<host-id>`
- feed those summaries into the Cloudflare observability dashboard in `content-api`
- ingest browser-side RUM beacons through `POST /rum`
- expose field metric summaries through `GET /rum/summary?siteKey=<site>&conceptKey=<concept>`
- return `p50/p75/p95/p99` rollups per metric
- split field metrics by device class and page type
- expose top sampled pages by field-performance profile
- disable caching on dynamic metrics responses so operator views are not stale

What still needs to be added:

- host-aware credential routing instead of only worker-level secrets
- recurring scheduler/orchestrator wiring
- normalized reporting tables or rollups
- dashboards and alerting
- URL Inspection or sitemap health follow-up for Google
- deploy and dashboard gating tied to the field targets in `docs/world-class-quality-targets.md`
- trustworthy live proof paths for automatic browser beacons on every concept surface
- stronger release gates tied to the field targets in `docs/world-class-quality-targets.md`

## Worker Secrets

Optional metrics-worker secrets:

- `GSC_ACCESS_TOKEN`
- `CRUX_API_KEY`
- `BING_WEBMASTER_API_KEY`
- `INDEXNOW_KEY`

If a secret is missing, the worker skips that source cleanly.

## Worker Usage

Example:

```bash
curl -X POST https://<metrics-worker-url> \
  -H "content-type: application/json" \
  -d "{\"hostId\":\"<host-id>\"}"
```

Host summary:

```bash
curl "https://<metrics-worker-url>/summary?hostId=<host-id>"
```

RUM ingest:

```bash
curl -X POST https://<metrics-worker-url>/rum \
  -H "content-type: application/json" \
  -d "{\"siteKey\":\"kurs-ing\",\"conceptKey\":\"guide\",\"pagePath\":\"/guide/blog/example/\",\"pageType\":\"article\",\"deviceClass\":\"desktop\",\"metrics\":[{\"name\":\"LCP\",\"value\":1800,\"rating\":\"good\"}]}"
```

RUM summary:

```bash
curl "https://<metrics-worker-url>/rum/summary?siteKey=kurs-ing&conceptKey=guide"
```

The browser collector currently posts with `fetch(..., { keepalive: true })` and falls back to `navigator.sendBeacon()` using an `application/json` blob. This avoids the weaker plain-string beacon path and prevents duplicate flushes on `visibilitychange` plus `pagehide`.

Optional IndexNow submission:

```bash
curl -X POST https://<metrics-worker-url> \
  -H "content-type: application/json" \
  -d "{\"hostId\":\"<host-id>\",\"indexNowUrls\":[\"https://example.com/guide/blog/example/\"]}"
```

## Official References

- Google Search Console API: [Search Analytics query](https://developers.google.com/webmaster-tools/v1/searchanalytics/query)
- Chrome UX Report API: [queryRecord](https://developer.chrome.com/docs/crux/api/)
- Bing Webmaster API overview: [Bing Webmaster APIs](https://learn.microsoft.com/en-us/bing/webmaster/getting-access)
- IndexNow protocol: [IndexNow](https://www.indexnow.org/documentation)
