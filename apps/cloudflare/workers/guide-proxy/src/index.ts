import { conceptRobotsTxt, conceptRssXml, conceptSitemapXml } from './generated/seo-artifacts';

interface Env {
  GUIDE_ORIGIN: string;
  AUTONOMOUS_DB: D1Database;
}

const GUIDE_PREFIX = '/guide';
const LEGACY_GUIDE_PREFIXES = ['/blog', '/category', '/author'];

function withSecurityHeaders(headers: Headers): Headers {
  const next = new Headers(headers);
  next.set('x-robots-tag', 'index, follow');
  next.set('x-content-type-options', 'nosniff');
  next.set('referrer-policy', 'strict-origin-when-cross-origin');
  return next;
}

function toOriginPath(pathname: string): string {
  if (pathname === GUIDE_PREFIX) return '/';
  if (pathname.startsWith(`${GUIDE_PREFIX}/`)) {
    const stripped = pathname.slice(GUIDE_PREFIX.length);
    return stripped || '/';
  }
  return pathname;
}

function buildUpstreamHeaders(request: Request): Headers {
  const headers = new Headers();
  const passthrough = [
    'accept',
    'accept-encoding',
    'accept-language',
    'cache-control',
    'content-type',
    'if-modified-since',
    'if-none-match',
    'user-agent',
  ];

  for (const name of passthrough) {
    const value = request.headers.get(name);
    if (value) headers.set(name, value);
  }

  return headers;
}

function responseWithBody(body: string, contentType: string): Response {
  return new Response(body, {
    headers: {
      'content-type': `${contentType}; charset=utf-8`,
      'cache-control': 'public, max-age=300',
      'x-content-type-options': 'nosniff',
      'x-robots-tag': 'index, follow',
    },
  });
}

function redirectToGuide(incomingUrl: URL): Response | null {
  if (incomingUrl.pathname === `${GUIDE_PREFIX}/`) {
    return Response.redirect(new URL(GUIDE_PREFIX, incomingUrl).toString(), 308);
  }

  if (incomingUrl.pathname === '/blog' || incomingUrl.pathname === '/blog/') {
    return Response.redirect(new URL(GUIDE_PREFIX, incomingUrl).toString(), 308);
  }

  for (const prefix of LEGACY_GUIDE_PREFIXES) {
    if (incomingUrl.pathname.startsWith(`${prefix}/`)) {
      return Response.redirect(new URL(`${GUIDE_PREFIX}${incomingUrl.pathname}${incomingUrl.search}`, incomingUrl).toString(), 308);
    }
  }

  return null;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const incomingUrl = new URL(request.url);

    const redirectResponse = redirectToGuide(incomingUrl);
    if (redirectResponse) {
      return redirectResponse;
    }

    if (incomingUrl.pathname === `${GUIDE_PREFIX}/rss.xml`) {
      const merged = await mergeRssXml(env.AUTONOMOUS_DB, conceptRssXml);
      return responseWithBody(merged, 'application/xml');
    }

    if (incomingUrl.pathname === `${GUIDE_PREFIX}/sitemap.xml`) {
      const merged = await mergeSitemapXml(env.AUTONOMOUS_DB, conceptSitemapXml);
      return responseWithBody(merged, 'application/xml');
    }

    if (incomingUrl.pathname === `${GUIDE_PREFIX}/robots.txt`) {
      return responseWithBody(conceptRobotsTxt, 'text/plain');
    }

    if (incomingUrl.pathname.startsWith(`${GUIDE_PREFIX}/preview/`)) {
      return new Response('Not Found', {
        status: 404,
        headers: {
          'cache-control': 'public, max-age=300',
          'content-type': 'text/plain; charset=utf-8',
          'x-content-type-options': 'nosniff',
          'x-robots-tag': 'noindex, nofollow',
        },
      });
    }

    const originPath = toOriginPath(incomingUrl.pathname);
    const targetUrl = new URL(originPath + incomingUrl.search, env.GUIDE_ORIGIN);
    const upstreamHeaders = buildUpstreamHeaders(request);

    const upstreamResponse = await fetch(targetUrl.toString(), {
      method: request.method,
      headers: upstreamHeaders,
      body: request.method === 'GET' || request.method === 'HEAD' ? undefined : request.body,
      redirect: 'manual',
    });

    const shouldCheckEdgeFallback =
      request.method === 'GET' &&
      (incomingUrl.pathname.startsWith(`${GUIDE_PREFIX}/blog/`) || incomingUrl.pathname.startsWith('/blog/'));
    if (shouldCheckEdgeFallback) {
      const edgeArtifact = await findEdgeArticle(env.AUTONOMOUS_DB, incomingUrl, request.url);
      if (edgeArtifact) {
        if (upstreamResponse.status === 404) {
          return responseWithEdgeArtifact(edgeArtifact.html_content, 'hit-404');
        }

        const contentType = upstreamResponse.headers.get('content-type') ?? '';
        if (contentType.includes('text/html')) {
          const html = await upstreamResponse.text();
          if (isSoftFallbackHtml(html, incomingUrl)) {
            return responseWithEdgeArtifact(edgeArtifact.html_content, 'hit-soft-fallback');
          }

          const headers = withSecurityHeaders(upstreamResponse.headers);
          headers.set('cache-control', headers.get('cache-control') ?? 'public, max-age=300');
          headers.set('x-emdash-edge-fallback', 'origin-html');
          return new Response(html, {
            status: upstreamResponse.status,
            statusText: upstreamResponse.statusText,
            headers,
          });
        }
      }
    }

    const headers = withSecurityHeaders(upstreamResponse.headers);
    headers.set('cache-control', headers.get('cache-control') ?? 'public, max-age=300');
    headers.set('x-emdash-edge-fallback', 'origin');

    return new Response(upstreamResponse.body, {
      status: upstreamResponse.status,
      statusText: upstreamResponse.statusText,
      headers,
    });
  },
};

