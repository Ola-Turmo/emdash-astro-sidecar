# Agent Documentation

## Overview

EmDash Astro Sidecar includes MCP-compatible AI-agent skills for content generation, publishing workflows, and design system import. These skills enable AI agents to create blog posts, manage the publishing pipeline, and clone existing site designs to create matching Astro themes.

All skills follow the Model Context Protocol (MCP) specification and integrate with agents that support MCP tool calling.

## Available Skills

### content-gen

Generates blog post drafts as MDX with complete frontmatter. Creates structured, publication-ready content optimized for the Astro Sidecar blog format.

**When to use:**
- Creating new blog posts from scratch
- Generating first drafts for human editing
- Batch content creation for content calendars
- Producing SEO-optimized articles with proper schema markup

**Invocation:**
```
draft-gen <topic> <audience> <tone> [keywords]
```

**Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| topic | string | Yes | Main subject of the blog post |
| audience | string | Yes | Target reader demographic |
| tone | string | Yes | Writing tone: professional, casual, technical, friendly |
| keywords | string[] | No | SEO keywords to incorporate |
| schemaType | string | No | Schema.org type: Article, BlogPosting, TechArticle |
| articleStructure | string | No | Custom section outline |

**Example prompt to agent:**
```
Use the draft-gen skill to create a blog post about cloud infrastructure 
cost optimization for engineering teams. Tone: professional. Keywords: 
["AWS cost", "cloud savings", "infrastructure efficiency", "FinOps"]
```

**Output:** Complete MDX file with:
- Frontmatter: title, description, pubDate, author, category, tags, excerpt
- Structured sections with H2 and H3 headings
- Opening summary paragraph (3-5 sentences)
- 2-4 callout blocks (info, warning, tip variations)
- Image placeholders as HTML comments with suggested alt text
- FAQ entries formatted for FAQPage schema markup
- Internal link suggestions as HTML comments
- Closing section with CTA

**Output File Location:**
```
src/content/blog/[year]/[slug].mdx
```

**Example Output:**
```mdx
---
title: "Optimizing Cloud Infrastructure Costs for Engineering Teams"
description: "A comprehensive guide to reducing AWS spending without sacrificing performance."
pubDate: 2026-04-08
author: "Content Team"
category: "Infrastructure"
tags: ["AWS", "Cost Optimization", "FinOps", "Cloud"]
excerpt: "Engineering teams can reduce cloud costs by 30-50% through strategic 
         infrastructure optimization..."
---

## Introduction

<!-- IMAGE PLACEHOLDER: cloud cost dashboard screenshot 
     Alt: AWS Cost Explorer dashboard showing monthly spending trends -->

Summary paragraph about the importance of cloud cost optimization...

<!-- INTERNAL LINK: Consider linking to /blog/aws-best-practices/ -->

## Understanding Your Cloud Bill

### Raw Usage vs. Optimized

<!-- More content sections -->

## FAQ

### How much can we realistically save?

Realistic savings range from 20-40% for teams without existing optimization practices...

### What are the first steps?

Start with a cost audit using AWS Cost Explorer or similar tooling...
```

---

### publishing

Manages the complete publishing lifecycle: validation, preview, publish, unpublish, and rollback operations.

**When to use:**
- After content-gen to validate generated drafts
- Before publishing to check frontmatter and content quality
- Publishing approved content to production
- Rolling back problematic posts
- Managing content state across environments

**Actions:**

| Action | Description |
|--------|-------------|
| validate | Check frontmatter completeness and content quality |
| preview | Generate preview URL for review |
| publish | Move content from draft to published state |
| unpublish | Remove content from public view (keeps file) |
| rollback | Revert to previous published version |

**Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| action | string | Yes | One of: validate, preview, publish, unpublish, rollback |
| slug | string | Yes | Post slug (filename without extension) |
| content | string | No | MDX content (for validation) |

**Example:**
```
Use the publishing skill to validate the draft at src/content/blog/2026/cloud-cost-optimization.mdx
Then publish it after validation passes.
```

**Validation Rules:**

| Rule | Requirement | Error Level |
|------|-------------|-------------|
| Required frontmatter | title, description, pubDate, author, category, tags, excerpt | Error |
| Content length | Minimum 300 words | Warning |
| Lorem ipsum detection | No placeholder text | Error |
| Image alt text | All images must have alt attributes | Warning |
| Slug format | Lowercase, hyphens only | Error |
| Duplicate title | Check against existing posts | Warning |
| Date validity | pubDate must be valid ISO date | Error |

