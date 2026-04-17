# Site Onboarding Tooling

A new scaffold command reduces the manual work required to add a new site profile:

```bash
pnpm onboard:site -- --site-key example-site --domain https://www.example.com --locale en-US --support-email hello@example.com
```

It writes a scoped scaffold bundle to:

```text
output/site-onboarding/<site-key>/
```

Artifacts include:

- `site-profile.snippet.mjs`
- `site-copy.snippet.mjs`
- `CHECKLIST.md`

The generated checklist points to the remaining manual steps: real copy, CTA targets, Cloudflare setup, telemetry wiring, and release-dashboard verification.
