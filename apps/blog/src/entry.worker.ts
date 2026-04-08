/**
 * Cloudflare Pages with Edge Rendering - Worker Entry Point
 * 
 * This file serves as the SSR entry point when Astro uses hybrid rendering
 * with Cloudflare Pages. It handles dynamic blog routes with content
 * fetched from EmDash API at the edge.
 * 
 * Usage in astro.config.mjs:
 *   export default defineConfig({
 *     output: 'hybrid',
 *     adapter: cloudflare({
 *       worker: true,
 *       mode: 'directory'
 *     })
 *   });
 */

import { handleRequest } from './src/routes';

export default {
  async fetch(request: Request, env: any, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    
    // Only handle dynamic routes that need SSR
    if (shouldHandleSSR(url.pathname)) {
      return handleRequest(request, env, ctx);
    }
    
    // Let Cloudflare Pages serve static assets
    return env.ASSETS.fetch(request);
  },
};

function shouldHandleSSR(pathname: string): boolean {
  const ssrPaths = [
    '/api/',
    '/preview/',
    '/draft/',
    '/auth/',
    '/blog/feed/',
  ];
  
  return ssrPaths.some(path => pathname.startsWith(path));
}
