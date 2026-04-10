# Provider Runtime

The autonomous control plane uses a provider runtime so research, drafting, evaluation, and prompt optimization can switch models without changing the rest of the repo.

## Current Runtime Surfaces

- [packages/model-runtime](./../packages/model-runtime)
  Shared provider abstraction and routing helpers.
- [packages/ai/src/draft-generator.ts](./../packages/ai/src/draft-generator.ts)
  Draft generator now built on top of the shared runtime instead of a one-off client.
- [scripts/provider-healthcheck.mjs](./../scripts/provider-healthcheck.mjs)
  Simple provider reachability test for configured environments.

## Supported Provider Shapes

The runtime is designed for:

- OpenAI-compatible APIs
- MiniMax through its OpenAI-compatible endpoint
- future native adapters for providers that need special handling

Current seed providers:

- `theclawbay`
- `minimax`

## Environment Variables

### TheClawBay

- `THECLAWBAY_API_KEY`
- `THECLAWBAY_BASE_URL`
  Optional. Defaults to `https://api.theclawbay.com/v1`
- `THECLAWBAY_MODEL`
  Optional. Defaults to `gpt-5.4-mini`

### MiniMax

- `MINIMAX_API_KEY`
- `MINIMAX_BASE_URL`
  Optional. Defaults to `https://api.minimax.io/v1`
- `MINIMAX_MODEL`
  Optional. Defaults to `MiniMax-M1`

## Task Routing

Task families are routed through seed defaults in [packages/model-runtime/src/index.ts](./../packages/model-runtime/src/index.ts).

Right now the runtime prefers:

- `theclawbay` for all seeded task families
- `minimax` as the first fallback

That is only the starting point. Later implementation passes should move routing into host-aware config or D1 state.

## Health Check

Run:

```bash
pnpm providers:health
```

Or target a single provider:

```bash
pnpm providers:health -- --provider theclawbay
pnpm providers:health -- --provider minimax
```

The health check:

- reads the provider API key and optional base URL and model from env
- performs a tiny `/chat/completions` request
- prints JSON with status, latency, and response content

It is intentionally not part of `pnpm verify` because provider secrets may not exist in every environment.

## Cloudflare Secret Guidance

For deployed workers, set provider secrets with Wrangler rather than checking them into the repo.

Examples:

```bash
wrangler secret put THECLAWBAY_API_KEY
wrangler secret put MINIMAX_API_KEY
```

If you want provider-specific base URLs or models in Cloudflare, add them as worker vars or secrets depending on sensitivity.

## Activation Note

The autonomous stack can be deployed without provider secrets, but generation quality will remain limited or blocked until the provider layer is healthy.

Before enabling recurring autonomous publication sync, check:

```bash
pnpm providers:health
pnpm autonomous:check-env
```
