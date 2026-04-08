import type { APIContext } from 'astro';
import { SITE_URL } from '../consts';

export async function GET(_context: APIContext) {
  const robots = `User-agent: *
Allow: /

Sitemap: ${SITE_URL}/sitemap.xml
`;
  
  return new Response(robots, {
    headers: { 'Content-Type': 'text/plain' },
  });
}
