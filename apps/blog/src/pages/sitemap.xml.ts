import type { CollectionEntry } from 'astro:content';
import type { APIContext } from 'astro';
import { ACTIVE_CONCEPT_KEY, CONCEPT_PAGE_STRUCTURE, SITE_URL, articlePath, authorPath, categoryPath } from '../consts';
import { getActiveAuthors, getActiveCategories, getPublishedMunicipalPages, getPublishedPosts } from '../lib/published-content';

interface SitemapPage {
  url: string;
  priority: number;
  lastMod?: Date;
}

export async function GET(_context: APIContext) {
  if (ACTIVE_CONCEPT_KEY === 'kommune' && CONCEPT_PAGE_STRUCTURE === 'directory') {
    const pages = await getPublishedMunicipalPages();
    const municipalPages: SitemapPage[] = pages.map((page: CollectionEntry<'municipalPages'>) => ({
      url: `${SITE_URL}/${page.slug}/`,
      lastMod: page.data.updatedDate || page.data.pubDate,
      priority: 0.8,
    }));

    const allPages: SitemapPage[] = [
      { url: SITE_URL, priority: 1.0 },
      ...municipalPages,
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

  const [posts, categories, authors] = await Promise.all([
    getPublishedPosts(),
    getActiveCategories(),
    getActiveAuthors(),
  ]);

  const postPages: SitemapPage[] = posts.map((post: CollectionEntry<'blog'>) => ({
    url: new URL(articlePath(post.slug), SITE_URL).href,
    lastMod: post.data.updatedDate || post.data.pubDate,
    priority: 0.8,
  }));

  const categoryPages: SitemapPage[] = categories.map((cat: CollectionEntry<'categories'>) => ({
    url: new URL(categoryPath(cat.slug), SITE_URL).href,
    priority: 0.6,
  }));

  const authorPages: SitemapPage[] = authors.map((author: CollectionEntry<'authors'>) => ({
    url: new URL(authorPath(author.slug), SITE_URL).href,
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