**Preview Generation:**
```
Publishing: Generating preview...
Preview URL: https://preview.example.com/blog/cloud-cost-optimization/
Preview expires in 24 hours
```

**Publishing Output:**
```
Publishing: Validating content...
✓ Frontmatter complete
✓ Content length: 1250 words
✓ No placeholder text detected
✓ Image alt texts present

Publishing: Creating draft...
✓ Draft created at: /blog/drafts/cloud-cost-optimization/

Publishing: Going live...
✓ Post published at: /blog/cloud-cost-optimization/
✓ Sitemap updated
✓ RSS feed updated
```

---

### design-import

Clones an existing website's design system and generates a matching Astro theme with appropriate colors, typography, spacing, and component patterns.

**When to use:**
- Setting up a new blog for a client
- Matching blog design to host site automatically
- Creating consistent theming across properties
- Rapid prototyping of blog designs

**Actions:**

| Action | Description |
|--------|-------------|
| cloneDesign | Analyze URL and generate Astro theme |
| listPresets | Show available pre-built theme presets |
| applyPreset | Apply a preset theme without cloning |
| reviewTheme | Generate theme review report |
| approveTheme | Confirm theme and write final files |

**Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| action | string | Yes | One of: cloneDesign, listPresets, applyPreset, reviewTheme, approveTheme |
| url-or-preset | string | Yes | URL to clone or preset name |

**Example:**
```
Use the design-import skill to clone the design from https://client-main-site.com
Review the generated theme, then approve it.
```

**cloneDesign Workflow:**

```
1. Fetching target site...
   URL: https://client-main-site.com
   Status: 200 OK

2. Extracting design tokens...
   Colors: Extracted 12 color values
   Typography: Extracted font families, sizes, weights
   Spacing: Extracted 8 spacing values
   Components: Detected 6 component patterns

3. Generating Astro theme...
   ✓ Created theme configuration
   ✓ Generated CSS variables
   ✓ Created component templates
   ✓ Built color variants

4. Theme ready for review
   Run: publishing skill with action=reviewTheme
```

**Available Presets:**

| Preset | Description | Use Case |
|--------|-------------|----------|
| minimal | Clean, text-focused design | Technical blogs |
| editorial | Magazine-style with featured images | Content sites |
| documentation | High-contrast, structured | Docs sites |
| portfolio | Visual-heavy, creative | Designer portfolios |

---

## Skill Definitions (MCP Format)

For MCP-compatible agents, the following JSON defines the tool schemas:

### draft-gen

```json
{
  "name": "draft-gen",
  "description": "Generate blog post drafts as MDX with full frontmatter. Creates structured content with H2/H3 sections, callouts, FAQ entries, and image placeholders.",
  "inputSchema": {
    "type": "object",
    "properties": {
      "topic": {
        "type": "string",
        "description": "Main subject of the blog post"
      },
      "audience": {
        "type": "string",
        "description": "Target reader demographic (e.g., 'engineering teams', 'product managers')"
      },
      "tone": {
        "type": "string",
        "enum": ["professional", "casual", "technical", "friendly"],
        "description": "Writing tone for the article"
      },
      "keywords": {
        "type": "array",
        "items": { "type": "string" },
        "description": "SEO keywords to incorporate into the content"
      },
      "schemaType": {
        "type": "string",
        "enum": ["Article", "BlogPosting", "TechArticle", "Tutorial"],
        "description": "Schema.org type for structured data"
      },
      "articleStructure": {
        "type": "string",
        "description": "Custom section outline (optional)"
      }
    },
    "required": ["topic", "audience", "tone"]
  }
}
```

### publishing

```json
{
  "name": "publishing",
  "description": "Validate, preview, and publish blog content. Supports full content lifecycle management.",
  "inputSchema": {
    "type": "object",
    "properties": {
      "action": {
        "type": "string",
        "enum": ["validate", "preview", "publish", "unpublish", "rollback"],
        "description": "The publishing action to perform"
      },
      "slug": {
        "type": "string",
        "description": "Post slug (filename without .mdx extension)"
      },
      "content": {
        "type": "string",
        "description": "MDX content to validate (alternative to slug)"
      },
      "reason": {
        "type": "string",
        "description": "Reason for unpublish or rollback"
      }
    },
    "required": ["action", "slug"]
  }
}
```

