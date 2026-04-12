import { conceptRobotsTxt, conceptRssXml, conceptSitemapXml } from './generated/seo-artifacts';

interface Env {
  KOMMUNE_ORIGIN: string;
}

const PREFIX = '/kommune';
const ALLOWED_PATHS = new Set(
  [...conceptSitemapXml.matchAll(/<loc>https:\/\/www\.kurs\.ing(\/kommune(?:\/[^<]*)?)<\/loc>/g)].map((match) =>
    normalizeConceptPath(match[1] || PREFIX),
  ),
);

function withSecurityHeaders(headers: Headers): Headers {
  const next = new Headers(headers);
  next.set('x-robots-tag', 'index, follow');
  next.set('x-content-type-options', 'nosniff');
  next.set('referrer-policy', 'strict-origin-when-cross-origin');
  return next;
}

function toOriginPath(pathname: string): string {
  if (pathname === PREFIX) return '/';
  if (pathname.startsWith(`${PREFIX}/`)) {
    const stripped = pathname.slice(PREFIX.length);
    return stripped || '/';
  }
  return pathname;
}

function normalizeConceptPath(pathname: string): string {
  const stripped = pathname.endsWith('/') ? pathname.slice(0, -1) : pathname;
  return stripped || PREFIX;
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

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const incomingUrl = new URL(request.url);

    if (incomingUrl.pathname === `${PREFIX}/rss.xml`) {
      return responseWithBody(conceptRssXml, 'application/xml');
    }

    if (incomingUrl.pathname === `${PREFIX}/sitemap.xml`) {
      return responseWithBody(conceptSitemapXml, 'application/xml');
    }

    if (incomingUrl.pathname === `${PREFIX}/robots.txt`) {
      return responseWithBody(conceptRobotsTxt, 'text/plain');
    }

    const normalizedIncomingPath = normalizeConceptPath(incomingUrl.pathname);
    if (
      normalizedIncomingPath.startsWith(`${PREFIX}/`) &&
      normalizedIncomingPath !== PREFIX &&
      !ALLOWED_PATHS.has(normalizedIncomingPath)
    ) {
      return new Response('Not found', {
        status: 404,
        headers: {
          'content-type': 'text/plain; charset=utf-8',
          'cache-control': 'no-store',
          'x-content-type-options': 'nosniff',
          'x-robots-tag': 'noindex, nofollow',
        },
      });
    }

    const originPath = toOriginPath(incomingUrl.pathname);
    const targetUrl = new URL(originPath + incomingUrl.search, env.KOMMUNE_ORIGIN);
    const upstreamResponse = await fetch(targetUrl.toString(), {
      method: request.method,
      headers: buildUpstreamHeaders(request),
      body: request.method === 'GET' || request.method === 'HEAD' ? undefined : request.body,
      redirect: 'manual',
    });

    const headers = withSecurityHeaders(upstreamResponse.headers);
    headers.set('cache-control', headers.get('cache-control') ?? 'public, max-age=300');

    return new Response(upstreamResponse.body, {
      status: upstreamResponse.status,
      statusText: upstreamResponse.statusText,
      headers,
    });
  },
};
