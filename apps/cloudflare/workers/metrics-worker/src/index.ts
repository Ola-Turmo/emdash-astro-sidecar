import {
  BingWebmasterClient,
  CruxApiClient,
  GoogleSearchConsoleClient,
  IndexNowClient,
  type TelemetryIngestionResult,
} from '../../../../../packages/metrics-ingestion/src/index';

interface Env {
  AUTONOMOUS_DB: D1Database;
  GSC_ACCESS_TOKEN?: string;
  CRUX_API_KEY?: string;
  BING_WEBMASTER_API_KEY?: string;
  INDEXNOW_KEY?: string;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (request.method === 'GET' && url.pathname === '/summary') {
      const hostId = url.searchParams.get('hostId');
      if (!hostId) {
        return Response.json({ ok: false, error: 'hostId is required' }, { status: 400 });
      }
      return Response.json(await buildMetricsSummary(env, hostId));
    }

    if (request.method !== 'POST') {
      return new Response('Method Not Allowed', { status: 405 });
    }

    const body = (await request.json().catch(() => ({}))) as {
      hostId?: string;
      indexNowUrls?: string[];
    };

    if (!body.hostId) {
      return Response.json({ ok: false, error: 'hostId is required' }, { status: 400 });
    }

    const host = await env.AUTONOMOUS_DB.prepare(
      `
        SELECT id, host_name, site_url, base_path
        FROM hosts
        WHERE id = ?1
      `,
    )
      .bind(body.hostId)
      .first<{ id: string; host_name: string; site_url: string; base_path: string }>();

    if (!host) {
      return Response.json({ ok: false, error: `Unknown host ${body.hostId}` }, { status: 404 });
    }

    const today = new Date().toISOString().slice(0, 10);
    const results: TelemetryIngestionResult[] = [];

    results.push(await ingestGsc(env, host, today));
    results.push(await ingestCrux(env, host, today));
    results.push(await ingestBing(env, host, today));

    if (body.indexNowUrls?.length) {
      results.push(await submitIndexNow(env, host, body.indexNowUrls));
    }

    return Response.json({
      ok: true,
      hostId: host.id,
      results,
    });
  },
};

async function buildMetricsSummary(env: Env, hostId: string): Promise<Record<string, unknown>> {
  const host = await env.AUTONOMOUS_DB
    .prepare(
      `
        SELECT id, host_name, site_url
        FROM hosts
        WHERE id = ?1
      `,
    )
    .bind(hostId)
    .first<{ id: string; host_name: string; site_url: string }>();

  if (!host) {
    return { ok: false, error: `Unknown host ${hostId}` };
  }

  const latestCrux = await env.AUTONOMOUS_DB
    .prepare(
      `
        SELECT metric_week, lcp_p75, inp_p75, cls_p75
        FROM metrics_crux
        WHERE host_id = ?1
        ORDER BY metric_week DESC
        LIMIT 1
      `,
    )
    .bind(hostId)
    .first<Record<string, unknown>>();

  const gscTotals = await env.AUTONOMOUS_DB
    .prepare(
      `
        SELECT
          SUM(clicks) AS clicks,
          SUM(impressions) AS impressions,
          AVG(position) AS avg_position
        FROM metrics_gsc
        WHERE host_id = ?1
          AND metric_date >= date('now', '-28 day')
      `,
    )
    .bind(hostId)
    .first<Record<string, unknown>>();

  const bingTotals = await env.AUTONOMOUS_DB
    .prepare(
      `
        SELECT
          SUM(clicks) AS clicks,
          SUM(impressions) AS impressions
        FROM metrics_bing
        WHERE host_id = ?1
          AND metric_date >= date('now', '-28 day')
      `,
    )
    .bind(hostId)
    .first<Record<string, unknown>>();

  const indexNow = await env.AUTONOMOUS_DB
    .prepare(
      `
        SELECT submitted_at, url_count, status
        FROM indexnow_submissions
        WHERE host_id = ?1
        ORDER BY submitted_at DESC
        LIMIT 5
      `,
    )
    .bind(hostId)
    .all<Record<string, unknown>>();

  return {
    ok: true,
    host,
    latestCrux,
    gsc28Day: gscTotals,
    bing28Day: bingTotals,
    latestIndexNowSubmissions: indexNow.results,
    generatedAt: new Date().toISOString(),
  };
}

