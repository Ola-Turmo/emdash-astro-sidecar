# Documentation

Use these docs as the operational runbook for the sidecar.

- [architecture.md](./architecture.md)
  System map of the Astro app, design-clone pipeline, skills, and Cloudflare topology.
- [setup.md](./setup.md)
  Local install, development, and verification.
- [host-rollout.md](./host-rollout.md)
  End-to-end process for adapting the sidecar to a new host site.
- [deployment.md](./deployment.md)
  Cloudflare Pages deployment and subpath route-worker setup.
- [troubleshooting.md](./troubleshooting.md)
  Known failure modes, especially subpath asset failures and Cloudflare routing mistakes.
- [quality-gates.md](./quality-gates.md)
  Release gates, what they check, and how to use them before every deploy.
- [deployed-url-audit.md](./deployed-url-audit.md)
  Screenshot and analytics workflow for every live deployed URL.
- [editorial-workflow.md](./editorial-workflow.md)
  Content model, drafting rules, and publishing expectations.
- [copy-guidelines.md](./copy-guidelines.md)
  Reader-first writing rules that ban internal jargon in user-facing UI and content.
- [cloudflare-resource-guardrails.md](./cloudflare-resource-guardrails.md)
  Conservative runtime budgets and worker-level limits to avoid overusing Cloudflare services during continuous operation.
- [provider-runtime.md](./provider-runtime.md)
  Provider runtime, secret contract, routing defaults, and health-check workflow for TheClawBay and MiniMax.
- [prd-autonomous-content-control-plane.md](./prd-autonomous-content-control-plane.md)
  One-go implementation PRD for the autonomous Cloudflare-native research, drafting, scoring, publishing, and audit system.
- [autonomous-content-control-plane-technical-design.md](./autonomous-content-control-plane-technical-design.md)
  Technical design for package boundaries, worker topology, D1 schema intent, provider abstraction, and orchestration flow.
- [autonomous-content-control-plane-backlog.md](./autonomous-content-control-plane-backlog.md)
  Implementation backlog broken into milestones and verification targets for the autonomous control plane.

Legacy docs in this folder are still available, but the files above are the maintained onboarding path.
