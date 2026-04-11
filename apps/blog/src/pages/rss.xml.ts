import rss from '@astrojs/rss';
import type { CollectionEntry } from 'astro:content';
import type { APIContext } from 'astro';
import { SITE_DESCRIPTION, SITE_LOCALE, SITE_NAME, articlePath } from '../consts';
import { getPublishedPosts } from '../lib/published-content';

export async function GET(context: APIContext) {
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
