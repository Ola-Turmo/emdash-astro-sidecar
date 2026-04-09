import type { CollectionEntry } from 'astro:content';
import { MAIN_SITE_URL, SITE_LOCALE, SITE_NAME, SITE_URL } from '../consts';

export interface SeoConfig {
  title: string;
  description: string;
  url: string;
  ogImage?: string;
  ogType?: 'website' | 'article';
  pubDate?: Date;
  updatedDate?: Date;
  author?: string;
  tags?: string[];
  schemaType?: string;
}

export function generateCanonicalUrl(path: string, baseUrl = SITE_URL): string {
  return `${baseUrl}${path.replace(/\/$/, '')}`;
}

export function generateOgTags(config: SeoConfig): Record<string, string> {
  const { title, description, url, ogImage, ogType, pubDate, updatedDate, author, tags } = config;
  const image = ogImage || `${MAIN_SITE_URL}/images/etablerer_hero.png`;

  return {
    'og:title': title,
    'og:description': description,
    'og:url': url,
    'og:image': image,
    'og:type': ogType || 'website',
    'og:site_name': SITE_NAME,
    'og:locale': SITE_LOCALE.replace('-', '_'),
    ...(pubDate && { 'article:published_time': pubDate.toISOString() }),
    ...(updatedDate && { 'article:modified_time': updatedDate.toISOString() }),
    ...(author && { 'article:author': author }),
    ...(tags && tags[0] && { 'article:tag': tags[0] }),
  };
}

export function generateTwitterCard(config: SeoConfig): Record<string, string> {
  const { title, description, ogImage } = config;

  return {
    'twitter:card': 'summary_large_image',
    'twitter:title': title,
    'twitter:description': description,
    'twitter:image': ogImage || `${MAIN_SITE_URL}/images/etablerer_hero.png`,
  };
}

export function generateBreadcrumbJsonLd(items: { name: string; url: string }[]): string {
  return JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: item.url,
    })),
  });
}

export function generateArticleJsonLd(config: SeoConfig): string {
  const { title, description, url, ogImage, pubDate, updatedDate, author, schemaType } = config;

  return JSON.stringify({
    '@context': 'https://schema.org',
    '@type': schemaType || 'Article',
    headline: title,
    description,
    url,
    image: ogImage ? [ogImage] : [`${MAIN_SITE_URL}/images/etablerer_hero.png`],
    datePublished: pubDate?.toISOString(),
    dateModified: (updatedDate || pubDate)?.toISOString(),
    author: {
      '@type': 'Person',
      name: author || 'Kurs.ing',
      url: `${SITE_URL}/author/ola-turmo/`,
    },
    publisher: {
      '@type': 'Organization',
      name: 'Kurs.ing',
      logo: {
        '@type': 'ImageObject',
        url: `${MAIN_SITE_URL}/favicon.svg`,
      },
    },
    mainEntityOfPage: {
      '@type': 'WebPage',
      '@id': url,
    },
  });
}

export function generateFaqJsonLd(faqs: { question: string; answer: string }[]): string {
  return JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqs.map((faq) => ({
      '@type': 'Question',
      name: faq.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: faq.answer,
      },
    })),
  });
}

export function generatePersonJsonLd(author: CollectionEntry<'authors'>): string {
  return JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'Person',
    name: author.data.name,
    description: author.data.bio,
    ...(author.data.social?.website && { url: author.data.social.website }),
    ...(author.data.social?.twitter && { sameAs: [author.data.social.twitter] }),
  });
}

export function generateItemListJsonLd(items: { name: string; url: string }[]): string {
  return JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      url: item.url,
      name: item.name,
    })),
    numberOfItems: items.length,
  });
}

export function generateSeoMeta(config: SeoConfig): { meta: Record<string, string>; jsonLd: string[] } {
  const canonical = config.url;
  const ogTags = generateOgTags({ ...config, url: canonical });
  const twitterTags = generateTwitterCard(config);
  const jsonLd = [generateBreadcrumbJsonLd([{ name: SITE_NAME, url: SITE_URL }, { name: config.title, url: config.url }])];

  if (config.schemaType === 'Article' || config.schemaType === 'BlogPosting' || config.schemaType === 'TechArticle') {
    jsonLd.push(generateArticleJsonLd(config));
  }

  return {
    meta: {
      canonical,
      ...ogTags,
      ...twitterTags,
    },
    jsonLd,
  };
}
