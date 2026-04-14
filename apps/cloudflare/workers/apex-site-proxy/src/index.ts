import { applySecurityHeaders } from '../../shared/security-headers';
import { logEdgeRequestTelemetry } from '../../shared/request-telemetry';

interface Env {
  ROOT_SITE_ORIGIN: string;
  AUTONOMOUS_DB: D1Database;
}

const PASSTHROUGH_PREFIXES = ['/guide', '/kommune'];
const PASSTHROUGH_EXACT = ['/robots.txt', '/sitemap.xml', '/sitemap-index.xml'];

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const incomingUrl = new URL(request.url);

    if (shouldPassthrough(incomingUrl.pathname)) {
      return fetch(request);
    }

    const targetUrl = new URL(incomingUrl.pathname + incomingUrl.search, env.ROOT_SITE_ORIGIN);
    const upstream = await fetch(targetUrl.toString(), {
      method: request.method,
      headers: buildUpstreamHeaders(request),
      body: request.method === 'GET' || request.method === 'HEAD' ? undefined : request.body,
      redirect: 'manual',
    });

    const headers = applySecurityHeaders(new Headers(upstream.headers));
    headers.set('x-emdash-root-proxy', 'apex-site');
    headers.set('cache-control', headers.get('cache-control') ?? 'public, max-age=0, must-revalidate');
    const response = new Response(upstream.body, {
      status: upstream.status,
      statusText: upstream.statusText,
      headers,
    });
    ctx.waitUntil(
      logEdgeRequestTelemetry(env, {
        siteKey: 'kurs-ing',
        conceptKey: 'root',
        request,
        statusCode: response.status,
      }),
    );
    return response;
  },
};

function shouldPassthrough(pathname: string): boolean {
  if (PASSTHROUGH_EXACT.includes(pathname)) return true;
  return PASSTHROUGH_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
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
