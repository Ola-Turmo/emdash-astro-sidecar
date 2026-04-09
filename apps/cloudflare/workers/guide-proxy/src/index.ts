import { guideRobotsTxt, guideRssXml, guideSitemapXml } from './generated/seo-artifacts';

interface Env {
  GUIDE_ORIGIN: string;
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
      return responseWithBody(guideRssXml, 'application/xml');
    }

    if (incomingUrl.pathname === `${GUIDE_PREFIX}/sitemap.xml`) {
      return responseWithBody(guideSitemapXml, 'application/xml');
    }

    if (incomingUrl.pathname === `${GUIDE_PREFIX}/robots.txt`) {
      return responseWithBody(guideRobotsTxt, 'text/plain');
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

    const headers = withSecurityHeaders(upstreamResponse.headers);
    headers.set('cache-control', headers.get('cache-control') ?? 'public, max-age=300');

    return new Response(upstreamResponse.body, {
      status: upstreamResponse.status,
      statusText: upstreamResponse.statusText,
      headers,
    });
  },
};
