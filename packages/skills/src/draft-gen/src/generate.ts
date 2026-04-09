export interface ContentGenInput {
  topic: string;
  audience: string;
  tone: 'professional' | 'conversational' | 'technical' | 'casual';
  targetKeywords: string[];
  internalLinks?: { url: string; anchor: string }[];
  cta?: { text: string; url: string };
  schemaType: 'Article' | 'TechArticle' | 'BlogPosting' | 'HowTo' | 'FAQPage';
  articleStructure?: 'listicle' | 'tutorial' | 'comparison' | 'case-study' | 'standard';
}

export interface GeneratedContent {
  frontmatter: {
    title: string;
    description: string;
    pubDate: string;
    author: string;
    category: string;
    tags: string[];
    featuredImage: { src: string; alt: string };
    excerpt: string;
    schemaType: string;
    draft: boolean;
  };
  content: string;
  wordCount: number;
  suggestedInternalLinks: { url: string; anchor: string }[];
  faqCount: number;
}

/**
 * Generate a slug from topic
 */
function generateSlug(topic: string): string {
  return topic
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .slice(0, 50);
}

/**
 * Generate current date in ISO format
 */
function getCurrentDate(): string {
  return new Date().toISOString().split('T')[0];
}

/**
 * Generate MDX frontmatter
 */
function generateFrontmatter(input: ContentGenInput, title: string, excerpt: string): string {
  const slug = generateSlug(input.topic);
  const frontmatter = {
    title,
    description: excerpt.slice(0, 160),
    pubDate: getCurrentDate(),
    author: 'editor',
    category: 'tutorials',
    tags: input.targetKeywords.slice(0, 3),
    featuredImage: {
      src: `/images/blog/${slug}.jpg`,
      alt: title,
    },
    excerpt: excerpt.slice(0, 160),
    schemaType: input.schemaType,
    draft: true,
  };
  
  return `---
title: "${title}"
description: "${frontmatter.description}"
pubDate: ${frontmatter.pubDate}
author: ${frontmatter.author}
category: ${frontmatter.category}
tags: [${frontmatter.tags.map(t => `"${t}"`).join(', ')}]
featuredImage:
  src: "${frontmatter.featuredImage.src}"
  alt: "${frontmatter.featuredImage.alt}"
excerpt: "${frontmatter.excerpt}"
schemaType: ${frontmatter.schemaType}
draft: ${frontmatter.draft}
---`;
}

/**
 * Generate article content sections
 */
function generateContent(input: ContentGenInput, title: string): string {
  const sections: string[] = [];
  
  // Introduction
  sections.push(`# ${title}\n`);
  sections.push(`<!-- summary: This article covers ${input.topic} for ${input.audience} -->\n`);
  sections.push(`## Introduction\n`);
  sections.push(`This ${input.articleStructure || 'article'} will explore ${input.topic} in depth. `);
  sections.push(`Whether you're ${input.audience} looking to improve your skills or just getting started, `);
  sections.push(`this guide covers everything you need to know.\n`);
  
  // Based on structure
  switch (input.articleStructure) {
    case 'listicle':
      sections.push(`## Key Points\n`);
      for (let i = 1; i <= 5; i++) {
        sections.push(`### ${i}. ${input.targetKeywords[i % input.targetKeywords.length] || 'Important Point'}\n`);
        sections.push(`Detailed content about point ${i}.\n`);
      }
      break;
    case 'tutorial':
      sections.push(`## Prerequisites\n`);
      sections.push(`Before getting started, make sure you have:\n`);
      sections.push(`- Basic understanding of the concepts\n`);
      sections.push(`- Required tools installed\n\n`);
      sections.push(`## Step 1: Getting Started\n`);
      sections.push(`First, let's begin with the basics.\n\n`);
      sections.push(`## Step 2: Building\n`);
      sections.push(`Now let's apply what you've learned.\n\n`);
      sections.push(`<!-- callout:tip:Pro Tip: Take your time with each step -->\n`);
      break;
    case 'comparison':
      sections.push(`## Overview\n`);
      sections.push(`Let's compare the different approaches to ${input.topic}.\n\n`);
      sections.push(`## Option A\n`);
      sections.push(`Details about option A.\n\n`);
      sections.push(`## Option B\n`);
      sections.push(`Details about option B.\n\n`);
      sections.push(`<!-- callout:info:Recommendation: Consider your specific use case -->\n`);
      break;
    default:
      sections.push(`## Background\n`);
      sections.push(`Understanding the context behind ${input.topic} is essential.\n\n`);
      sections.push(`## Main Content\n`);
      sections.push(`Let's dive into the core concepts.\n\n`);
      sections.push(`## Best Practices\n`);
      sections.push(`Following established patterns will help you succeed.\n\n`);
  }
  
  // FAQ section for FAQPage schema
  if (input.schemaType === 'FAQPage') {
    sections.push(`## Frequently Asked Questions\n`);
    sections.push(`<!-- faq:What is ${input.topic}?: A comprehensive overview of the topic -->\n`);
    sections.push(`<!-- faq:How do I get started?: Step-by-step instructions for beginners -->\n`);
    sections.push(`<!-- faq:What are the best practices?: Industry-standard recommendations -->\n`);
  }
  
  // Callout sections
  sections.push(`<!-- callout:warning:Important: Keep these considerations in mind -->\n`);
  
  // Conclusion
  sections.push(`## Conclusion\n`);
  sections.push(`This article covered the essential aspects of ${input.topic}. `);
  sections.push(`Key takeaways include understanding the fundamentals and applying best practices. `);
  if (input.cta) {
    sections.push(`For more information, see our ${input.cta.text}.\n`);
  }
  
  return sections.join('');
}

/**
 * Main generation function
 */
export async function generateDraft(input: ContentGenInput): Promise<GeneratedContent> {
  // Generate title from topic
  const title = `${input.topic}: A ${input.articleStructure === 'tutorial' ? 'Complete Guide' : 'Introduction'}`;
  
  // Generate excerpt
  const excerpt = `This comprehensive guide explores ${input.topic} for ${input.audience}. ` +
    `Learn best practices, common pitfalls, and proven strategies for success. ` +
    `Perfect for anyone looking to improve their understanding and implementation.`;
  
  // Generate frontmatter
  const frontmatter = generateFrontmatter(input, title, excerpt);
  
  // Generate content
  const content = generateContent(input, title);
  
  // Generate word count estimate
  const wordCount = content.split(/\s+/).length + title.split(/\s+/).length;
  
  // Generate suggested internal links
  const suggestedInternalLinks = input.internalLinks || [
    { url: '/category/tutorials', anchor: 'Related Tutorials' },
    { url: '/category/strategy', anchor: 'Strategy Guides' },
  ];
  
  return {
    frontmatter: {
      title,
      description: excerpt.slice(0, 160),
      pubDate: getCurrentDate(),
      author: 'editor',
      category: 'tutorials',
      tags: input.targetKeywords.slice(0, 3),
      featuredImage: {
        src: `/images/blog/${generateSlug(input.topic)}.jpg`,
        alt: title,
      },
      excerpt: excerpt.slice(0, 160),
      schemaType: input.schemaType,
      draft: true,
    },
    content: `${frontmatter}\n\n${content}`,
    wordCount,
    suggestedInternalLinks,
    faqCount: input.schemaType === 'FAQPage' ? 3 : 0,
  };
}