### design-import

```json
{
  "name": "design-import",
  "description": "Clone a website's design and generate matching Astro theme. Extracts colors, typography, and component patterns.",
  "inputSchema": {
    "type": "object",
    "properties": {
      "action": {
        "type": "string",
        "enum": ["cloneDesign", "listPresets", "applyPreset", "reviewTheme", "approveTheme"],
        "description": "The design import action to perform"
      },
      "url-or-preset": {
        "type": "string",
        "description": "URL to clone or preset name to apply"
      },
      "options": {
        "type": "object",
        "properties": {
          "includeComponents": {
            "type": "array",
            "items": { "type": "string" },
            "description": "Specific components to generate"
          },
          "colorMode": {
            "type": "string",
            "enum": ["light", "dark", "both"],
            "default": "light"
          }
        }
      }
    },
    "required": ["action"]
  }
}
```

---

## Example Workflows

### Full Content Workflow

Complete workflow from design cloning to published post:

```
1. Agent: "Clone the design from https://client-site.com"
   → design-import: cloneDesign(https://client-site.com)
   
   Output:
   Theme generated at: src/theme/generated-theme/
   Run reviewTheme to inspect, then approveTheme to apply

2. Agent: "Review the generated theme"
   → design-import: reviewTheme()
   
   Output:
   Theme Review:
   - Colors: 12 extracted (primary, secondary, accents)
   - Typography: 3 fonts detected
   - Components: 6 patterns identified
   - CSS Variables: 24 generated
   
   Quality Score: 8.5/10
   Recommendation: Apply with minor color tweaks

3. Agent: "Approve the theme"
   → design-import: approveTheme()
   
   Output:
   Theme applied to project
   Files modified: src/theme/index.css, astro.config.mjs

4. Agent: "Create a blog post about API security best practices for developers"
   → draft-gen(topic="API security best practices", audience="developers", tone="technical", keywords=["API security", "authentication", "OAuth"])
   
   Output:
   Created: src/content/blog/2026/api-security-best-practices.mdx
   Word count: 1250
   Sections: 6
   Callouts: 3
   FAQ entries: 4

5. Agent: "Validate and preview the draft"
   → publishing(action="validate", slug="2026/api-security-best-practices")
   
   Output:
   ✓ Validation passed
   Preview URL: https://preview.example.com/blog/api-security-best-practices/

6. Agent: "Publish the post"
   → publishing(action="publish", slug="2026/api-security-best-practices")
   
   Output:
   ✓ Published at: /blog/api-security-best-practices/
   ✓ Sitemap updated
   ✓ RSS feed updated
```

---

### Content Update Workflow

Updating an existing post:

```
1. Agent: "Validate the current version of our AWS cost optimization post"
   → publishing(action="validate", slug="cloud-cost-optimization")
   
   Output:
   ✓ Frontmatter complete
   ⚠ Content older than 90 days - consider updating
   ✓ All images have alt text

2. Agent: "The post needs updated statistics and a new section on spot instances"
   → [Human edits the content]

3. Agent: "Validate and publish the updated post"
   → publishing(action="validate", slug="cloud-cost-optimization")
   → publishing(action="publish", slug="cloud-cost-optimization")
   
   Output:
   ✓ Validation passed
   ✓ Updated post published
   ✓ Version 2 saved
```

---

### Rapid Setup Workflow

Quick blog setup using presets:

```
1. Agent: "List available theme presets"
   → design-import: listPresets()
   
   Output:
   Available Presets:
   - minimal: Clean, text-focused design
   - editorial: Magazine-style with featured images
   - documentation: High-contrast, structured
   - portfolio: Visual-heavy, creative

2. Agent: "Apply the minimal preset"
   → design-import: applyPreset(url-or-preset="minimal")
   
   Output:
   ✓ Minimal theme applied
   ✓ Configuration written to astro.config.mjs

3. Agent: "Create a first post introducing our company blog"
   → draft-gen(topic="Company blog launch", audience="customers, partners", tone="friendly", keywords=["announcement", "blog launch"])
   
   Output:
   Created: src/content/blog/2026/company-blog-launch.mdx

4. Agent: "Publish the introduction post"
   → publishing(action="publish", slug="2026/company-blog-launch")
```

---

## Guardrails

All content generation and publishing operations enforce the following guardrails:

### Required Frontmatter

