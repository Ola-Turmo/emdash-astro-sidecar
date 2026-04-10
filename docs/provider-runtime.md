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

- `minimax`
- `theclawbay`
- `gemini`

## Environment Variables

### TheClawBay

- `THECLAWBAY_API_KEY`
- `THECLAWBAY_BASE_URL`
  Optional. Defaults to `https://api.theclawbay.com/v1`
- `THECLAWBAY_MODEL`
Optional. Defaults to `gpt-5.4`

### MiniMax

- `MINIMAX_API_KEY`
- `MINIMAX_BASE_URL`
  Optional. Defaults to `https://api.minimax.io/v1`
- `MINIMAX_MODEL`
Optional. Defaults to `MiniMax-M2.7`

### Gemini

- `GEMINI_API_KEY`
- `GEMINI_BASE_URL`
  Optional. Defaults to `https://generativelanguage.googleapis.com/v1beta/openai`
- `GEMINI_MODEL`
  Optional. Defaults to `gemini-2.5-flash`

## Task Routing

Task families are routed through seed defaults in [packages/model-runtime/src/index.ts](./../packages/model-runtime/src/index.ts).

Right now the runtime prefers:

- `minimax` for all seeded task families
- `theclawbay` as the first fallback
- `gemini` as an additional configured provider

Current known-good models from live checks on this machine:

- `minimax / MiniMax-M2.7`
- `theclawbay / gpt-5.4` with `reasoning_effort: high`

That is only the starting point. Later implementation passes should move routing into host-aware config or D1 state.

### Worker-Level Overrides

For autonomous workers you can override the default routing without changing code:

- `AUTONOMOUS_PROVIDER_ID`
- `AUTONOMOUS_MODEL_ID`
- `AUTONOMOUS_FALLBACK_PROVIDER_ID`
- `AUTONOMOUS_FALLBACK_MODEL_ID`

This is the safest way to switch one deployment between MiniMax, TheClawBay, and Gemini without code edits.

### Draft Guardrail Mode

The draft worker now defaults to fail closed:

- `AUTONOMOUS_ALLOW_FALLBACK_DRAFTS=false`

That means a provider failure blocks draft generation instead of silently publishing deterministic filler text. Only turn fallback on for controlled testing.

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
wrangler secret put GEMINI_API_KEY
wrangler secret put MINIMAX_API_KEY
```

If you want provider-specific base URLs or models in Cloudflare, add them as worker vars or secrets depending on sensitivity.

Recommended worker secret or var set for the draft path:

- secrets: `THECLAWBAY_API_KEY`, `GEMINI_API_KEY`, `MINIMAX_API_KEY`
- vars: `AUTONOMOUS_PROVIDER_ID`, `AUTONOMOUS_MODEL_ID`, `AUTONOMOUS_FALLBACK_PROVIDER_ID`, `AUTONOMOUS_FALLBACK_MODEL_ID`
- vars: `DRAFT_MAX_OUTPUT_TOKENS`, `AUTONOMOUS_ALLOW_FALLBACK_DRAFTS`

## Local Secret Sync Note

If `wrangler secret put` fails in a non-interactive local shell even though `wrangler whoami` works, the direct Cloudflare Workers Secrets API is a valid fallback for local operations.

That path updates:

- `PUT /accounts/{account_id}/workers/scripts/{script_name}/secrets`

Use it only from a trusted local environment and keep the secret values out of committed files.

## Activation Note

The autonomous stack can be deployed without provider secrets, but generation quality will remain limited or blocked until the provider layer is healthy.

Before enabling recurring autonomous publication sync, check:

```bash
pnpm providers:health
pnpm autonomous:check-env
```
