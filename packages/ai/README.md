# @emdash/ai

AI-powered content generation utilities for the EmDash publishing system.

## Overview

This package provides the `DraftGenerator` class that generates structured MDX blog post drafts from topics using OpenAI-compatible APIs. It creates complete drafts with YAML frontmatter, proper SEO structure, and validation.

## Installation

```bash
npm install @emdash/ai
```

## Quick Start

```typescript
import { DraftGenerator } from '@emdash/ai';

const generator = new DraftGenerator({
  apiKey: process.env.OPENAI_API_KEY,
  model: 'gpt-4o',
});

const draft = await generator.generate({
  topic: 'Getting Started with Astro and EmDash',
  primaryKeyword: 'astro emdash',
  category: 'tutorials',
  ctaText: 'Learn more about EmDash',
  ctaUrl: 'https://emdash.dev/docs',
});

console.log(draft.title);
console.log(draft.fullMdx);
```

## API Reference

### DraftGenerator

#### Constructor Options

```typescript
interface DraftGeneratorOptions {
  /** OpenAI API key (defaults to OPENAI_API_KEY env variable) */
  apiKey?: string;
  /** Model to use (default: gpt-4o) */
  model?: string;
  /** Custom API base URL for OpenAI-compatible APIs */
  baseURL?: string;
  /** Path to custom system prompt file */
  systemPromptPath?: string;
  /** Path to custom user prompt template file */
  userPromptPath?: string;
}
```

#### Methods

##### `generate(input: DraftGenerationInput): Promise<GeneratedDraft>`

Generates a blog post draft from the given input parameters.

```typescript
interface DraftGenerationInput {
  topic: string;
  audience?: string;
  tone?: 'casual' | 'professional' | 'technical' | 'conversational';
  primaryKeyword?: string;
  secondaryKeywords?: string[];
  wordCountTarget?: number;
  schemaType?: 'Article' | 'BlogPostting';
  category?: string;
  ctaText?: string;
  ctaUrl?: string;
}
```

##### `generateFromOutline(outline: PostOutline): Promise<GeneratedDraft>`

Generates a draft from a structured outline.

```typescript
interface PostOutline {
  title: string;
  topic: string;
  sections: Array<{
    heading: string;
    content: string;
  }>;
  primaryKeyword: string;
  secondaryKeywords?: string[];
  audience?: string;
  tone?: 'casual' | 'professional' | 'technical' | 'conversational';
  category?: string;
  ctaText?: string;
  ctaUrl?: string;
}
```

##### `validateDraft(mdx: string): DraftValidationResult`

Validates a draft for common issues.

```typescript
interface DraftValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}
```

##### `extractFrontmatter(mdx: string): Record<string, any>`

Extracts YAML frontmatter from MDX content.

##### `stripFrontmatter(mdx: string): string`

Removes frontmatter from MDX, returning just the body.

#### Return Types

```typescript
interface GeneratedDraft {
  frontmatter: DraftFrontmatter;
  body: string;
  fullMdx: string;
  wordCount: number;
  readingTime: number;
  keywords: string[];
  warnings: string[];
}

interface DraftFrontmatter {
  title: string;
  description: string;
  publishDate: string;
  author: string;
  category: string;
  tags: string[];
  excerpt: string;
  slug: string;
  readingTime: number;
  status: 'draft';
  schemaType: 'Article' | 'BlogPosting';
  keywords: string[];
  featuredImage?: string;
  ctaText?: string;
  ctaUrl?: string;
}
```

## Example Usage

### Basic Draft Generation

```typescript
import { DraftGenerator } from '@emdash/ai';

const generator = new DraftGenerator({
  apiKey: process.env.OPENAI_API_KEY,
  baseURL: 'https://api.openai.com/v1', // or custom endpoint
});

const draft = await generator.generate({
  topic: 'Building a Blog with Astro and MDX',
  primaryKeyword: 'astro mdx blog',
  secondaryKeywords: ['static site', 'content management', 'web development'],
  category: 'tutorials',
  audience: 'web developers',
  tone: 'technical',
  wordCountTarget: 1200,
  ctaText: 'Start building with Astro',
  ctaUrl: 'https://astro.build',
});

console.log(`Generated: ${draft.frontmatter.title}`);
console.log(`Word count: ${draft.wordCount}`);
console.log(`Reading time: ${draft.readingTime} min`);
```

### Validation

```typescript
const validation = generator.validateDraft(draft.fullMdx);

if (!validation.isValid) {
  console.error('Draft has errors:', validation.errors);
}

if (validation.warnings.length > 0) {
  console.warn('Draft warnings:', validation.warnings);
}
```

### Custom Prompts

```typescript
const generator = new DraftGenerator({
  systemPromptPath: './custom-system-prompt.md',
  userPromptPath: './custom-user-prompt.md',
});
```

## Error Handling

The `generate()` method throws on API failure:

```typescript
try {
  const draft = await generator.generate({ topic: '...' });
} catch (error) {
  if (error instanceof Error) {
    console.error(`Generation failed: ${error.message}`);
  }
}
```

## Validation Checks

The `validateDraft()` method checks:

- Frontmatter has all required fields
- Title is 30-70 characters
- Description is 100-160 characters
- Body has at least 3 H2 sections
- Word count is within target ±20%
- Primary keyword appears in title and body
- No unmatched brackets or parentheses
- Call-to-action present near end

## Compatibility

Works with any OpenAI-compatible API including:
- OpenAI GPT-4
- MiniMax AI
- Local models via LM Studio / Ollama
- Custom API endpoints

## License

MIT
