export interface RequestTelemetryEnv {
  AUTONOMOUS_DB: D1Database;
}

export async function logEdgeRequestTelemetry(
  env: RequestTelemetryEnv,
  input: {
    siteKey: string;
    conceptKey: string;
    request: Request;
    statusCode: number;
  },
): Promise<void> {
  if (!shouldLogRequest(input.request)) {
    return;
  }

  await ensureEdgeMetricsTable(env.AUTONOMOUS_DB);

  const url = new URL(input.request.url);
  const now = new Date();
  const requestDate = now.toISOString().slice(0, 10);
  const requestHour = now.toISOString().slice(11, 13);
  const pageType = classifyPageType(url.pathname, input.conceptKey);
  const referrer = classifyReferrer(input.request.headers.get('referer'), url.hostname);
  const uaType = classifyUserAgent(input.request.headers.get('user-agent'));

  await env.AUTONOMOUS_DB.prepare(
    `
      INSERT INTO metrics_edge_requests_hourly (
        site_key, concept_key, request_date, request_hour, path, page_type,
        referrer_type, referrer_host, ua_type, status_code, request_count
      )
      VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, 1)
      ON CONFLICT (
        site_key, concept_key, request_date, request_hour, path, page_type,
        referrer_type, referrer_host, ua_type, status_code
      )
      DO UPDATE SET request_count = request_count + 1
    `,
  )
    .bind(
      input.siteKey,
      input.conceptKey,
      requestDate,
      requestHour,
      normalizePath(url.pathname),
      pageType,
      referrer.type,
      referrer.host,
      uaType,
      input.statusCode,
    )
    .run();

  const searchQuery = extractSearchQuery(input.request.headers.get('referer'));
  if (referrer.type === 'search' && searchQuery?.query) {
    await ensureEdgeSearchQueryTable(env.AUTONOMOUS_DB);
    await env.AUTONOMOUS_DB.prepare(
      `
        INSERT INTO metrics_edge_search_queries_hourly (
          site_key, concept_key, request_date, request_hour, path, search_engine, query_term, request_count
        )
        VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, 1)
        ON CONFLICT (
          site_key, concept_key, request_date, request_hour, path, search_engine, query_term
        )
        DO UPDATE SET request_count = request_count + 1
      `,
    )
      .bind(
        input.siteKey,
        input.conceptKey,
        requestDate,
        requestHour,
        normalizePath(url.pathname),
        searchQuery.engine,
        searchQuery.query,
      )
      .run();
  }
}

function shouldLogRequest(request: Request): boolean {
  if (!['GET', 'HEAD'].includes(request.method)) return false;
  const url = new URL(request.url);
  if (/\.(?:css|js|png|jpg|jpeg|gif|webp|svg|woff2|woff|ico|txt|xml|json)$/i.test(url.pathname)) {
    return false;
  }
  if (url.pathname.endsWith('/__rum') || url.pathname.endsWith('/__rum/')) return false;

  const accept = request.headers.get('accept') || '';
  const secFetchDest = request.headers.get('sec-fetch-dest') || '';
  return accept.includes('text/html') || secFetchDest === 'document' || !/\.[a-z0-9]+$/i.test(url.pathname);
}

function normalizePath(pathname: string): string {
  if (!pathname) return '/';
  const trimmed = pathname.replace(/\/+$/, '');
  return trimmed || '/';
}

function classifyPageType(pathname: string, conceptKey: string): string {
  const normalized = normalizePath(pathname);
  if (conceptKey === 'guide') {
    if (normalized === '/guide') return 'landing';
    if (normalized.startsWith('/guide/blog/')) return 'article';
    if (normalized.startsWith('/guide/category/')) return 'category';
    if (normalized.startsWith('/guide/author/')) return 'author';
  }
  if (conceptKey === 'kommune') {
    if (normalized === '/kommune') return 'landing';
    if (normalized.startsWith('/kommune/')) return 'municipality';
  }
  if (conceptKey === 'root') {
    if (normalized === '/') return 'landing';
    return 'page';
  }
  return 'page';
}

