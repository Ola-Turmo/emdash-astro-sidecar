import rss from '@astrojs/rss';
import { getCollection } from 'astro:content';
import type { CollectionEntry } from 'astro:content';
import type { APIContext } from 'astro';
import { BLOG_BASE_PATH, SITE_DESCRIPTION, SITE_LOCALE, SITE_NAME } from '../consts';

export async function GET(context: APIContext) {
  const posts = await getCollection('blog', ({ data }: CollectionEntry<'blog'>) => !data.draft);
  const sortedPosts = posts.sort((a: CollectionEntry<'blog'>, b: CollectionEntry<'blog'>) => b.data.pubDate.valueOf() - a.data.pubDate.valueOf());
  
  return rss({
    title: SITE_NAME,
    description: SITE_DESCRIPTION,
    site: context.site!,
    items: sortedPosts.map((post: CollectionEntry<'blog'>) => ({
      title: post.data.title,
      pubDate: post.data.pubDate,
      description: post.data.excerpt,
      link: `${BLOG_BASE_PATH}/blog/${post.slug}/`,
    })),
    customData: `<language>${SITE_LOCALE.toLowerCase()}</language>`,
  });
}
