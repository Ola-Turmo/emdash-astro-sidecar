# World-Class Quality Targets

This document distills the benchmark material into a repo-specific target pack for `emdash-astro-sidecar`.

Use it for:

- release standards
- dashboard targets
- quality budgets
- backlog prioritization

## Core Definition

A world-class website here means:

- fast for real users
- stable under load
- accessible to a modern AA standard
- indexable and understandable by search engines
- secure by default
- measurable with automated gates
- commercially useful without degrading trust

## Field Targets

Use real-user monitoring and track percentiles by template, device class, and concept.

Minimum world-class bar on flagship surfaces:

- `LCP p75 <= 2.5s`
- `INP p75 <= 200ms`
- `CLS p75 <= 0.1`
- `TTFB p75 <= 0.8s`
- `FCP p75 <= 1.8s`

Flagship stretch target:

- `LCP p75 ~= 1.2-1.5s`

## Lab Targets

Use Lighthouse as the repeatable regression gate.

Baseline:

- `Performance >= 90`
- `Accessibility >= 90`
- `SEO >= 90`
- `Best Practices >= 90`
- `TBT < 200ms`

Flagship stretch:

- `Performance >= 95`

## Accessibility Targets

Treat these as the standard, not a best-effort layer:

- `WCAG 2.2 AA` on key templates and journeys
- near-zero serious/critical automated violations
- contrast compliance
- alt-text coverage
- correct form labels
- keyboard reachability on core flows

## Reliability Targets

Define and monitor:

- availability SLO
- latency SLOs by percentile
- error rate
- saturation / worker pressure
- queue health and retry churn

Use error budgets and trend dashboards instead of only spot checks.

## Security Targets

Minimum high-value baseline:

- HTTPS everywhere
- HSTS
- CSP
- Referrer-Policy
- Permissions-Policy
- X-Content-Type-Options
- passive vulnerability scanning
- OWASP ASVS-aligned review checklist

## SEO / Discoverability Targets

Treat these as measurable quality properties:

- should-index pages indexable
- should-not-index pages excluded
- canonical correctness
- sitemap freshness
- robots correctness
- structured-data validity
- no intrusive overlays that degrade search and UX

## Kommune-Specific Targets

For `/kommune`, quality is not "does a page exist."

A kommune page is publishable only when it has:

- enough confirmed local rule coverage
- a real plan or local time source
- a real application path
- a real public-records path
- useful local interpretation
- no obvious generic or admin boilerplate

Weak municipalities should be drafted out.

## Monetization Guardrail

If ads or sponsorships are ever added:

- no intrusive interstitials
- no ad-induced CLS
- no heavy script regressions
- no monetization change that degrades trust or field-performance targets

## Recommended Reporting Layers

Every flagship release should be able to show:

- field CWV percentiles
- Lighthouse scores
- accessibility status
- reliability/SLO state
- security-header state
- sitemap/indexability state
- publish quality state
- business KPI impact where available
