import { getCollection } from 'astro:content';
import type { CollectionEntry } from 'astro:content';

export async function getPublishedPosts(): Promise<CollectionEntry<'blog'>[]> {
  return getCollection('blog', ({ data }: CollectionEntry<'blog'>) => !data.draft);
}

export function getPostCategorySlug(post: CollectionEntry<'blog'>): string | null {
  const category = post.data.category;
  if (!category) return null;
  if (typeof category === 'object') {
    return 'slug' in category ? category.slug : category.id;
  }
  return category;
}

export function getPostAuthorSlug(post: CollectionEntry<'blog'>): string | null {
  const author = post.data.author;
  if (!author) return null;
  if (typeof author === 'object') {
    return 'slug' in author ? author.slug : author.id;
  }
  return author;
}

export async function getActiveCategories(): Promise<CollectionEntry<'categories'>[]> {
  const [categories, posts] = await Promise.all([
    getCollection('categories'),
    getPublishedPosts(),
  ]);

  const activeCategorySlugs = new Set(
    posts
      .map((post) => getPostCategorySlug(post))
      .filter((slug): slug is string => Boolean(slug)),
  );

  return categories.filter((category: CollectionEntry<'categories'>) => activeCategorySlugs.has(category.slug));
}

export async function getActiveAuthors(): Promise<CollectionEntry<'authors'>[]> {
  const [authors, posts] = await Promise.all([
    getCollection('authors'),
    getPublishedPosts(),
  ]);

  const activeAuthorSlugs = new Set(
    posts
      .map((post) => getPostAuthorSlug(post))
      .filter((slug): slug is string => Boolean(slug)),
  );

  return authors.filter((author: CollectionEntry<'authors'>) => activeAuthorSlugs.has(author.slug) || activeAuthorSlugs.has(author.id));
}
