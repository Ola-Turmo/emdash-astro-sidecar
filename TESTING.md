# Testing — emdash-astro-sidecar

This repo uses **Node 22's built-in `node:test` runner** for unit
tests on the pure-TS packages. No new dependencies were added; the
runner ships with Node 22 and the `--experimental-strip-types` flag
lets `node --test` import `.ts` source directly.

## Run all unit tests

```sh
pnpm --filter @emdash/content-evals test
pnpm --filter @emdash/content-policy test
```

Or from each package:

```sh
cd packages/content-evals && pnpm test
cd packages/content-policy && pnpm test
```

## What the runner command does

```sh
node --experimental-strip-types --test test/*.test.mjs
```

- `--experimental-strip-types` — strips TypeScript syntax at
  import time, no transpile step, no build artifact needed. Works
  on Node ≥ 22.6.
- `--test` — runs all matching files under the `node:test` TAP
  runner.
- `test/*.test.mjs` — only the test files (pure JS, not TS). The
  `mjs` extension lets the runner import the TS source without a
  build step.

## What this covers

- `@emdash/content-evals` — `evaluateDraftArtifact()` and the 8
  content criteria (single-h1, reader-first-copy, minimum-depth,
  answers-early, distinct-section-headings, internal-links,
  evidence-threshold, metadata-quality), plus the helpers
  `scoreEvalSuite()` and the internal `countWords` /
  `countInternalLinks`. 43 tests.
- `@emdash/content-policy` — `defaultHostBudgets()`,
  `isHostMode()`, `buildAutonomousRunPlan()` for the 4 host modes,
  and the full allow/deny matrix of `evaluatePublishDecision()`
  (every gate independently + combinations). 29 tests.

Total: **72 tests, ~250ms runtime.**

## Why we pin the test data

The "passing baseline" in each test file is the data shape a fresh
draft would have on day one of the content pipeline. The tests
flip **one field at a time** off the baseline, so a failure names
the exact criterion that broke. The baseline was tuned to pass all
8 criteria — its visible word count is 320+, its description is in
the 90-170 char range, its excerpt is in 120-230 char range, its
title is ≥ 20 chars, and it has 2 internal links. If a future
implementation tightens or loosens a threshold, the baseline will
break and force the test author to update both the implementation
and the expected values together.

## Why we pin the reason strings

`evaluatePublishDecision()` returns a `reasons: string[]` array.
The reasons are machine-readable — downstream log-based monitoring
and alerts count occurrences of specific reason strings. The
"regression" test at the bottom of `content-policy.test.mjs` pins
the full set of reason strings. Renaming or merging one is a
deliberate, code-reviewable change.

## Adding a new test

1. Pick the right package. `content-evals` for eval-criteria
   logic, `content-policy` for mode-and-budget logic. Don't add
   tests for a third package without adding a third `test` script
   in the root `package.json`.
2. Add a `test/yourfile.test.mjs` next to the package's `src/`.
   Use `import` (ESM) and the `node:test` TAP shape.
3. Use `passingBaseline()` (or the equivalent builder for the
   package) to keep tests focused. Don't re-implement the baseline
   inline.
4. Run `pnpm test` to confirm green. Run `node --test` from the
   package directory to see the verbose TAP output.

## Why not Vitest / Jest / Mocha

The repo has 71 scripts already. Adding a test framework as a
dev-dep + a vitest config + a separate runner buys us very little
over the built-in `node:test` runner for pure-TS packages. If
the project ever needs browser-like fixtures, mock timers, or
snapshot testing, reach for `vitest` then.

## Cross-references

- `apps/blog/tests/smoke.spec.ts` — the only Playwright e2e smoke
  test in the repo. Separate from the unit tests; runs against
  the live blog URL.
- `packages/content-evals/src/index.ts` — the source under test.
- `packages/content-policy/src/index.ts` — the source under test.