function classifyReferrer(referrerValue: string | null, currentHost: string): { type: string; host: string } {
  if (!referrerValue) {
    return { type: 'direct', host: '(direct)' };
  }

  try {
    const referrerUrl = new URL(referrerValue);
    const host = referrerUrl.hostname.toLowerCase();
    const current = currentHost.toLowerCase();

    if (host === current || host === `www.${current}` || current === `www.${host}`) {
      return { type: 'internal', host };
    }

    if (isSearchReferrer(host)) {
      return { type: 'search', host };
    }

    if (isSocialReferrer(host)) {
      return { type: 'social', host };
    }

    return { type: 'external', host };
  } catch {
    return { type: 'unknown', host: '(invalid-referrer)' };
  }
}

function isSearchReferrer(host: string): boolean {
  return [
    'google.',
    'bing.com',
    'duckduckgo.com',
    'search.yahoo.com',
    'search.brave.com',
    'yandex.',
    'ecosia.org',
    'perplexity.ai',
    'chatgpt.com',
  ].some((pattern) => host.includes(pattern));
}

function isSocialReferrer(host: string): boolean {
  return [
    'facebook.com',
    'm.facebook.com',
    'instagram.com',
    'linkedin.com',
    't.co',
    'twitter.com',
    'x.com',
    'reddit.com',
    'youtube.com',
    'tiktok.com',
  ].some((pattern) => host.includes(pattern));
}

function classifyUserAgent(userAgent: string | null): string {
  const normalized = (userAgent || '').toLowerCase();
  if (!normalized) return 'unknown';
  if (
    /(bot|crawl|crawler|spider|slurp|bingpreview|facebookexternalhit|googleother|adsbot|googlebot|ahrefsbot|semrushbot|mj12bot|yandexbot|baiduspider|applebot|petalbot|bytespider|gptbot|claudebot|ccbot|amazonbot|perplexitybot)/i.test(
      normalized,
    )
  ) {
    return 'crawler';
  }
  return 'browser';
}

async function ensureEdgeMetricsTable(db: D1Database): Promise<void> {
  await db
    .prepare(
      `
        CREATE TABLE IF NOT EXISTS metrics_edge_requests_hourly (
          site_key TEXT NOT NULL,
          concept_key TEXT NOT NULL,
          request_date TEXT NOT NULL,
          request_hour TEXT NOT NULL,
          path TEXT NOT NULL,
          page_type TEXT NOT NULL,
          referrer_type TEXT NOT NULL,
          referrer_host TEXT NOT NULL,
          ua_type TEXT NOT NULL,
          status_code INTEGER NOT NULL,
          request_count INTEGER NOT NULL DEFAULT 0,
          PRIMARY KEY (
            site_key,
            concept_key,
            request_date,
            request_hour,
            path,
            page_type,
            referrer_type,
            referrer_host,
            ua_type,
            status_code
          )
        )
      `,
    )
    .run();
}

async function ensureEdgeSearchQueryTable(db: D1Database): Promise<void> {
  await db
    .prepare(
      `
        CREATE TABLE IF NOT EXISTS metrics_edge_search_queries_hourly (
          site_key TEXT NOT NULL,
          concept_key TEXT NOT NULL,
          request_date TEXT NOT NULL,
          request_hour TEXT NOT NULL,
          path TEXT NOT NULL,
          search_engine TEXT NOT NULL,
          query_term TEXT NOT NULL,
          request_count INTEGER NOT NULL DEFAULT 0,
          PRIMARY KEY (
            site_key,
            concept_key,
            request_date,
            request_hour,
            path,
            search_engine,
            query_term
          )
        )
      `,
    )
    .run();
}

function extractSearchQuery(referrerValue: string | null): { engine: string; query: string } | null {
  if (!referrerValue) return null;
  try {
    const referrerUrl = new URL(referrerValue);
    const host = referrerUrl.hostname.toLowerCase();
    const queryParamNames = ['q', 'query', 'p', 'text'];
    const query = queryParamNames
      .map((name) => referrerUrl.searchParams.get(name)?.trim() || '')
      .find(Boolean);
    if (!query) return null;

    const engine =
      host.includes('google.') ? 'google'
      : host.includes('bing.com') ? 'bing'
      : host.includes('duckduckgo.com') ? 'duckduckgo'
      : host.includes('search.yahoo.com') ? 'yahoo'
      : host.includes('search.brave.com') ? 'brave'
      : host.includes('perplexity.ai') ? 'perplexity'
      : host.includes('chatgpt.com') ? 'chatgpt'
      : host;

    return { engine, query: normalizeQuery(query) };
  } catch {
    return null;
  }
}

function normalizeQuery(value: string): string {
  return value.replace(/\s+/g, ' ').trim().slice(0, 160);
}
