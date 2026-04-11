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

## Why This Exists

The repo already had live audits, screenshots, and route checks, but it did not yet have a real place for first-party search telemetry.

This foundation is meant to support:

- query and page performance from Google Search Console
- origin-level UX metrics from CrUX
- Bing search metrics through Bing Webmaster
- explicit IndexNow logging for submitted URLs

## Current Limits

This is a first foundation, not the finished measurement system.

What it does now:

- fetch data for a single host
- store raw telemetry payloads in D1
- support optional IndexNow submissions for a set of URLs

What still needs to be added:

- host-aware credential routing instead of only worker-level secrets
- recurring scheduler/orchestrator wiring
- normalized reporting tables or rollups
- dashboards and alerting
- URL Inspection or sitemap health follow-up for Google

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
