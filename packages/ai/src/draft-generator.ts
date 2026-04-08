/**
 * AI Draft Generator
 * 
 * Generates structured MDX blog post drafts from topics using OpenAI-compatible APIs.
 * @module @emdash/ai
 */

import OpenAI from 'openai';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Types

/**
 * Configuration options for DraftGenerator
 */
export interface DraftGeneratorOptions {
  /** OpenAI API key (defaults to OPENAI_API_KEY env variable) */
  apiKey?: string;
  /** Model to use (default: gpt-4o) */
  model?: string;
  /** Custom API base URL for OpenAI-compatible APIs */
  baseURL?: string;
  /** System prompt path (defaults to bundled prompt) */
  systemPromptPath?: string;
  /** User prompt template path (defaults to bundled template) */
  userPromptPath?: string;
}

/**
 * Input for draft generation
 */
export interface DraftGenerationInput {
  /** The main topic/idea for the blog post */
  topic: string;
  /** Target audience description */
  audience?: string;
  /** Writing tone */
  tone?: 'casual' | 'professional' | 'technical' | 'conversational';
  /** Primary SEO keyword */
  primaryKeyword?: string;
  /** Secondary keywords for SEO */
  secondaryKeywords?: string[];
  /** Target word count for the body */
  wordCountTarget?: number;
  /** Schema.org type for structured data */
  schemaType?: 'Article' | 'BlogPostting';
  /** Content category */
  category?: string;
  /** Call-to-action text */
  ctaText?: string;
  /** Call-to-action URL */
  ctaUrl?: string;
}

/**
 * Post outline for structured generation
 */
