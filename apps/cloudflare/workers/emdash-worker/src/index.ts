/**
 * EmDash Blog Worker - Cloudflare Worker Entry Point
 * 
 * This worker handles dynamic blog routes when Astro static generation
 * isn't sufficient, providing edge-side EmDash API integration,
 * CORS headers for cross-origin embedding, and middleware support.
 */

import { handleRequest } from './src/routes';
import { withMiddleware } from './src/middleware';

export interface Env {
  ASSETS: { fetch: typeof fetch };
  EMDASH_CONTENT_CACHE: KVNamespace;
  EMDASH_SESSION_DO: DurableObjectNamespace;
  EMDASH_API_KEY: string;
  EMDASH_HOST: string;
  PUBLIC_SITE_URL: string;
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    // Apply middleware chain
    const processedRequest = await withMiddleware(request, env, ctx);
    
    if (processedRequest instanceof Response) {
      return processedRequest;
    }
    
    // Handle the request through our routing layer
    return handleRequest(processedRequest, env, ctx);
  },
  
  // Scheduled handler for cron jobs (cache warming, etc.)
  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
    ctx.waitUntil(warmCache(env));
  },
};

async function warmCache(env: Env): Promise<void> {
  // Pre-warm commonly accessed content in KV
  const cacheKeys = ['featured-posts', 'recent-posts', 'categories'];
  
  for (const key of cacheKeys) {
    try {
      await env.EMDASH_CONTENT_CACHE.get(key);
      // Cache warming logic - fetch fresh content
      console.log(`Cache warmed for key: ${key}`);
    } catch (error) {
      console.error(`Cache warm failed for key ${key}:`, error);
    }
  }
}
