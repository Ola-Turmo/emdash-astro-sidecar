# Operator Dashboards And Release Health

The repo now turns the existing point-in-time quality checks into persistent dashboard artifacts under `output/`.

## Main entrypoint

```bash
pnpm report:release -- --refresh
```

That command refreshes the core reports and writes a scoped dashboard to:

```text
output/release-health/<siteKey>/<conceptKey>/latest/
```

The dashboard summarizes:

- field-performance gates and flagship targets
- Lighthouse release/flagship budgets
- accessibility regressions
- security-header + CSP baseline findings
- structured-data validity
- crawlability/renderability state
- dependency audit status
- telemetry-driven refresh candidates
- optional Cloudflare `content-api` observability data when `CONTENT_API_URL` and `CONTENT_API_TOKEN` are configured

## Supporting reports

Each core report also keeps a history timeline so trend views survive between runs:

- `output/field-performance/<siteKey>/<conceptKey>/`
- `output/lighthouse-budgets/<siteKey>/<conceptKey>/`
- `output/accessibility/<siteKey>/<conceptKey>/`
- `output/security-headers/<siteKey>/<conceptKey>/`
- `output/structured-data/<siteKey>/<conceptKey>/`
- `output/crawlability/<siteKey>/<conceptKey>/`
- `output/edge-parity/<siteKey>/<conceptKey>/`
- `output/dependency-audit/<siteKey>/<conceptKey>/`

## Scheduled reporting

GitHub Actions now includes `.github/workflows/quality-reporting.yml`.

It runs on a daily schedule and on manual dispatch, builds each configured site/concept scope, proves live browser RUM, generates the release dashboard, and uploads the artifacts.

## Deploy summaries

`cloudflare-deploy.yml` now appends the release-health markdown summary to the GitHub step summary on production deploys and uploads the release-health artifact bundle.
