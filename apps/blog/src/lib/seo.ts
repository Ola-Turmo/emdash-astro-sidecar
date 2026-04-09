import type { CollectionEntry } from 'astro:content';

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

/**
 * Generate canonical URL
 */
export function generateCanonicalUrl(path: string, baseUrl = 'https://blog.emdash.dev'): string {
  return `${baseUrl}${path.replace(/\/$/, '')}`;
}

/**
 * Generate Open Graph meta tags
 */
export function generateOgTags(config: SeoConfig): Record<string, string> {
  const { title, description, url, ogImage, ogType, pubDate, updatedDate, author, tags } = config;
  const image = ogImage || `${url}/images/og-default.png`;
  
  return {
    'og:title': title,
    'og:description': description,
    'og:url': url,
    'og:image': image,
    'og:type': ogType || 'website',
    'og:site_name': 'EmDash Blog',
    'og:locale': 'en_US',
    ...(pubDate && { 'article:published_time': pubDate.toISOString() }),
    ...(updatedDate && { 'article:modified_time': updatedDate.toISOString() }),
    ...(author && { 'article:author': author }),
    ...(tags && tags[0] && { 'article:tag': tags[0] }),
  };
}

/**
 * Generate Twitter Card meta tags
 */
export function generateTwitterCard(config: SeoConfig): Record<string, string> {
  const { title, description, ogImage } = config;
  
  return {
    'twitter:card': 'summary_large_image',
    'twitter:title': title,
    'twitter:description': description,
    'twitter:image': ogImage || '/images/og-default.png',
  };
}

/**
 * Generate BreadcrumbList JSON-LD
 */
export function generateBreadcrumbJsonLd(items: { name: string; url: string }[]): string {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: item.url,
    })),
  };
  
  return JSON.stringify(jsonLd);
}

/**
 * Generate Article JSON-LD for structured data
 */
export function generateArticleJsonLd(config: SeoConfig): string {
  const { title, description, url, ogImage, pubDate, updatedDate, author, schemaType } = config;
  
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': schemaType || 'Article',
    headline: title,
    description,
    url,
    image: ogImage ? [ogImage] : undefined,
    datePublished: pubDate?.toISOString(),
    dateModified: (updatedDate || pubDate)?.toISOString(),
    author: {
      '@type': 'Person',
      name: author || 'Editorial Team',
      url: `${url}/author/editor`,
    },
    publisher: {
      '@type': 'Organization',
      name: 'EmDash',
      logo: {
        '@type': 'ImageObject',
        url: 'https://blog.emdash.dev/images/logo.png',
      },
    },
    mainEntityOfPage: {
      '@type': 'WebPage',
      '@id': url,
    },
  };
  
  return JSON.stringify(jsonLd);
}

/**
 * Generate FAQPage JSON-LD
 */
export function generateFaqJsonLd(faqs: { question: string; answer: string }[]): string {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqs.map(faq => ({
      '@type': 'Question',
      name: faq.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: faq.answer,
      },
    })),
  };
  
  return JSON.stringify(jsonLd);
}

/**
 * Generate Person JSON-LD for author pages
 */
export function generatePersonJsonLd(author: CollectionEntry<'authors'>): string {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Person',
    name: author.data.name,
    description: author.data.bio,
    ...(author.data.social?.website && { url: author.data.social.website }),
    ...(author.data.social?.twitter && { sameAs: [author.data.social.twitter] }),
  };
  
  return JSON.stringify(jsonLd);
}

/**
 * Generate ItemList JSON-LD for category/tag archives
 */
export function generateItemListJsonLd(items: { name: string; url: string }[], listType: 'Category' | 'Tag'): string {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      url: item.url,
      name: item.name,
    })),
    numberOfItems: items.length,
    ...(listType === 'Category' && { '@type': 'BreadcrumbList' }),
  };
  
  return JSON.stringify(jsonLd);
}

/**
 * Generate complete SEO head meta tags
 */
export function generateSeoMeta(config: SeoConfig): { meta: Record<string, string>; jsonLd: string[] } {
  const canonical = config.url;
  const ogTags = generateOgTags({ ...config, url: canonical });
  const twitterTags = generateTwitterCard(config);
  
  const jsonLdScripts: string[] = [];
  
  if (config.schemaType === 'Article' || config.schemaType === 'BlogPosting' || config.schemaType === 'TechArticle') {
    jsonLdScripts.push(generateArticleJsonLd(config));
  }
  
  jsonLdScripts.push(generateBreadcrumbJsonLd([
    { name: 'Home', url: 'https://blog.emdash.dev' },
    { name: config.title, url: config.url },
  ]));
  
  const meta: Record<string, string> = {
    canonical,
    ...ogTags,
    ...twitterTags,
  };
  
  return { meta, jsonLd: jsonLdScripts };
}