function responseWithEdgeArtifact(html: string, mode: string): Response {
  return new Response(html, {
    status: 200,
    headers: {
      'content-type': 'text/html; charset=utf-8',
      'cache-control': 'public, max-age=300',
      'x-content-type-options': 'nosniff',
      'x-robots-tag': 'index, follow',
      'x-emdash-edge-fallback': mode,
    },
  });
}

async function findEdgeArticle(
  db: D1Database,
  incomingUrl: URL,
  requestUrl: string,
): Promise<{ html_content: string } | null> {
  const slug = extractSlugFromPath(incomingUrl.pathname);
  if (!slug) return null;

  return db
    .prepare(
      `
        SELECT html_content
        FROM publication_edge_artifacts
        WHERE slug = ?1
           OR url = ?2
        ORDER BY created_at DESC
        LIMIT 1
      `,
    )
    .bind(slug, requestUrl)
    .first<{ html_content: string }>();
}

function extractSlugFromPath(pathname: string): string | null {
  const normalized = pathname
    .replace(/^\/guide\/blog\//, '')
    .replace(/^\/blog\//, '')
    .replace(/\/$/, '');
  if (!normalized || normalized.includes('/')) return null;
  return normalized;
}

function isSoftFallbackHtml(html: string, incomingUrl: URL): boolean {
  const canonical =
    html.match(/<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)["']/i)?.[1]?.trim() ?? '';
  const requested = incomingUrl.toString();
  if (canonical && canonical !== requested) {
    return true;
  }

  const title = html.match(/<title[^>]*>(.*?)<\/title>/is)?.[1]?.replace(/\s+/g, ' ').trim() ?? '';
  return title === 'Kurs.ing Blogg';
}

async function mergeSitemapXml(db: D1Database, staticXml: string): Promise<string> {
  const edgeArticles = await listEdgeArticles(db);
  if (!edgeArticles.length) return staticXml;

  const existingEntries = [...staticXml.matchAll(/<url>([\s\S]*?)<\/url>/g)].map((match) => match[1] ?? '');
  const existingLocs = new Set([...staticXml.matchAll(/<loc>(.*?)<\/loc>/g)].map((match) => match[1]));
  const mergedEntries = [...existingEntries];

  for (const article of edgeArticles) {
    if (existingLocs.has(article.url)) continue;
    mergedEntries.push(`
    <loc>${article.url}</loc>
    <lastmod>${toIsoDateTime(article.created_at)}</lastmod>
    <priority>0.8</priority>
  `);
  }

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${mergedEntries.map((entry) => `  <url>${entry}</url>`).join('\n')}
</urlset>`;
}

async function mergeRssXml(db: D1Database, staticXml: string): Promise<string> {
  const edgeArticles = await listEdgeArticles(db);
  if (!edgeArticles.length) return staticXml;

  const existingItems = [...staticXml.matchAll(/<item>([\s\S]*?)<\/item>/g)].map((match) => match[1] ?? '');
  const existingLinks = new Set(
    [...staticXml.matchAll(/<item>[\s\S]*?<link>(.*?)<\/link>[\s\S]*?<\/item>/g)].map((match) => match[1]),
  );
  const mergedItems = [...existingItems];

  for (const article of edgeArticles) {
    if (existingLinks.has(article.url)) continue;
    mergedItems.push(
      `<title>${escapeXml(article.title)}</title><link>${article.url}</link><guid isPermaLink="true">${article.url}</guid><description>${escapeXml(article.description)}</description><pubDate>${new Date(article.created_at).toUTCString()}</pubDate>`,
    );
  }

  const channelPrefix = staticXml.split('<item>')[0];
  return `${channelPrefix}${mergedItems.map((item) => `<item>${item}</item>`).join('')}</channel></rss>`;
}

async function listEdgeArticles(
  db: D1Database,
): Promise<Array<{ slug: string; url: string; title: string; description: string; created_at: string }>> {
  const result = await db
    .prepare(
      `
        SELECT slug, url, title, description, created_at
        FROM publication_edge_artifacts
        ORDER BY created_at DESC
        LIMIT 50
      `,
    )
    .all<{ slug: string; url: string; title: string; description: string; created_at: string }>();

  return result.results;
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function toIsoDateTime(value: string): string {
  return new Date(value).toISOString();
}
