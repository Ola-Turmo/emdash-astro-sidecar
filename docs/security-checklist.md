# Security Checklist

This is the reusable baseline for the public app and Cloudflare worker surfaces.

## Transport And Browser Policy

- HTTPS only on all public routes.
- `Strict-Transport-Security` enabled with long `max-age`.
- `Content-Security-Policy` present on public HTML responses.
- `Referrer-Policy` present.
- `Permissions-Policy` present.
- `X-Content-Type-Options: nosniff` present.

## Public Worker Surfaces

- Non-public endpoints return explicit `405` or `404` instead of ambiguous HTML.
- Preview/debug routes are `noindex`.
- JSON endpoints use `no-store` where stale responses would mislead operators.
- Route workers add security headers after origin fetch instead of trusting upstream defaults.

## Data And State

- D1 migrations are tracked and repairable when remote ledger drift occurs.
- Secrets live in Cloudflare worker configuration, not in repo files.
- Telemetry endpoints validate required fields before writing to D1.

## ASVS-Oriented Review Points

- V1 Architecture: document trust boundaries for Pages, route workers, metrics, and control-plane workers.
- V2 Authentication: operator endpoints stay protected and do not expose draft/review actions publicly.
- V5 Validation: public worker endpoints validate input shape and reject malformed payloads.
- V8 Data Protection: avoid storing unnecessary personal data in telemetry payloads.
- V14 Config: route and origin configuration stays repo-controlled and guarded by QA scripts.

## Current Automated Coverage

- `pnpm qa:security`
- `pnpm qa:cloudflare`
- `pnpm qa:root-routing`

This checklist does not replace a full ASVS review or passive scanner, but it gives the repo a reusable minimum bar.