| Field | Type | Description |
|-------|------|-------------|
| title | string | Post title (max 100 characters) |
| description | string | Meta description (max 160 characters) |
| pubDate | ISO date | Publication date |
| author | string | Author name |
| category | string | Primary category |
| tags | string[] | Array of tag strings |
| excerpt | string | Short excerpt for listings |

**Validation:**
```
Error: Missing required frontmatter field 'excerpt'
Error: 'pubDate' must be a valid ISO 8601 date
Warning: 'title' exceeds 100 characters, consider shortening
```

---

### Content Linting

| Rule | Threshold | Level |
|------|-----------|-------|
| Minimum word count | 300 words | Warning |
| Maximum word count | 5000 words | Warning |
| Lorem ipsum detection | 0 occurrences | Error |
| Consecutive sentences | Max 3 with same start | Warning |
| Heading hierarchy | H1 → H2 → H3 only | Error |

---

### Image Requirements

All images must include descriptive alt text:

```mdx
<!-- Good -->
<!-- IMAGE: screenshot of dashboard -->
<!-- IMAGE: graph showing cost reduction over 6 months
     Alt: Monthly AWS costs decreased from $12,400 to $8,200 -->

<!-- Bad -->
<!-- IMAGE: screenshot -->
<!-- IMAGE: graph -->
```

---

### Slug Validation

| Rule | Pattern | Example |
|------|---------|---------|
| Format | lowercase, hyphens only | `my-blog-post` |
| Length | 3-100 characters | |
| Start | Letter or number | `2-quick-tips` |
| No | consecutive hyphens | `my--post` (invalid) |

---

### Duplicate Detection

Before publishing, the system checks for:

1. **Exact title match** - Prevents duplicate posts
2. **Similar titles** - Uses Levenshtein distance (threshold: 80% similarity)
3. **Same slug** - Direct path conflict check

**Output:**
```
⚠ Warning: Similar title detected
Existing: "AWS Cost Optimization Guide"
New: "AWS Cost Optimization Strategies"
Similarity: 85%

Options:
1. Proceed anyway
2. Modify title
3. Merge with existing post
```

---

### Human Review Requirement

Posts tagged with `review-required` trigger human review before publishing:

```yaml
---
title: "Controversial Industry Opinion"
tags: ["review-required", "opinion"]
---
```

**Publishing flow:**
```
⚠ Human review required for posts tagged [review-required]
Status: Pending Review
Review URL: https://admin.example.com/review/123

Agent cannot auto-publish. Awaiting human approval.
```

---

### Content Safety

| Check | Action |
|-------|--------|
| Profanity detection | Error - block publish |
| PII detection | Warning - require confirmation |
| External link validation | Warning - broken links flagged |
| Copyright material | Error - block if detected |

---

### Publishing Environment Gates

| Environment | Auto-publish | Requires approval |
|-------------|--------------|-------------------|
| development | Yes | No |
| staging | Yes | No |
| production | No | Yes |

---

## Error Handling

### draft-gen Errors

| Error | Resolution |
|-------|------------|
| "Unable to fetch topic research" | Provide more specific topic |
| "Content generation failed" | Retry with simplified topic |
| "Output file write failed" | Check file permissions |

### publishing Errors

| Error | Resolution |
|-------|------------|
| "Slug already exists" | Use different slug or unpublish existing |
| "Frontmatter validation failed" | Fix missing/invalid fields |
| "File not found" | Check slug path |
| "Publish target unreachable" | Check environment configuration |

### design-import Errors

| Error | Resolution |
|-------|------------|
| "URL unreachable" | Verify URL is accessible |
| "Design extraction failed" | Try different URL or use preset |
| "Invalid CSS extracted" | Manually specify tokens |
| "Theme approval required" | Run approveTheme first |

---

## Configuration

Skills can be configured via `astro.config.mjs`:

```javascript
export default defineConfig({
  skills: {
    contentGen: {
      defaultTone: 'professional',
      maxWordCount: 5000,
      requireHumanReview: ['opinion', 'legal'],
      autoTagCategories: true
    },
    publishing: {
      requireApproval: ['production'],
      validationLevel: 'strict',
      previewExpiryHours: 24,
      autoPublishStaging: true
    },
    designImport: {
      cacheExtractedDesigns: true,
      defaultPreset: 'minimal',
      autoApproveThreshold: 9.0
    }
  }
})
```
