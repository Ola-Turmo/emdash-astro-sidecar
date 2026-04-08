# EmDash Astro Sidecar

An Astro-native blog sidecar that can be added to any existing website — running on Cloudflare edge, with AI-agent publishing and design-cloning to match host aesthetics.

## Features

- **Astro + Cloudflare Pages** — edge-deployed, fast static + islands architecture
- **Design-cloning** — analyze any site and generate matching theme tokens/components
- **AI-agent skills** — MCP-compatible skills for content generation and publishing workflow
- **SEO/GEO optimized** — structured data, canonical URLs, breadcrumbs, FAQ schema
- **Plugin system** — extend with custom content blocks and lifecycle hooks

## Quick Start

```bash
pnpm install
pnpm dev
```

See [docs/setup.md](docs/setup.md) for full setup guide.

## Architecture

```
emdash-astro-sidecar/
├── apps/blog/          # Astro blog application
├── packages/
│   ├── theme-core/     # Design token system
│   ├── design-clone/  # Site analysis + theme generation
│   ├── skills/        # AI-agent MCP skills
│   ├── ai/           # AI draft generation
│   └── plugins/      # Plugin SDK
└── docs/             # Documentation
```

## Tech Stack

Astro, TypeScript, Cloudflare Pages, Tailwind CSS, MDX, MCP

## License

MIT
