import { conceptRobotsTxt } from './generated/seo-artifacts';
import { applySecurityHeaders } from '../../shared/security-headers';
import { logEdgeRequestTelemetry } from '../../shared/request-telemetry';

interface Env {
  KOMMUNE_ORIGIN: string;
  METRICS_WORKER_URL: string;
  AUTONOMOUS_DB: D1Database;
}

const PREFIX = '/kommune';
const RUM_PATH = `${PREFIX}/__rum`;
let sitemapCache:
  | {
      fetchedAt: number;
      xml: string;
      allowedPaths: Set<string>;
    }
  | null = null;

function withSecurityHeaders(headers: Headers): Headers {
  return applySecurityHeaders(headers);
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

function isHtmlPagePath(pathname: string): boolean {
  return pathname === PREFIX || pathname.startsWith(`${PREFIX}/`) && !isConceptAssetPath(pathname) && !pathname.endsWith('.xml') && !pathname.endsWith('.txt');
}

function responseWithBody(body: string, contentType: string): Response {
  const headers = applySecurityHeaders(new Headers(), { indexable: true });
  headers.set('content-type', `${contentType}; charset=utf-8`);
  headers.set('cache-control', 'no-store');
  return new Response(body, {
    headers,
  });
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const incomingUrl = new URL(request.url);
    const sitemapState = await getSitemapState(env.KOMMUNE_ORIGIN);

    if (incomingUrl.pathname === `${PREFIX}/rss.xml`) {
      return proxyStaticOriginText('/rss.xml', env.KOMMUNE_ORIGIN, 'application/xml');
    }

    if (incomingUrl.pathname === `${PREFIX}/sitemap.xml`) {
      return responseWithBody(sitemapState.xml, 'application/xml');
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
      !sitemapState.allowedPaths.has(normalizedIncomingPath) &&
      !isConceptAssetPath(incomingUrl.pathname)
    ) {
      const response = new Response('Not found', {
        status: 404,
        headers: (() => {
          const headers = applySecurityHeaders(new Headers(), { indexable: false });
          headers.set('content-type', 'text/plain; charset=utf-8');
          headers.set('cache-control', 'no-store');
          return headers;
        })(),
      });
      ctx.waitUntil(
        logEdgeRequestTelemetry(env, {
          siteKey: 'kurs-ing',
          conceptKey: 'kommune',
          request,
          statusCode: response.status,
        }),
      );
      return response;
    }

    const originPath = toOriginPath(incomingUrl.pathname);
    const targetUrl = new URL(originPath + incomingUrl.search, env.KOMMUNE_ORIGIN);
    const upstreamHeaders = buildUpstreamHeaders(request);
    if (isHtmlPagePath(incomingUrl.pathname)) {
      upstreamHeaders.set('cache-control', 'no-cache');
      upstreamHeaders.set('pragma', 'no-cache');
    }
    const upstreamResponse = await fetch(targetUrl.toString(), {
      method: request.method,
      headers: upstreamHeaders,
      body: request.method === 'GET' || request.method === 'HEAD' ? undefined : request.body,
      redirect: 'manual',
    });

    const headers = withSecurityHeaders(upstreamResponse.headers);
    if (isHtmlPagePath(incomingUrl.pathname)) {
      headers.set('cache-control', 'no-store');
    } else {
      headers.set('cache-control', headers.get('cache-control') ?? 'public, max-age=300');
    }

    const response = new Response(upstreamResponse.body, {
      status: upstreamResponse.status,
      statusText: upstreamResponse.statusText,
      headers,
    });
    ctx.waitUntil(
      logEdgeRequestTelemetry(env, {
        siteKey: 'kurs-ing',
        conceptKey: 'kommune',
        request,
        statusCode: response.status,
      }),
    );
    return response;
  },
};

async function getSitemapState(origin: string) {
  const now = Date.now();
  if (sitemapCache && now - sitemapCache.fetchedAt < 60_000) {
    return sitemapCache;
  }

  const response = await fetch(new URL('/sitemap.xml', origin).toString(), {
    headers: {
      accept: 'application/xml,text/xml',
      'cache-control': 'no-cache',
      pragma: 'no-cache',
    },
  });

  const xml = await response.text();
  const allowedPaths = new Set(
    [...xml.matchAll(/<loc>https:\/\/www\.kurs\.ing(\/kommune(?:\/[^<]*)?)<\/loc>/g)].map((match) =>
      normalizeConceptPath(match[1] || PREFIX),
    ),
  );

  sitemapCache = {
    fetchedAt: now,
    xml,
    allowedPaths,
  };
  return sitemapCache;
}

async function proxyStaticOriginText(pathname: string, origin: string, contentType: string) {
  const response = await fetch(new URL(pathname, origin).toString(), {
    headers: {
      accept: `${contentType},text/plain;q=0.9,*/*;q=0.8`,
      'cache-control': 'no-cache',
      pragma: 'no-cache',
    },
  });
  const body = await response.text();
  return responseWithBody(body, contentType);
}

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
