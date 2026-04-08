# Editorial Workflow

EmDash Astro Sidecar provides a structured editorial workflow for blog content management.

## Content Types

### Posts

Blog posts are MDX files in `src/content/posts/`:

```mdx
---
title: Post Title
description: Brief description
publishDate: 2024-12-01
author: author-slug
category: category-slug
tags: ["tag1", "tag2"]
draft: false
featured: true
---

Post content here...
```

### Authors

Author profiles in `src/content/authors/`:

```yaml
name: Author Name
bio: Author biography
avatar: /authors/avatar.jpg
email: author@example.com
twitter: authorhandle
github: author-github
```

### Categories

Category definitions in `src/content/categories/`:

```yaml
name: Category Name
slug: category-slug
description: Category description
color: "#3b82f6"
parent: parent-category-slug  # optional
```

## Workflow Stages

### 1. Draft

Create a new post with `draft: true`:

```mdx
---
title: My Draft Post
draft: true
---

Draft content...
```

### 2. Review

Move draft to review by:
1. Completing the content
2. Adding proper frontmatter
3. Setting `draft: false` (or removing it)

### 3. Scheduled

Set `publishDate` to schedule publication:

```yaml
publishDate: 2024-12-15  # Future date for scheduling
```

### 4. Published

Posts with `publishDate` in the past and `draft: false` are published.

### 5. Updated

Update `updatedDate` when modifying published posts:

```yaml
publishDate: 2024-12-01
updatedDate: 2024-12-10
```

## Querying Content

### Get Published Posts

```typescript
import { getCollection } from 'astro:content';

const posts = await getCollection('posts', ({ data }) => {
  return !data.draft;
});
```

### Get Posts by Author

```typescript
const authorPosts = posts.filter(post => post.data.author === 'author-slug');
```

### Get Featured Posts

```typescript
const featuredPosts = posts.filter(post => post.data.featured);
```

## Publishing with Skills

AI agents can handle publishing via skills:

1. **draft-gen** - Generate post drafts
2. **publishing** - Validate and publish content

See `packages/skills/src/` for skill definitions.
