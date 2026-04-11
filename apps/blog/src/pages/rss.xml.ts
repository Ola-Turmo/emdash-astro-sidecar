import rss from '@astrojs/rss';
import type { CollectionEntry } from 'astro:content';
import type { APIContext } from 'astro';
import { ACTIVE_CONCEPT_KEY, CONCEPT_PAGE_STRUCTURE, SITE_DESCRIPTION, SITE_LOCALE, SITE_NAME, articlePath } from '../consts';
import { getPublishedMunicipalPages, getPublishedPosts } from '../lib/published-content';

export async function GET(context: APIContext) {
  if (ACTIVE_CONCEPT_KEY === 'kommune' && CONCEPT_PAGE_STRUCTURE === 'directory') {
    const pages = await getPublishedMunicipalPages();
    const sortedPages = pages.sort(
      (a: CollectionEntry<'municipalPages'>, b: CollectionEntry<'municipalPages'>) =>
        b.data.pubDate.valueOf() - a.data.pubDate.valueOf(),
    );

    return rss({
      title: SITE_NAME,
      description: SITE_DESCRIPTION,
      site: context.site!,
      items: sortedPages.map((page: CollectionEntry<'municipalPages'>) => ({
        title: page.data.title,
        pubDate: page.data.pubDate,
        description: page.data.description,
        link: `/${page.slug}/`,
      })),
      customData: `<language>${SITE_LOCALE.toLowerCase()}</language>`,
    });
  }

  const posts = await getPublishedPosts();
  const sortedPosts = posts.sort((a: CollectionEntry<'blog'>, b: CollectionEntry<'blog'>) => b.data.pubDate.valueOf() - a.data.pubDate.valueOf());
  
  return rss({
    title: SITE_NAME,
    description: SITE_DESCRIPTION,
    site: context.site!,
    items: sortedPosts.map((post: CollectionEntry<'blog'>) => ({
      title: post.data.title,
      pubDate: post.data.pubDate,
      description: post.data.excerpt,
      link: articlePath(post.slug),
    })),
    customData: `<language>${SITE_LOCALE.toLowerCase()}</language>`,
  });
}
