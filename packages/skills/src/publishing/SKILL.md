---
name: publishing
description: Validate, preview, and publish blog posts to the EmDash Astro blog. Use after content-gen to validate and publish drafts.
argument-hint: "<action> <slug>"
user-invocable: true
---

# Publishing Skill

Validate, preview, and publish blog post drafts to the EmDash Astro blog.

## Actions

### validate
Validate MDX content for frontmatter completeness and content quality.

### preview
Generate a preview URL for a draft post.

### publish
Publish a validated draft post to the live blog.

### unpublish
Move a published post back to drafts.

### rollback
Restore a previous version of a post.

## Validation Rules

1. **Frontmatter required fields:**
   - title: non-empty string, under 80 chars
   - description: non-empty string, under 200 chars
   - pubDate: valid ISO date
   - author: must match existing author slug
   - category: must match existing category slug
   - tags: array of 1-10 string tags
   - excerpt: under 160 chars
   - schemaType: one of Article, BlogPosting, TechArticle, HowTo, FAQPage

2. **Slug rules:**
   - lowercase, hyphens only
   - no reserved words (admin, api, blog without slug)
   - 3-63 characters

3. **Content rules:**
   - no "lorem ipsum" placeholder text
   - minimum 300 words
   - all images must have alt text
   - no broken internal link placeholders

4. **Quality guardrails:**
   - contentPolicyCheck: no policy-violating content
   - spamScoreCheck: no spam patterns
   - requireApproval: certain tags flag for human review

## Usage

```
publishing validate getting-started-with-astro
publishing preview my-new-post
publishing publish my-new-post
publishing unpublish old-post
publishing rollback my-post v2
```