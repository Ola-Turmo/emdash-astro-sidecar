import { conceptRobotsTxt, conceptRssXml, conceptSitemapXml } from './generated/seo-artifacts';
import { applySecurityHeaders } from '../../shared/security-headers';
import { logEdgeRequestTelemetry } from '../../shared/request-telemetry';

interface Env {
  GUIDE_ORIGIN: string;
  AUTONOMOUS_DB: D1Database;
  METRICS_WORKER_URL: string;
}

const GUIDE_PREFIX = '/guide';
const GUIDE_RUM_PATH = `${GUIDE_PREFIX}/__rum`;

function withSecurityHeaders(headers: Headers): Headers {
  return applySecurityHeaders(headers);
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
  const headers = applySecurityHeaders(new Headers(), { indexable: true });
  headers.set('content-type', `${contentType}; charset=utf-8`);
  headers.set('cache-control', 'public, max-age=300');

  return new Response(body, {
    headers,
  });
}

function redirectToGuide(incomingUrl: URL): Response | null {
  if (incomingUrl.pathname === `${GUIDE_PREFIX}/`) {
    return Response.redirect(new URL(GUIDE_PREFIX, incomingUrl).toString(), 308);
  }

  return null;
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const incomingUrl = new URL(request.url);

    const redirectResponse = redirectToGuide(incomingUrl);
    if (redirectResponse) {
      ctx.waitUntil(
        logEdgeRequestTelemetry(env, {
          siteKey: 'kurs-ing',
          conceptKey: 'guide',
          request,
          statusCode: redirectResponse.status,
        }),
      );
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

    if (incomingUrl.pathname === GUIDE_RUM_PATH || incomingUrl.pathname === `${GUIDE_RUM_PATH}/`) {
      return proxyRumRequest(request, env.METRICS_WORKER_URL);
    }

    if (incomingUrl.pathname.startsWith(`${GUIDE_PREFIX}/preview/`)) {
      return new Response('Not Found', {
        status: 404,
        headers: (() => {
          const headers = applySecurityHeaders(new Headers(), { indexable: false });
          headers.set('cache-control', 'public, max-age=300');
          headers.set('content-type', 'text/plain; charset=utf-8');
          return headers;
        })(),
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
      incomingUrl.pathname.startsWith(`${GUIDE_PREFIX}/blog/`);
    if (shouldCheckEdgeFallback) {
      const edgeArtifact = await findEdgeArticle(env.AUTONOMOUS_DB, incomingUrl, request.url);
      if (edgeArtifact) {
        if (upstreamResponse.status === 404) {
          const response = responseWithEdgeArtifact(edgeArtifact.html_content, 'hit-404');
          ctx.waitUntil(
            logEdgeRequestTelemetry(env, {
              siteKey: 'kurs-ing',
              conceptKey: 'guide',
              request,
              statusCode: response.status,
            }),
          );
          return response;
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
          const response = new Response(html, {
            status: upstreamResponse.status,
            statusText: upstreamResponse.statusText,
            headers,
          });
          ctx.waitUntil(
            logEdgeRequestTelemetry(env, {
              siteKey: 'kurs-ing',
              conceptKey: 'guide',
              request,
              statusCode: response.status,
            }),
          );
          return response;
        }
      }
    }

    const headers = withSecurityHeaders(upstreamResponse.headers);
    headers.set('cache-control', headers.get('cache-control') ?? 'public, max-age=300');
    headers.set('x-emdash-edge-fallback', 'origin');

    const response = new Response(upstreamResponse.body, {
      status: upstreamResponse.status,
      statusText: upstreamResponse.statusText,
      headers,
    });
    ctx.waitUntil(
      logEdgeRequestTelemetry(env, {
        siteKey: 'kurs-ing',
        conceptKey: 'guide',
        request,
        statusCode: response.status,
      }),
    );
    return response;
  },
};

async function proxyRumRequest(request: Request, metricsWorkerUrl: string): Promise<Response> {
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'access-control-allow-origin': '*',
        'access-control-allow-methods': 'POST,OPTIONS',
        'access-control-allow-headers': 'content-type',
        'cache-control': 'no-store',
      },
    });
  }

  if (request.method !== 'POST') {
    return new Response('Method Not Allowed', {
      status: 405,
      headers: {
        'cache-control': 'no-store',
      },
    });
  }

  const targetUrl = new URL('/rum', metricsWorkerUrl);
  const upstreamResponse = await fetch(targetUrl.toString(), {
    method: 'POST',
    headers: {
      'content-type': request.headers.get('content-type') ?? 'application/json',
    },
    body: request.body,
  });

  return new Response(upstreamResponse.body, {
    status: upstreamResponse.status,
    statusText: upstreamResponse.statusText,
    headers: {
      'access-control-allow-origin': '*',
      'cache-control': 'no-store',
      'content-type': upstreamResponse.headers.get('content-type') ?? 'application/json; charset=utf-8',
    },
  });
}

function responseWithEdgeArtifact(html: string, mode: string): Response {
  const headers = applySecurityHeaders(new Headers(), { indexable: true });
  headers.set('content-type', 'text/html; charset=utf-8');
  headers.set('cache-control', 'public, max-age=300');
  headers.set('x-emdash-edge-fallback', mode);
  return new Response(html, {
    status: 200,
    headers,
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