export interface PostOutline {
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

/**
 * Frontmatter extracted from MDX
 */
export interface DraftFrontmatter {
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
  schemaType: 'Article' | 'BlogPostting';
  keywords: string[];
  featuredImage?: string;
  ctaText?: string;
  ctaUrl?: string;
}

/**
 * Generated draft result
 */
export interface GeneratedDraft {
  frontmatter: DraftFrontmatter;
  body: string;
  fullMdx: string;
  wordCount: number;
  readingTime: number;
  keywords: string[];
  warnings: string[];
}

/**
 * Validation result for draft
 */
export interface DraftValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Default system prompt content
 */
const DEFAULT_SYSTEM_PROMPT = `# Draft Generation System Prompt

You are an expert blog post writer with deep understanding of SEO, content marketing, and technical writing. Your task is to generate high-quality, structured blog post drafts in MDX format.

## Your Output Format

Always output a complete MDX file with YAML frontmatter followed by the body content.

### Frontmatter Schema

\`\`\`yaml
---
title: "Post Title (30-70 characters, includes primary keyword)"
description: "Meta description (100-160 characters, compelling summary)"
publishDate: "YYYY-MM-DD" # Set to 30 days in the future from today
author: "author-slug"
category: "category-name"
tags: ["tag1", "tag2", "tag3"]
excerpt: "Short excerpt for cards/feeds (150-200 characters)"
slug: "url-friendly-slug"
readingTime: number # Calculated: words / 200, rounded up
status: "draft"
schemaType: "Article" # or "BlogPosting"
keywords: ["primary-keyword", "secondary1", "secondary2", "related3", "related4"]
featuredImage: "https://example.com/image.jpg" # Optional placeholder
ctaText: "Call to action text"
ctaUrl: "https://example.com/cta-target"
---
\`\`\`

### Body Structure Requirements

1. **Catchy Intro Paragraph**: First 100 words must include the primary keyword naturally, hook the reader, and state the post's purpose.

2. **H2 Sections**: Minimum of 3-4 major sections, each with:
   - Clear topic sentence
   - 2-4 paragraphs of supporting content
   - Examples where appropriate

3. **H3 Subsections**: Use where needed for:
   - Listing steps in a process
   - Breaking down complex topics
   - Categorizing related information

4. **Callout Blocks**: For tips, warnings, or important info:
   \`\`\`md
   > **Tip:** Useful advice for the reader
   >
   > **Important:** Critical information to remember
   \`\`\`

5. **Code Blocks**: For technical content, include syntax-highlighted examples:
   \`\`\`javascript
   // Code example with comments
   const example = "hello";
   \`\`\`

6. **Lists**: Use for:
   - Numbered lists (step-by-step instructions)
   - Bullet lists (features, options, related items)

7. **Blockquotes**: For expert quotes or external validation:
   \`\`\`md
   > "Quote text from expert or source."
   > — Name, Title/Source
   \`\`\`

8. **Internal Linking Hooks**: Naturally mention 2-3 related topics without linking, e.g., "Related to this topic is [future post topic]" — this creates SEO architecture.

### Content Guidelines

- **Target Word Count**: 800-1500 words for the body
- **Tone**: Conversational but authoritative. You're a knowledgeable friend explaining something, not a corporate marketing department, not overly casual.
- **SEO Optimization**:
  - Primary keyword in title, first 100 words, at least 2 subheadings, and meta description
  - Secondary keywords naturally distributed throughout
  - Readable, scannable structure with clear hierarchy

- **Call-to-Action**: End with a clear CTA that aligns with the provided ctaText and ctaUrl.

### What NOT To Do

- Don't use excessive jargon or buzzwords
- Don't write thin content (under 600 words)
- Don't keyword stuff — integrate naturally
- Don't use generic titles like "Everything You Need to Know About X"
- Don't write conclusions that are just summaries — push to action

### Reading Time Calculation

Calculate reading time as: \`Math.ceil(wordCount / 200)\` minutes.

### Quality Checklist

Before completing, verify:
- [ ] Title is 30-70 characters and contains primary keyword
- [ ] Description is 100-160 characters
- [ ] First 100 words contain primary keyword
- [ ] At least 3 H2 sections exist
- [ ] Primary keyword appears in at least 2 subheadings
- [ ] CTA is at the end
- [ ] Word count is within target range
- [ ] Frontmatter is complete and valid YAML`;

/**
 * Default user prompt template
 */
const DEFAULT_USER_PROMPT = `Generate a blog post draft about: {topic}

Target audience: {audience}
Tone: {tone}
Primary keyword: {primaryKeyword}
Secondary keywords: {secondaryKeywords}
Word count target: {wordCount}
Schema type: {schemaType} (Article or BlogPostting)
Category: {category}
CTA text: {ctaText}
CTA URL: {ctaUrl}`;

/**
 * DraftGenerator class
 * 
 * Generates structured MDX blog post drafts from topics.
 */
export class DraftGenerator {
  private client: OpenAI;
  private model: string;
  private systemPrompt: string;
  private userPromptTemplate: string;

  /**
   * Creates a new DraftGenerator instance
   * @param options - Configuration options
   */
  constructor(options: DraftGeneratorOptions = {}) {
    this.model = options.model || 'gpt-4o';
    this.systemPrompt = DEFAULT_SYSTEM_PROMPT;
    this.userPromptTemplate = DEFAULT_USER_PROMPT;

    // Try to load custom prompts from files if paths provided
    if (options.systemPromptPath) {
      try {
        this.systemPrompt = readFileSync(options.systemPromptPath, 'utf-8');
      } catch (e) {
        console.warn(`Could not load system prompt from ${options.systemPromptPath}, using default`);
      }
    }

    if (options.userPromptPath) {
      try {
        this.userPromptTemplate = readFileSync(options.userPromptPath, 'utf-8');
      } catch (e) {
        console.warn(`Could not load user prompt from ${options.userPromptPath}, using default`);
      }
    }

    // Initialize OpenAI client
    this.client = new OpenAI({
      apiKey: options.apiKey || process.env.OPENAI_API_KEY || 'dummy-key-for-types',
      baseURL: options.baseURL,
    });
  }

