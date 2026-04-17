# Control-Plane Backups

Use the new export workflow to capture control-plane state and quality history:

```bash
pnpm export:ops
```

That writes a timestamped bundle to:

```text
output/control-plane-backups/<timestamp>/
```

The backup currently includes:

- D1 migrations
- generated quality/output artifacts
- `.autonomous/` state when present
- optional remote D1 export through `wrangler d1 export` when `CLOUDFLARE_API_TOKEN` is available

Each run writes both `manifest.json` and `README.md` so operators can see exactly what was copied and what still requires credentials.
