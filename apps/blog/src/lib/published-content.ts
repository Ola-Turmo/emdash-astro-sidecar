import { getCollection } from 'astro:content';
import type { CollectionEntry } from 'astro:content';
import { ACTIVE_CONCEPT_KEY, ACTIVE_SITE_KEY } from '../consts';

function isActiveScopedEntry(
  data: { siteKey?: string; conceptKey?: string; draft?: boolean },
): boolean {
  const siteMatches = !data.siteKey || data.siteKey === ACTIVE_SITE_KEY;
  const conceptMatches = !data.conceptKey || data.conceptKey === ACTIVE_CONCEPT_KEY;
  return siteMatches && conceptMatches;
}

export async function getPublishedPosts(): Promise<CollectionEntry<'blog'>[]> {
  return getCollection(
    'blog',
    ({ data }: CollectionEntry<'blog'>) => !data.draft && isActiveScopedEntry(data),
  );
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

  return categories.filter(
    (category: CollectionEntry<'categories'>) =>
      isActiveScopedEntry(category.data) && activeCategorySlugs.has(category.slug),
  );
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

  return authors.filter(
    (author: CollectionEntry<'authors'>) =>
      isActiveScopedEntry(author.data) &&
      (activeAuthorSlugs.has(author.slug) || activeAuthorSlugs.has(author.id)),
  );
}

export async function getPublishedMunicipalPages(): Promise<CollectionEntry<'municipalPages'>[]> {
  return getCollection(
    'municipalPages',
    ({ data }: CollectionEntry<'municipalPages'>) => !data.draft && isActiveScopedEntry(data),
  );
}
