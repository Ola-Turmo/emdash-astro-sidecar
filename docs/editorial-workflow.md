# Editorial Workflow

## Purpose

The sidecar is not a generic blog dump. It is a GEO/SEO support layer for the host site.

Every article should do at least one of these clearly:

- answer a real pre-purchase question
- reduce friction before checkout
- explain a regulatory or operational concept
- strengthen topical authority for AI and search retrieval

## End-User Language Rule

Read [copy-guidelines.md](./copy-guidelines.md) before writing homepage copy, article intros, section labels, or CTA text.

Non-technical users should never see internal strategy language such as:

- sidecar
- GEO layer
- content wave
- cluster
- “how the blog is connected to the main site”

Those are internal operating terms, not reader-facing language.

## Current Content Model

Defined in:

- `apps/blog/src/content.config.ts`

Collections:

- `blog`
- `authors`
- `categories`
- `tags`
- `docs`
- `posts.bak`

## Required Blog Frontmatter

Each article in `apps/blog/src/content/blog/` needs:

- `title`
- `description`
- `pubDate`
- `author`
- `category`
- `tags`
- `excerpt`
- `schemaType`
- `draft`

Optional:

- `updatedDate`
- `featuredImage`
- `relatedPosts`

## Publishing Rules

- keep demo or experimental content as `draft: true`
- publish only host-relevant articles in the active sidecar
- prefer explicit, question-driven titles
- keep excerpts usable as standalone search snippets
- prefer categories that map to host-site commercial or informational clusters

## Recommended Article Shapes

Use these heavily:

- explainer
- requirement guide
- how-to
- FAQ-heavy article
- role/responsibility breakdown
- comparison article when it supports a commercial question

## Internal Linking

Every published article should have:

- at least one link back to the relevant commercial page on the host site
- tags that create connected topic clusters
- category placement that reflects the commercial/user-intent structure

## Initial Content Checklist For A New Host Site

1. Create the active author profile.
2. Create host-specific categories.
3. Mark old demo articles as drafts.
4. Publish 3-5 core articles that answer high-intent questions.
5. Verify category, author, tag, RSS, and sitemap pages build cleanly.

## Content Quality Gates

Before publishing:

- article answers one concrete question clearly
- title and excerpt are not generic
- visible copy sounds natural to an end user, not to an internal operator
- article links back to the host site
- frontmatter matches the schema
- `pnpm --filter @emdash/blog build` succeeds
