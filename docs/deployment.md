# Deployment

EmDash Astro Sidecar is designed for edge-first deployment on Cloudflare Workers and Pages.

## Deployment Targets

1. **Cloudflare Pages** - Primary deployment for static assets
2. **Cloudflare Workers** - For dynamic API routes (future)

## Cloudflare Pages Setup

### Using Wrangler

1. Install Wrangler CLI:
```bash
pnpm add -D wrangler
```

2. Configure `apps/blog/wrangler.jsonc`:
```jsonc
{
  "name": "your-blog-worker",
  "compatibility_date": "2024-12-01",
  "assets": {
    "directory": ".output/public",
    "binding": "ASSETS"
  }
}
```

3. Deploy:
```bash
cd apps/blog
pnpm build
wrangler pages deploy .output/public
```

### Using GitHub Actions

Create `.github/workflows/deploy.yml`:

```yaml
name: Deploy
on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: pnpm
      - run: pnpm install
      - run: pnpm build
      - uses: cloudflare/pages-action@v1
        with:
          apiToken: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          accountId: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
          projectName: blog
          directory: apps/blog/.output/public
```

## Configuration

### Routes

Configure blog mounting at `/blog` path:

```jsonc
"routes": [
  {
    "pattern": "example.com/blog",
    "zone_name": "example.com"
  }
]
```

### Environment Variables

Set these in Cloudflare dashboard or via `wrangler secret`:

- `SITE_URL` - Production blog URL
- EmDash API keys (if using hosted EmDash)

## Preview Deployments

Preview deployments are automatically created for pull requests via Cloudflare Pages.

## Troubleshooting

### Build Failures

Check the build output in `.output/`:
```bash
ls -la apps/blog/.output/
```

### Assets Not Loading

Verify the `assets.directory` path matches your build output:
```jsonc
"assets": {
  "directory": ".output/public"
}
```
