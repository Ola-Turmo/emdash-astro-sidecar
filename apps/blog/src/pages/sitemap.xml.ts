import { getCollection } from 'astro:content';
import type { CollectionEntry } from 'astro:content';
import type { APIContext } from 'astro';
import { SITE_URL } from '../consts';

export async function GET(context: APIContext) {
  const posts = await getCollection('blog', ({ data }: CollectionEntry<'blog'>) => !data.draft);
  const categories = await getCollection('categories');
  const authors = await getCollection('authors');
  
  const postPages = posts.map((post: CollectionEntry<'blog'>) => ({
    url: `${SITE_URL}/blog/${post.slug}/`,
    lastMod: post.data.updatedDate || post.data.pubDate,
    priority: 0.8,
  }));
  
  const categoryPages = categories.map((cat: CollectionEntry<'categories'>) => ({
    url: `${SITE_URL}/category/${cat.data.slug}/`,
    priority: 0.6,
  }));
  
  const authorPages = authors.map((author: CollectionEntry<'authors'>) => ({
    url: `${SITE_URL}/author/${author.id}/`,
    priority: 0.5,
  }));
  
  const allPages = [
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
