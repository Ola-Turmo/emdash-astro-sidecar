# CSP Baseline

The security gate now checks for a reusable strict baseline instead of only checking that a CSP header exists.

## Required directives

- `default-src 'self'`
- `base-uri 'self'`
- `object-src 'none'`
- `frame-ancestors ...`
- `form-action ...`
- `upgrade-insecure-requests`

## Current warnings that still need review

The report does not automatically fail on every exception source, but it calls out the most important remaining looseners:

- `script-src 'unsafe-inline'`
- `style-src 'unsafe-inline'`

Those warnings are emitted in `pnpm report:security` / `pnpm qa:security` so allowed exceptions stay visible during hardening instead of disappearing into raw header dumps.