async function ingestGsc(
  env: Env,
  host: { id: string; site_url: string },
  metricDate: string,
): Promise<TelemetryIngestionResult> {
  if (!env.GSC_ACCESS_TOKEN) {
    return { source: 'gsc', status: 'skipped', detail: { reason: 'missing GSC_ACCESS_TOKEN' } };
  }

  try {
    const client = new GoogleSearchConsoleClient(env.GSC_ACCESS_TOKEN);
    const response = await client.querySearchAnalytics({
      siteUrl: host.site_url,
      startDate: metricDate,
      endDate: metricDate,
      dimensions: ['page'],
      rowLimit: 25,
      searchType: 'web',
    });

    const rows = response.rows ?? [];
    for (const row of rows) {
      const page = row.keys?.[0] ?? null;
      await env.AUTONOMOUS_DB.prepare(
        `
          INSERT INTO metrics_gsc (id, host_id, metric_date, page, query, clicks, impressions, ctr, position)
          VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)
        `,
      )
        .bind(
          crypto.randomUUID(),
          host.id,
          metricDate,
          page,
          '__page__',
          Math.round(row.clicks ?? 0),
          Math.round(row.impressions ?? 0),
          row.ctr ?? null,
          row.position ?? null,
        )
        .run();
    }

    return {
      source: 'gsc',
      status: 'ingested',
      detail: { rowCount: rows.length },
    };
  } catch (error) {
    return { source: 'gsc', status: 'failed', detail: { error: toMessage(error) } };
  }
}

async function ingestCrux(
  env: Env,
  host: { id: string; site_url: string },
  metricDate: string,
): Promise<TelemetryIngestionResult> {
  if (!env.CRUX_API_KEY) {
    return { source: 'crux', status: 'skipped', detail: { reason: 'missing CRUX_API_KEY' } };
  }

  try {
    const client = new CruxApiClient(env.CRUX_API_KEY);
    const origin = new URL(host.site_url).origin;
    const response = await client.queryRecord({
      origin,
      formFactor: 'ALL_FORM_FACTORS',
    });

    const metrics = extractCruxMetrics(response as Record<string, unknown>);
    await env.AUTONOMOUS_DB.prepare(
      `
        INSERT INTO metrics_crux (id, host_id, metric_week, url, lcp_p75, inp_p75, cls_p75)
        VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)
      `,
    )
      .bind(
        crypto.randomUUID(),
        host.id,
        metricDate,
        host.site_url,
        metrics.lcpP75,
        metrics.inpP75,
        metrics.clsP75,
      )
      .run();

    return {
      source: 'crux',
      status: 'ingested',
      detail: { hasRecord: Boolean(response.record) },
    };
  } catch (error) {
    return { source: 'crux', status: 'failed', detail: { error: toMessage(error) } };
  }
}

async function ingestBing(
  env: Env,
  host: { id: string; site_url: string },
  metricDate: string,
): Promise<TelemetryIngestionResult> {
  if (!env.BING_WEBMASTER_API_KEY) {
    return {
      source: 'bing',
      status: 'skipped',
      detail: { reason: 'missing BING_WEBMASTER_API_KEY' },
    };
  }

  try {
    const client = new BingWebmasterClient(env.BING_WEBMASTER_API_KEY);
    const response = await client.getQueryStats({
      siteUrl: host.site_url,
      startDate: metricDate,
      endDate: metricDate,
    });

    const summary = summarizeBingResponse(response);
    await env.AUTONOMOUS_DB.prepare(
      `
        INSERT INTO metrics_bing (id, host_id, metric_date, page, query, clicks, impressions)
        VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)
      `,
    )
      .bind(
        crypto.randomUUID(),
        host.id,
        metricDate,
        summary.page,
        summary.query,
        summary.clicks,
        summary.impressions,
      )
      .run();

    return {
      source: 'bing',
      status: 'ingested',
      detail: { stored: true },
    };
  } catch (error) {
    return { source: 'bing', status: 'failed', detail: { error: toMessage(error) } };
  }
}

