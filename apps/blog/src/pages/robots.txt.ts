import type { APIContext } from 'astro';
import { SITE_URL } from '../consts';

export async function GET(_context: APIContext) {
  const robots = `User-agent: *
Allow: /
Disallow: /api/
Disallow: /_astro/
Disallow: /admin/

User-agent: GPTBot
Allow: /blog/
Allow: /docs/
Allow: /features/
Allow: /pricing/
Allow: /about/
Disallow: /admin/
Disallow: /checkout/

User-agent: Google-Extended
Allow: /

User-agent: anthropic-ai
Allow: /blog/
Allow: /docs/
Allow: /features/
Allow: /pricing/
Allow: /about/

User-agent: ClaudeBot
Allow: /blog/
Allow: /docs/
Allow: /features/
Allow: /pricing/
Allow: /about/

User-agent: CCBot
Allow: /blog/
Allow: /docs/
Allow: /features/
Allow: /pricing/
Allow: /about/

User-agent: PerplexityBot
Allow: /blog/
Allow: /docs/
Allow: /features/
Allow: /pricing/
Allow: /about/

User-agent: BingPreview
Allow: /

User-agent: Copilot
Allow: /

Sitemap: ${SITE_URL}/sitemap-index.xml
`;

  return new Response(robots, {
    headers: { 'Content-Type': 'text/plain' },
  });
}
