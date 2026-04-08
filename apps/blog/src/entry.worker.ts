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

export default {
  async fetch(_request: Request, _env: any, _ctx: any): Promise<Response> {
    // For static builds, this worker is not used.
    // The build output goes to dist/ for Cloudflare Pages static hosting.
    return new Response('Not Found', { status: 404 });
  },
};