async function submitIndexNow(
  env: Env,
  host: { id: string; site_url: string },
  urls: string[],
): Promise<TelemetryIngestionResult> {
  if (!env.INDEXNOW_KEY) {
    return {
      source: 'indexnow',
      status: 'skipped',
      detail: { reason: 'missing INDEXNOW_KEY' },
    };
  }

  try {
    const hostname = new URL(host.site_url).hostname;
    const client = new IndexNowClient(hostname, env.INDEXNOW_KEY);
    const response = await client.submitUrls(urls);

    await ensureIndexNowTable(env.AUTONOMOUS_DB);
    await env.AUTONOMOUS_DB.prepare(
      `
        INSERT INTO indexnow_submissions (id, host_id, submitted_at, host, url_count, status, detail_json)
        VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)
      `,
    )
      .bind(
        crypto.randomUUID(),
        host.id,
        new Date().toISOString(),
        hostname,
        urls.length,
        'submitted',
        JSON.stringify(response),
      )
      .run();

    return {
      source: 'indexnow',
      status: 'ingested',
      detail: { urlCount: urls.length },
    };
  } catch (error) {
    return { source: 'indexnow', status: 'failed', detail: { error: toMessage(error) } };
  }
}

function toMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}

function extractCruxMetrics(response: Record<string, unknown>): {
  lcpP75: number | null;
  inpP75: number | null;
  clsP75: number | null;
} {
  const record = (response.record ?? {}) as Record<string, unknown>;
  const metrics = (record.metrics ?? {}) as Record<string, unknown>;

  return {
    lcpP75: getNestedNumber(metrics, ['largest_contentful_paint', 'percentiles', 'p75']),
    inpP75: getNestedNumber(metrics, ['interaction_to_next_paint', 'percentiles', 'p75']),
    clsP75: getNestedNumber(metrics, ['cumulative_layout_shift', 'percentiles', 'p75']),
  };
}

function summarizeBingResponse(response: Record<string, unknown>): {
  page: string | null;
  query: string | null;
  clicks: number;
  impressions: number;
} {
  const directClicks = getNestedNumber(response, ['Clicks']) ?? getNestedNumber(response, ['clicks']) ?? 0;
  const directImpressions =
    getNestedNumber(response, ['Impressions']) ?? getNestedNumber(response, ['impressions']) ?? 0;
  return {
    page: null,
    query: '__summary__',
    clicks: Math.round(directClicks),
    impressions: Math.round(directImpressions),
  };
}

function getNestedNumber(value: Record<string, unknown>, path: string[]): number | null {
  let current: unknown = value;
  for (const key of path) {
    if (!current || typeof current !== 'object' || !(key in current)) {
      return null;
    }
    current = (current as Record<string, unknown>)[key];
  }

  return typeof current === 'number' ? current : null;
}

async function ensureIndexNowTable(db: D1Database): Promise<void> {
  await db
    .prepare(
      `
        CREATE TABLE IF NOT EXISTS indexnow_submissions (
          id TEXT PRIMARY KEY,
          host_id TEXT NOT NULL,
          submitted_at TEXT NOT NULL,
          host TEXT NOT NULL,
          url_count INTEGER NOT NULL,
          status TEXT NOT NULL,
          detail_json TEXT NOT NULL
        )
      `,
    )
    .run();

  await db
    .prepare(
      `
        CREATE INDEX IF NOT EXISTS idx_indexnow_submissions_host_date
        ON indexnow_submissions(host_id, submitted_at)
      `,
    )
    .run();
}
