import type { CollectionEntry } from 'astro:content';
import type { APIContext } from 'astro';
import { SITE_URL } from '../consts';
import { getActiveAuthors, getActiveCategories, getPublishedPosts } from '../lib/published-content';

interface SitemapPage {
  url: string;
  priority: number;
  lastMod?: Date;
}

export async function GET(_context: APIContext) {
  const [posts, categories, authors] = await Promise.all([
    getPublishedPosts(),
    getActiveCategories(),
    getActiveAuthors(),
  ]);

  const postPages: SitemapPage[] = posts.map((post: CollectionEntry<'blog'>) => ({
    url: `${SITE_URL}/blog/${post.slug}/`,
    lastMod: post.data.updatedDate || post.data.pubDate,
    priority: 0.8,
  }));

  const categoryPages: SitemapPage[] = categories.map((cat: CollectionEntry<'categories'>) => ({
    url: `${SITE_URL}/category/${cat.slug}/`,
    priority: 0.6,
  }));

  const authorPages: SitemapPage[] = authors.map((author: CollectionEntry<'authors'>) => ({
    url: `${SITE_URL}/author/${author.slug}/`,
    priority: 0.5,
  }));

  const allPages: SitemapPage[] = [
    { url: SITE_URL, priority: 1.0 },
    ...postPages,
    ...categoryPages,
    ...authorPages,
  ];
  
  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${allPages.map(page => `  <url>
    <loc>${page.url}</loc>
    ${page.lastMod ? `<lastmod>${new Date(page.lastMod).toISOString()}</lastmod>` : ''}
    ${page.priority ? `<priority>${page.priority}</priority>` : ''}
  </url>`).join('\n')}
</urlset>`;
  
  return new Response(sitemap, {
    headers: { 'Content-Type': 'application/xml' },
  });
}
