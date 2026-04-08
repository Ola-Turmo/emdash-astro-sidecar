# Setup Guide

## Prerequisites

- Node.js 20+
- pnpm 10+
- Cloudflare account (for deployment)

## Installation

1. Clone the repository:
```bash
git clone https://github.com/emdash/emdash-astro-sidecar.git
cd emdash-astro-sidecar
```

2. Install dependencies:
```bash
pnpm install
```

## Configuration

### Environment Variables

Create `.env` files as needed:

```env
# Blog URL
SITE_URL=https://example.com

# Cloudflare (for deployment)
CLOUDFLARE_ACCOUNT_ID=your_account_id
CLOUDFLARE_API_TOKEN=your_api_token
```

### Blog Configuration

Edit `apps/blog/astro.config.mjs` to configure your blog:

```js
export default defineConfig({
  site: 'https://your-blog-url.com',
  output: 'static',
  // ... other config
});
```

### EmDash Configuration

EmDash provides the CMS layer. Configure it in `apps/blog/src/content/config.ts` by defining your content collection schemas.

## Development

Start the development server:

```bash
pnpm dev
```

The blog will be available at `http://localhost:4321`.

## Project Structure

```
apps/blog/           # Main blog application
├── src/
│   ├── components/  # Astro components
│   ├── layouts/      # Page layouts
│   ├── pages/        # Astro pages
│   ├── content/      # Content collections
│   └── styles/       # Global styles
├── public/          # Static assets
└── wrangler.jsonc   # Cloudflare config
```

## Adding Content

Create new posts in `apps/blog/src/content/posts/` as MDX files:

```mdx
---
title: My First Post
description: A description of the post
publishDate: 2024-12-01
author: author-name
category: tutorials
tags: ["astro", "emdash"]
---

# My First Post

Your content here...
```

## Building

```bash
pnpm build
```

Output will be in `apps/blog/.output/`.
