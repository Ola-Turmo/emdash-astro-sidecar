import { defineCollection, z, reference } from 'astro:content';

// Blog post collection schema
const blog = defineCollection({
  type: 'content',
  schema: z.object({
    title: z.string(),
    description: z.string(),
    pubDate: z.coerce.date(),
    updatedDate: z.coerce.date().optional(),
    author: reference('authors'),
    category: reference('categories'),
    tags: z.array(z.string()),
    featuredImage: z.object({
      src: z.string(),
      alt: z.string(),
    }).optional(),
    excerpt: z.string(),
    relatedPosts: z.array(reference('blog')).optional(),
    schemaType: z.enum(['Article', 'BlogPosting', 'TechArticle', 'HowTo', 'FAQPage']).default('BlogPosting'),
    draft: z.boolean().default(false),
  }),
});

// Author collection schema
const authors = defineCollection({
  type: 'content',
  schema: z.object({
    name: z.string(),
    bio: z.string(),
    avatar: z.object({
      src: z.string(),
      alt: z.string(),
    }).optional(),
    social: z.object({
      twitter: z.string().url().optional(),
      github: z.string().url().optional(),
      linkedin: z.string().url().optional(),
      website: z.string().url().optional(),
    }).optional(),
  }),
});

// Category collection schema
const categories = defineCollection({
  type: 'content',
  schema: z.object({
    name: z.string(),
    description: z.string(),
  }),
});

// Tag collection schema
const tags = defineCollection({
  type: 'data',
  schema: z.object({
    name: z.string(),
  }),
});

const docs = defineCollection({
  type: 'content',
});

const postsBak = defineCollection({
  type: 'content',
});

export const collections = {
  blog,
  authors,
  categories,
  tags,
  docs,
  'posts.bak': postsBak,
};
