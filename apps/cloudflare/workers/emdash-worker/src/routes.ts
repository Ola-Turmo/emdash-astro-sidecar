/**
 * Route Definitions for EmDash Blog Worker
 * 
 * Handles dynamic routing for blog-specific routes that need
 * server-side rendering or API integration with EmDash CMS.
 */

import type { Env } from './index';

export interface RouteContext {
  path: string;
  params: Record<string, string>;
}

export const ROUTES = {
  // Blog API routes
  API_POSTS: '/api/posts',
  API_POST_BY_SLUG: '/api/posts/:slug',
  API_CATEGORIES: '/api/categories',
  API_TAGS: '/api/tags',
  
  // Preview routes (require auth)
  PREVIEW_POST: '/preview/:slug',
  PREVIEW_DRAFT: '/draft/:id',
  
  // Dynamic blog routes
  BLOG_POST: '/blog/:year/:month/:day/:slug',
  BLOG_CATEGORY: '/blog/category/:category',
  BLOG_TAG: '/blog/tag/:tag',
  BLOG_FEED: '/blog/feed/:format',
  BLOG_SITEMAP: '/blog/sitemap.xml',
  BLOG_RSS: '/blog/rss.xml',
  
  // Auth callback
  AUTH_CALLBACK: '/auth/callback',
  AUTH_LOGOUT: '/auth/logout',
} as const;

type RouteHandler = (request: Request, env: Env, ctx: ExecutionContext, params: Record<string, string>) => Promise<Response>;

/**
 * Route matcher - determines which handler to use based on the request path
 */
export async function handleRequest(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
  const url = new URL(request.url);
  const pathname = url.pathname;
  
  // Static assets - return 404 (Astro handles these in Pages)
  if (pathname.startsWith('/_assets') || pathname.startsWith('/_chunks') || pathname.startsWith('/_entries')) {
    return new Response('Not Found', { status: 404 });
  }
  
  // API Routes
  if (pathname.startsWith('/api/')) {
    return handleApiRoutes(request, env, ctx, pathname);
  }
  
  // Preview routes (protected)
  if (pathname.startsWith('/preview/') || pathname.startsWith('/draft/')) {
    return handlePreviewRoutes(request, env, ctx, pathname);
  }
  
  // Blog dynamic routes
  if (pathname.startsWith('/blog/')) {
    return handleBlogRoutes(request, env, ctx, pathname, url);
  }
  
  // Auth routes
  if (pathname.startsWith('/auth/')) {
    return handleAuthRoutes(request, env, ctx, pathname);
  }
  
  // Feed routes
  if (pathname.match(/^\/blog\/(feed|rss|sitemap)/)) {
    return handleFeedRoutes(request, env, ctx, pathname);
  }
  
  // No match - return not found
  return new Response(JSON.stringify({ error: 'Not Found' }), {
    status: 404,
    headers: { 'Content-Type': 'application/json' }
  });
}

async function handleApiRoutes(request: Request, env: Env, ctx: ExecutionContext, pathname: string): Promise<Response> {
  const method = request.method;
  
  switch (pathname) {
    case '/api/posts':
      if (method === 'GET') {
        return handleGetPosts(request, env, ctx);
      }
      break;
      
    case '/api/categories':
      if (method === 'GET') {
        return handleGetCategories(request, env, ctx);
      }
      break;
      
    case '/api/tags':
      if (method === 'GET') {
        return handleGetTags(request, env, ctx);
      }
      break;
  }
  
  // Handle dynamic API routes
  if (pathname.startsWith('/api/posts/')) {
    const slug = pathname.replace('/api/posts/', '');
    return handleGetPostBySlug(slug, request, env, ctx);
  }
  
  return jsonResponse({ error: 'API endpoint not found' }, 404);
}

async function handlePreviewRoutes(request: Request, env: Env, ctx: ExecutionContext, pathname: string): Promise<Response> {
  // Check for preview authentication using dedicated preview token
  const previewToken = request.headers.get('X-Preview-Token');
  const validToken = env.EMDASH_PREVIEW_TOKEN;
  
  if (!previewToken || !timingSafeEqual(previewToken, validToken)) {
    return jsonResponse({ error: 'Unauthorized' }, 401);
  }
  
  if (pathname.startsWith('/preview/')) {
    const slug = pathname.replace('/preview/', '');
    return handlePreviewPost(slug, env, ctx);
  }
  
  if (pathname.startsWith('/draft/')) {
    const draftId = pathname.replace('/draft/', '');
    return handlePreviewDraft(draftId, env, ctx);
  }
  
  return jsonResponse({ error: 'Preview not found' }, 404);
}

