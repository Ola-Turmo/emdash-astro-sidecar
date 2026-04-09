---
name: draft-gen
description: Generate blog post drafts as MDX with frontmatter, structured sections, callouts, FAQs, and SEO hints. Use when generating content for the EmDash Astro blog.
argument-hint: "<topic> <audience> <tone> [keywords]"
user-invocable: true
---

# Content Generation Skill

Generate a blog post draft as MDX with full frontmatter and structured sections.

Read `docs/copy-guidelines.md` before generating copy that users will see.

## Input Parameters

When invoked with arguments, parse as:
- **topic**: What the article is about
- **audience**: Who the article is written for
- **tone**: One of: professional, conversational, technical, casual
- **targetKeywords**: Comma-separated SEO keywords to naturally include
- **schemaType**: Article | TechArticle | BlogPosting | HowTo | FAQPage (default: BlogPosting)
- **articleStructure**: listicle | tutorial | comparison | case-study | standard (default: standard)

## Output Format

The skill outputs a complete MDX document:

```mdx
---
title: "<generated title>"
description: "<2-3 sentence description for SEO>"
pubDate: <current date ISO>
author: <author-slug>
category: <category-slug>
tags: [<tag1>, <tag2>, <tag3>]
featuredImage:
  src: /images/blog/<slug>.jpg
  alt: "<image alt text>"
excerpt: "<first 160 chars of content summary>"
schemaType: <schemaType>
draft: true
---

# <Title>

<!-- summary: This article covers... -->

## Introduction
[2-3 paragraph introduction engaging the reader about the topic]

## <Main Section 1>
[Content with h2 heading]

### <Sub-section>
[More detailed content]

## <Main Section 2>
[More content]

<!-- callout:info:Key Insight: Highlight an important point here -->

## <Main Section 3>
[More content]

<!-- faq:Question 1: Answer text -->
<!-- faq:Question 2: Answer text -->

## Conclusion
[Summary of key takeaways and call to action]

<!-- internal-link:/category/tutorial:Related Tutorial: Link text -->
```

## Generation Rules

1. **Title**: Compelling, under 60 chars, includes primary keyword
2. **Frontmatter**: Complete, valid YAML — all required fields
3. **Structure**: Follow the articleStructure parameter
4. **Keywords**: Naturally integrate 3-5 target keywords
5. **Callouts**: 2-4 relevant callout blocks (info/warning/tip/danger)
6. **FAQs**: 3-5 FAQ entries for FAQPage schema type
7. **Internal links**: Suggest 2-3 internal link opportunities as comments
8. **Image placeholders**: Include `<!-- image:alt:description -->` comments
9. **Schema hints**: Include JSON-LD structure hints as comments
10. **Word count**: Target 800-1500 words for standard articles
11. **End-user language**: Do not use internal phrases like sidecar, GEO layer, content wave, support layer, or other operator jargon unless the article is explicitly written for internal or technical readers

## Quality Checklist

- [ ] Title under 60 characters
- [ ] Description under 160 characters
- [ ] All frontmatter fields present and valid
- [ ] H1 matches title
- [ ] H2/H3 hierarchy is logical
- [ ] Keywords appear in title, first paragraph, and at least 2 headings
- [ ] No placeholder text like "lorem ipsum" or "your content here"
- [ ] Internal link suggestions are contextually relevant
- [ ] FAQ questions are natural, common search queries
- [ ] Visible copy sounds like something a real customer would say, ask, or understand immediately

## Usage Examples

```
draft-gen "Getting started with Astro" "web developers" "technical" "astro,static site,jamstack"
draft-gen "Email marketing best practices" "marketers" "professional" "email marketing,conversion,automation"
```