  /**
   * Generates a blog post draft from the given input
   * @param input - Draft generation input parameters
   * @returns Generated draft with frontmatter, body, and metadata
   */
  async generate(input: DraftGenerationInput): Promise<GeneratedDraft> {
    const {
      topic,
      audience = 'general readers',
      tone = 'conversational',
      primaryKeyword = this.extractKeyword(topic),
      secondaryKeywords = [],
      wordCountTarget = 1200,
      schemaType = 'Article',
      category = 'general',
      ctaText = 'Learn more',
      ctaUrl = '#',
    } = input;

    // Build user prompt from template
    const userPrompt = this.buildUserPrompt({
      topic,
      audience,
      tone,
      primaryKeyword,
      secondaryKeywords,
      wordCountTarget,
      schemaType,
      category,
      ctaText,
      ctaUrl,
    });

    // Call LLM API
    let response: string;
    try {
      const completion = await this.client.chat.completions.create({
        model: this.model,
        messages: [
          { role: 'system', content: this.systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.7,
        max_tokens: 4000,
      });

      response = completion.choices[0]?.message?.content || '';
      
      if (!response) {
        throw new Error('Empty response from API');
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Draft generation failed: ${message}`);
    }

    // Parse the MDX response
    const frontmatter = this.extractFrontmatter(response);
    const body = this.stripFrontmatter(response);
    
    // Calculate word count and reading time
    const wordCount = this.countWords(body);
    const readingTime = Math.ceil(wordCount / 200);

    // Update frontmatter with calculated values
    frontmatter.readingTime = readingTime;
    if (frontmatter.ctaText === undefined && ctaText) {
      frontmatter.ctaText = ctaText;
    }
    if (frontmatter.ctaUrl === undefined && ctaUrl) {
      frontmatter.ctaUrl = ctaUrl;
    }

    // Build full MDX
    const fullMdx = this.buildFullMdx(frontmatter, body);

    // Validate the draft
    const validation = this.validateDraft(fullMdx);

    // Collect keywords
    const keywords = this.extractKeywords(frontmatter, body, primaryKeyword, secondaryKeywords);

    return {
      frontmatter,
      body,
      fullMdx,
      wordCount,
      readingTime,
      keywords,
      warnings: validation.warnings,
    };
  }

  /**
   * Generates a draft from a structured outline
   * @param outline - Post outline with sections
   * @returns Generated draft
   */
  async generateFromOutline(outline: PostOutline): Promise<GeneratedDraft> {
    const {
      topic,
      sections,
      primaryKeyword,
      secondaryKeywords = [],
      audience = 'general readers',
      tone = 'conversational',
      category = 'general',
      ctaText = 'Learn more',
      ctaUrl = '#',
    } = outline;

    const wordCountTarget = sections.reduce((sum, s) => sum + this.countWords(s.content), 0) + 200;

    const input: DraftGenerationInput = {
      topic,
      audience,
      tone,
      primaryKeyword,
      secondaryKeywords,
      wordCountTarget,
      category,
      ctaText,
      ctaUrl,
    };

    return this.generate(input);
  }

  /**
   * Validates a draft for common issues
   * @param mdx - MDX content to validate
   * @returns Validation result with errors and warnings
   */
  validateDraft(mdx: string): DraftValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Extract frontmatter
    const frontmatter = this.extractFrontmatter(mdx);
    const body = this.stripFrontmatter(mdx);

    // Check required frontmatter fields
    const requiredFields = ['title', 'description', 'publishDate', 'author', 'category', 'excerpt', 'slug', 'schemaType'];
    for (const field of requiredFields) {
      if (!frontmatter[field as keyof DraftFrontmatter]) {
        errors.push(`Missing required frontmatter field: ${field}`);
      }
    }

    // Validate title length
    if (frontmatter.title) {
      if (frontmatter.title.length < 30 || frontmatter.title.length > 70) {
        errors.push(`Title length (${frontmatter.title.length}) is outside optimal range (30-70 characters)`);
      }
    }

    // Validate description length
    if (frontmatter.description) {
      if (frontmatter.description.length < 100 || frontmatter.description.length > 160) {
        errors.push(`Description length (${frontmatter.description.length}) is outside optimal range (100-160 characters)`);
      }
    }

    // Check for minimum sections
    const h2Matches = body.match(/^##\s+.+$/gm);
    if (!h2Matches || h2Matches.length < 3) {
      errors.push(`Body should have at least 3 H2 sections, found ${h2Matches?.length || 0}`);
    }

    // Check word count
    const wordCount = this.countWords(body);
    const targetWordCount = 1200; // Default target
    const minWordCount = targetWordCount * 0.8;
    const maxWordCount = targetWordCount * 1.2;

    if (wordCount < minWordCount) {
      warnings.push(`Word count (${wordCount}) is below target range (${minWordCount}-${maxWordCount})`);
    } else if (wordCount > maxWordCount) {
      warnings.push(`Word count (${wordCount}) is above target range (${minWordCount}-${maxWordCount})`);
    }

    // Check for keyword in title
    const primaryKeyword = frontmatter.keywords?.[0] || '';
    if (primaryKeyword && frontmatter.title && !frontmatter.title.toLowerCase().includes(primaryKeyword.toLowerCase())) {
      warnings.push(`Primary keyword "${primaryKeyword}" not found in title`);
    }

    // Check for keyword in body
    if (primaryKeyword && body && !body.toLowerCase().includes(primaryKeyword.toLowerCase())) {
      errors.push(`Primary keyword "${primaryKeyword}" not found in body`);
    }

    // Check for broken markdown (unmatched brackets)
    const unmatchedOpenBrackets = (body.match(/\[/g) || []).length;
    const unmatchedCloseBrackets = (body.match(/\]/g) || []).length;
    if (unmatchedOpenBrackets !== unmatchedCloseBrackets) {
      errors.push('Unmatched square brackets in body');
    }

    const unmatchedOpenParens = (body.match(/\(/g) || []).length;
    const unmatchedCloseParens = (body.match(/\)/g) || []).length;
    if (unmatchedOpenParens !== unmatchedCloseParens) {
      errors.push('Unmatched parentheses in body');
    }

    // Check for CTA at the end
    if (!/(?:call to action|sign up|learn more|get started|contact us|read more|download)/i.test(body.slice(-300))) {
      warnings.push('No clear call-to-action found near the end of the post');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Extracts YAML frontmatter from MDX content
   * @param mdx - MDX content
   * @returns Parsed frontmatter object
   */
  extractFrontmatter(mdx: string): Record<string, unknown> {
    const match = mdx.match(/^---\n([\s\S]*?)\n---\n/);
    
    if (!match) {
      return {};
    }

    const frontmatterStr = match[1];
    const result: Record<string, unknown> = {};

    // Simple YAML parser for frontmatter
    const lines = frontmatterStr.split('\n');
    let currentKey: string | null = null;
    let currentArray: string[] = [];
    let inArray = false;

    for (const line of lines) {
      // Check for array start
      if (line.match(/^\s*keywords:\s*$/)) {
        inArray = true;
        currentKey = 'keywords';
        currentArray = [];
        continue;
      }

      // Check for array items
      if (inArray && line.match(/^\s*-\s+/)) {
        const value = line.replace(/^\s*-\s+/, '').replace(/^["']|["']$/g, '').trim();
        currentArray.push(value);
        continue;
      }

      // End of array
      if (inArray && !line.match(/^\s+/)) {
        result[currentKey!] = currentArray;
        inArray = false;
        currentKey = null;
      }

      // Key-value pair
      const kvMatch = line.match(/^(\w+):\s*(.*)$/);
      if (kvMatch) {
        const [, key, value] = kvMatch;
        
        if (inArray && currentKey) {
          result[currentKey] = currentArray;
          inArray = false;
          currentKey = null;
        }

        // Handle different value types
        if (value === '' || value === 'null') {
          result[key] = null;
        } else if (value === 'true') {
          result[key] = true;
        } else if (value === 'false') {
          result[key] = false;
        } else if (value.startsWith('"') && value.endsWith('"')) {
          result[key] = value.slice(1, -1);
        } else if (value.startsWith("'") && value.endsWith("'")) {
          result[key] = value.slice(1, -1);
        } else if (!isNaN(Number(value)) && value.trim() !== '') {
          result[key] = Number(value);
        } else {
          result[key] = value;
        }
      }
    }

    // Handle array at end of file
    if (inArray && currentKey) {
      result[currentKey] = currentArray;
    }

    return result;
  }

  /**
   * Removes frontmatter from MDX, returning just the body
   * @param mdx - MDX content with frontmatter
   * @returns Body content without frontmatter
   */
  stripFrontmatter(mdx: string): string {
    return mdx.replace(/^---\n[\s\S]*?\n---\n/, '');
  }

  /**
   * Builds user prompt from template with values
   */
  private buildUserPrompt(params: {
    topic: string;
    audience: string;
    tone: string;
    primaryKeyword: string;
    secondaryKeywords: string[];
    wordCountTarget: number;
    schemaType: string;
    category: string;
    ctaText: string;
    ctaUrl: string;
  }): string {
    return this.userPromptTemplate
      .replace('{topic}', params.topic)
      .replace('{audience}', params.audience)
      .replace('{tone}', params.tone)
      .replace('{primaryKeyword}', params.primaryKeyword)
      .replace('{secondaryKeywords}', params.secondaryKeywords.join(', ') || 'none')
      .replace('{wordCount}', String(params.wordCountTarget))
      .replace('{schemaType}', params.schemaType)
      .replace('{category}', params.category)
      .replace('{ctaText}', params.ctaText)
      .replace('{ctaUrl}', params.ctaUrl);
  }

  /**
   * Extracts a keyword from topic string
   */
  private extractKeyword(topic: string): string {
    // Simple extraction - take the main noun/phrase
    const cleaned = topic
      .replace(/^(how to|what is|why|when|where)/i, '')
      .replace(/[^a-zA-Z0-9\s]/g, '')
      .trim()
      .split(/\s+/)
      .slice(0, 3)
      .join(' ')
      .toLowerCase();
    return cleaned || topic.toLowerCase();
  }

  /**
   * Counts words in text
   */
  private countWords(text: string): number {
    return text
      .replace(/```[\s\S]*?```/g, '') // Remove code blocks
      .replace(/`[^`]+`/g, '') // Remove inline code
      .replace(/[#*_~\[\]()]/g, '') // Remove markdown syntax
      .split(/\s+/)
      .filter(word => word.length > 0)
      .length;
  }

  /**
   * Extracts keywords from frontmatter and body
   */
  private extractKeywords(
    frontmatter: Record<string, unknown>,
    body: string,
    primaryKeyword: string,
    secondaryKeywords: string[]
  ): string[] {
    const keywords = new Set<string>();

    // Add primary keyword
    if (primaryKeyword) {
      keywords.add(primaryKeyword.toLowerCase());
    }

    // Add frontmatter keywords
    const fmKeywords = frontmatter.keywords as string[] | undefined;
    if (fmKeywords && Array.isArray(fmKeywords)) {
      fmKeywords.forEach(k => keywords.add(k.toLowerCase()));
    }

    // Add secondary keywords
    secondaryKeywords.forEach(k => keywords.add(k.toLowerCase()));

    return Array.from(keywords);
  }

  /**
   * Builds full MDX string from frontmatter and body
   */
  private buildFullMdx(frontmatter: DraftFrontmatter, body: string): string {
    const fm = frontmatter;
    
    const yaml = [
      '---',
      `title: "${fm.title}"`,
      `description: "${fm.description}"`,
      `publishDate: "${fm.publishDate}"`,
      `author: "${fm.author}"`,
      `category: "${fm.category}"`,
      `tags: [${fm.tags.map(t => `"${t}"`).join(', ')}]`,
      `excerpt: "${fm.excerpt}"`,
      `slug: "${fm.slug}"`,
      `readingTime: ${fm.readingTime}`,
      `status: "${fm.status}"`,
      `schemaType: "${fm.schemaType}"`,
      `keywords: [${fm.keywords.map(k => `"${k}"`).join(', ')}]`,
    ];

    if (fm.featuredImage) {
      yaml.push(`featuredImage: "${fm.featuredImage}"`);
    }
    if (fm.ctaText) {
      yaml.push(`ctaText: "${fm.ctaText}"`);
    }
    if (fm.ctaUrl) {
      yaml.push(`ctaUrl: "${fm.ctaUrl}"`);
    }

    yaml.push('---');

    return yaml.join('\n') + '\n\n' + body;
  }
}

export default DraftGenerator;