async function handleBlogRoutes(request: Request, env: Env, ctx: ExecutionContext, pathname: string, url: URL): Promise<Response> {
  // Rate limiting check - NOTE: This is an approximation since check-then-act is not atomic.
  // In production, use Workers KV atomic increment with a Lua script or use a Durable Object.
  const rateLimitKey = `rate_limit:${url.hostname}:${request.headers.get('CF-Connecting-IP')}`;
  const rateLimit = await env.EMDASH_CONTENT_CACHE.get(rateLimitKey);
  
  if (rateLimit) {
    const { count, windowStart } = JSON.parse(rateLimit);
    const windowMs = 60 * 1000; // 1 minute window
    
    if (Date.now() - windowStart < windowMs && count > 100) {
      return jsonResponse({ error: 'Rate limit exceeded' }, 429);
    }
  }
  
  // Parse date-based routes: /blog/2024/01/15/post-slug
  const dateMatch = pathname.match(/^\/blog\/(\d{4})\/(\d{2})\/(\d{2})\/(.+)$/);
  if (dateMatch) {
    const [, year, month, day, slug] = dateMatch;
    return handleBlogPostByDate(year, month, day, slug, env, ctx);
  }
  
  // Category routes
  const categoryMatch = pathname.match(/^\/blog\/category\/(.+)$/);
  if (categoryMatch) {
    const category = categoryMatch[1];
    return handleBlogCategory(category, env, ctx);
  }
  
  // Tag routes
  const tagMatch = pathname.match(/^\/blog\/tag\/(.+)$/);
  if (tagMatch) {
    const tag = tagMatch[1];
    return handleBlogTag(tag, env, ctx);
  }
  
  return jsonResponse({ error: 'Blog route not found' }, 404);
}

async function handleAuthRoutes(request: Request, env: Env, ctx: ExecutionContext, pathname: string): Promise<Response> {
  if (pathname === '/auth/callback') {
    // OAuth callback handling
    return handleAuthCallback(request, env, ctx);
  }
  
  if (pathname === '/auth/logout') {
    return handleAuthLogout(request, env, ctx);
  }
  
  return jsonResponse({ error: 'Auth route not found' }, 404);
}

async function handleFeedRoutes(request: Request, env: Env, ctx: ExecutionContext, pathname: string): Promise<Response> {
  if (pathname === '/blog/sitemap.xml') {
    return handleSitemap(env, ctx);
  }
  
  if (pathname === '/blog/rss.xml' || pathname === '/blog/feed/rss') {
    return handleRSS(env, ctx);
  }
  
  if (pathname === '/blog/feed/json') {
    return handleJSONFeed(env, ctx);
  }
  
  return jsonResponse({ error: 'Feed not found' }, 404);
}

// Handler implementations

