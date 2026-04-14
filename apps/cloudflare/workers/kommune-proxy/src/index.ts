import { conceptRobotsTxt, conceptRssXml, conceptSitemapXml } from './generated/seo-artifacts';

interface Env {
  KOMMUNE_ORIGIN: string;
  METRICS_WORKER_URL: string;
}

const PREFIX = '/kommune';
const RUM_PATH = `${PREFIX}/__rum`;
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

function isConceptAssetPath(pathname: string): boolean {
  if (pathname.startsWith(`${PREFIX}/_astro/`) || pathname.startsWith(`${PREFIX}/fonts/`)) {
    return true;
  }

  return /\.[a-z0-9]+$/i.test(pathname);
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

    if (incomingUrl.pathname === RUM_PATH || incomingUrl.pathname === `${RUM_PATH}/`) {
      return proxyRumRequest(request, env.METRICS_WORKER_URL);
    }

    const normalizedIncomingPath = normalizeConceptPath(incomingUrl.pathname);
    if (
      normalizedIncomingPath.startsWith(`${PREFIX}/`) &&
      normalizedIncomingPath !== PREFIX &&
      !ALLOWED_PATHS.has(normalizedIncomingPath) &&
      !isConceptAssetPath(incomingUrl.pathname)
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
