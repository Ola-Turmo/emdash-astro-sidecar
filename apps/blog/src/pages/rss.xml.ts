import rss from '@astrojs/rss';
import { getCollection } from 'astro:content';
import type { CollectionEntry } from 'astro:content';
import type { APIContext } from 'astro';

export async function GET(context: APIContext) {
  const posts = await getCollection('blog', ({ data }: CollectionEntry<'blog'>) => !data.draft);
  const sortedPosts = posts.sort((a: CollectionEntry<'blog'>, b: CollectionEntry<'blog'>) => b.data.pubDate.valueOf() - a.data.pubDate.valueOf());
  
  return rss({
    title: 'EmDash Blog',
    description: 'Thoughtful articles on web development, design systems, and AI-assisted workflows.',
    site: context.site!,
    items: sortedPosts.map((post: CollectionEntry<'blog'>) => ({
      title: post.data.title,
      pubDate: post.data.pubDate,
      description: post.data.excerpt,
      link: `/blog/${post.slug}/`,
    })),
    customData: '<language>en-us</language>',
  });
}