async function handleGetPosts(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
  const url = new URL(request.url);
  const page = parseInt(url.searchParams.get('page') || '1');
  const limit = parseInt(url.searchParams.get('limit') || '10');
  
  try {
    // Fetch from EmDash API or KV cache
    const cached = await env.EMDASH_CONTENT_CACHE.get('posts:list');
    
    if (cached) {
      const posts = JSON.parse(cached);
      return jsonResponse({
        posts: posts.slice((page - 1) * limit, page * limit),
        total: posts.length,
        page,
        limit
      });
    }
    
    // Fallback to direct EmDash API call
    const response = await fetch(`${env.EMDASH_HOST}/api/v1/posts`, {
      headers: {
        'Authorization': `Bearer ${env.EMDASH_API_KEY}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (!response.ok) {
      throw new Error(`EmDash API error: ${response.status}`);
    }
    
    const posts = await response.json();
    
    // Cache for 5 minutes
    ctx.waitUntil(env.EMDASH_CONTENT_CACHE.put('posts:list', JSON.stringify(posts), { expirationTtl: 300 }));
    
    return jsonResponse({
      posts: posts.slice((page - 1) * limit, page * limit),
      total: posts.length,
      page,
      limit
    });
  } catch (error) {
    console.error('Error fetching posts:', error);
    return jsonResponse({ error: 'Failed to fetch posts' }, 500);
  }
}

async function handleGetPostBySlug(slug: string, request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
  try {
    const cacheKey = `post:${slug}`;
    const cached = await env.EMDASH_CONTENT_CACHE.get(cacheKey);
    
    if (cached) {
      return jsonResponse(JSON.parse(cached));
    }
    
    const response = await fetch(`${env.EMDASH_HOST}/api/v1/posts/${slug}`, {
      headers: {
        'Authorization': `Bearer ${env.EMDASH_API_KEY}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (!response.ok) {
      if (response.status === 404) {
        return jsonResponse({ error: 'Post not found' }, 404);
      }
      throw new Error(`EmDash API error: ${response.status}`);
    }
    
    const post = await response.json();
    
    // Cache for 10 minutes
    ctx.waitUntil(env.EMDASH_CONTENT_CACHE.put(cacheKey, JSON.stringify(post), { expirationTtl: 600 }));
    
    return jsonResponse(post);
  } catch (error) {
    console.error('Error fetching post:', error);
    return jsonResponse({ error: 'Failed to fetch post' }, 500);
  }
}

async function handleGetCategories(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
  try {
    const cached = await env.EMDASH_CONTENT_CACHE.get('categories:list');
    
    if (cached) {
      return jsonResponse(JSON.parse(cached));
    }
    
    const response = await fetch(`${env.EMDASH_HOST}/api/v1/categories`, {
      headers: {
        'Authorization': `Bearer ${env.EMDASH_API_KEY}`
      }
    });
    
    const categories = await response.json();
    
    ctx.waitUntil(env.EMDASH_CONTENT_CACHE.put('categories:list', JSON.stringify(categories), { expirationTtl: 3600 }));
    
    return jsonResponse(categories);
  } catch (error) {
    console.error('Error fetching categories:', error);
    return jsonResponse({ error: 'Failed to fetch categories' }, 500);
  }
}

async function handleGetTags(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
  try {
    const cached = await env.EMDASH_CONTENT_CACHE.get('tags:list');
    
    if (cached) {
      return jsonResponse(JSON.parse(cached));
    }
    
    const response = await fetch(`${env.EMDASH_HOST}/api/v1/tags`, {
      headers: {
        'Authorization': `Bearer ${env.EMDASH_API_KEY}`
      }
    });
    
    const tags = await response.json();
    
    ctx.waitUntil(env.EMDASH_CONTENT_CACHE.put('tags:list', JSON.stringify(tags), { expirationTtl: 3600 }));
    
    return jsonResponse(tags);
  } catch (error) {
    console.error('Error fetching tags:', error);
    return jsonResponse({ error: 'Failed to fetch tags' }, 500);
  }
}

async function handlePreviewPost(slug: string, env: Env, ctx: ExecutionContext): Promise<Response> {
  try {
    const response = await fetch(`${env.EMDASH_HOST}/api/v1/posts/${slug}/draft`, {
      headers: {
        'Authorization': `Bearer ${env.EMDASH_API_KEY}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (!response.ok) {
      return jsonResponse({ error: 'Draft not found' }, 404);
    }
    
    const draft = await response.json();
    return jsonResponse(draft);
  } catch (error) {
    console.error('Error fetching draft:', error);
    return jsonResponse({ error: 'Failed to fetch draft' }, 500);
  }
}

async function handlePreviewDraft(draftId: string, env: Env, ctx: ExecutionContext): Promise<Response> {
  try {
    const response = await fetch(`${env.EMDASH_HOST}/api/v1/drafts/${draftId}`, {
      headers: {
        'Authorization': `Bearer ${env.EMDASH_API_KEY}`
      }
    });
    
    if (!response.ok) {
      return jsonResponse({ error: 'Draft not found' }, 404);
    }
    
    const draft = await response.json();
    return jsonResponse(draft);
  } catch (error) {
    console.error('Error fetching draft:', error);
    return jsonResponse({ error: 'Failed to fetch draft' }, 500);
  }
}

async function handleBlogPostByDate(year: string, month: string, day: string, slug: string, env: Env, ctx: ExecutionContext): Promise<Response> {
  // Redirect to canonical URL or fetch by date-specific slug
  const fullSlug = `${year}/${month}/${day}/${slug}`;
  
  try {
    const response = await fetch(`${env.EMDASH_HOST}/api/v1/posts/by-date/${year}/${month}/${day}/${slug}`, {
      headers: {
        'Authorization': `Bearer ${env.EMDASH_API_KEY}`
      }
    });
    
    if (response.ok) {
      const post = await response.json();
      return jsonResponse(post);
    }
    
    return jsonResponse({ error: 'Post not found' }, 404);
  } catch (error) {
    console.error('Error fetching post by date:', error);
    return jsonResponse({ error: 'Failed to fetch post' }, 500);
  }
}

async function handleBlogCategory(category: string, env: Env, ctx: ExecutionContext): Promise<Response> {
  try {
    const response = await fetch(`${env.EMDASH_HOST}/api/v1/posts?category=${category}`, {
      headers: {
        'Authorization': `Bearer ${env.EMDASH_API_KEY}`
      }
    });
    
    const posts = await response.json();
    return jsonResponse({ category, posts });
  } catch (error) {
    console.error('Error fetching category:', error);
    return jsonResponse({ error: 'Failed to fetch category posts' }, 500);
  }
}

async function handleBlogTag(tag: string, env: Env, ctx: ExecutionContext): Promise<Response> {
  try {
    const response = await fetch(`${env.EMDASH_HOST}/api/v1/posts?tag=${tag}`, {
      headers: {
        'Authorization': `Bearer ${env.EMDASH_API_KEY}`
      }
    });
    
    const posts = await response.json();
    return jsonResponse({ tag, posts });
  } catch (error) {
    console.error('Error fetching tag:', error);
    return jsonResponse({ error: 'Failed to fetch tag posts' }, 500);
  }
}

async function handleAuthCallback(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  
  if (!code) {
    return jsonResponse({ error: 'Missing auth code' }, 400);
  }
  
  try {
    const response = await fetch(`${env.EMDASH_HOST}/api/v1/auth/callback`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ code, state })
    });
    
    const tokens = await response.json();
    
    // Create session using Durable Object
    return jsonResponse({
      success: true,
      redirectTo: state || '/'
    });
  } catch (error) {
    console.error('Auth callback error:', error);
    return jsonResponse({ error: 'Authentication failed' }, 500);
  }
}

async function handleAuthLogout(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
  return jsonResponse({ success: true, redirectTo: '/' });
}

async function handleSitemap(env: Env, ctx: ExecutionContext): Promise<Response> {
  const cached = await env.EMDASH_CONTENT_CACHE.get('sitemap');
  
  if (cached) {
    return new Response(cached, {
      headers: {
        'Content-Type': 'application/xml',
        'Cache-Control': 'public, max-age=3600'
      }
    });
  }
  
  // Generate basic sitemap
  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>${env.PUBLIC_SITE_URL}/</loc>
    <changefreq>daily</changefreq>
    <priority>1.0</priority>
  </url>
</urlset>`;
  
  return new Response(sitemap, {
    headers: {
      'Content-Type': 'application/xml',
      'Cache-Control': 'public, max-age=3600'
    }
  });
}

async function handleRSS(env: Env, ctx: ExecutionContext): Promise<Response> {
  const cached = await env.EMDASH_CONTENT_CACHE.get('rss');
  
  if (cached) {
    return new Response(cached, {
      headers: {
        'Content-Type': 'application/xml',
        'Cache-Control': 'public, max-age=3600'
      }
    });
  }
  
  const rss = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>EmDash Blog</title>
    <link>${env.PUBLIC_SITE_URL}</link>
    <description>Blog posts from EmDash</description>
  </channel>
</rss>`;
  
  return new Response(rss, {
    headers: {
      'Content-Type': 'application/xml',
      'Cache-Control': 'public, max-age=3600'
    }
  });
}

async function handleJSONFeed(env: Env, ctx: ExecutionContext): Promise<Response> {
  const jsonFeed = {
    version: 'https://jsonfeed.org/version/1',
    title: 'EmDash Blog',
    home_page_url: env.PUBLIC_SITE_URL,
    feed_url: `${env.PUBLIC_SITE_URL}/blog/feed/json`
  };
  
  return jsonResponse(jsonFeed);
}

// Utility functions

/**
 * Constant-time string comparison to prevent timing attacks
 */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json'
    }
  });
}
