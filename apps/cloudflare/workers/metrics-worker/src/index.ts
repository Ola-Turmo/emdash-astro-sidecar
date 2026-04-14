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

type RumMetricName = 'LCP' | 'INP' | 'CLS' | 'TTFB' | 'FCP';
type RumRow = {
  metric_name: RumMetricName;
  metric_value: number;
  sample_source: string | null;
  session_id: string | null;
  device_class: string | null;
  page_type: string | null;
  page_path: string;
  collected_at: string;
};
type RumPayload = {
  siteKey?: string;
  conceptKey?: string;
  pagePath?: string;
  pageType?: string;
  sampleSource?: string;
  sessionId?: string;
  deviceClass?: string;
  viewportWidth?: number;
  viewportHeight?: number;
  userAgent?: string;
  metrics?: Array<{
    name: RumMetricName;
    value: number;
    rating?: string;
  }>;
};
type RecentRumRow = {
  page_path: string;
  page_type: string | null;
  metric_name: RumMetricName;
  metric_value: number;
  rating: string | null;
  sample_source: string | null;
  session_id: string | null;
  device_class: string | null;
  collected_at: string;
};
type CruxIngestPayload = {
  siteKey?: string;
  conceptKey?: string;
  siteUrl?: string;
  urls?: string[];
  formFactors?: CruxFormFactor[];
};
type CruxFormFactor = 'PHONE' | 'DESKTOP' | 'TABLET' | 'ALL_FORM_FACTORS';

const FIELD_TARGETS: Record<RumMetricName, { good: number; poor: number; unit: string }> = {
  LCP: { good: 2500, poor: 4000, unit: 'ms' },
  INP: { good: 200, poor: 500, unit: 'ms' },
  CLS: { good: 0.1, poor: 0.25, unit: 'score' },
  TTFB: { good: 800, poor: 1800, unit: 'ms' },
  FCP: { good: 1800, poor: 3000, unit: 'ms' },
};

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders(request.headers.get('origin')) });
    }

    if (request.method === 'GET' && url.pathname === '/summary') {
      const hostId = url.searchParams.get('hostId');
      if (!hostId) {
        return Response.json({ ok: false, error: 'hostId is required' }, { status: 400 });
      }
      return Response.json(await buildMetricsSummary(env, hostId));
    }

    if (request.method === 'GET' && url.pathname === '/rum/summary') {
      const siteKey = url.searchParams.get('siteKey');
      const conceptKey = url.searchParams.get('conceptKey');
      const sampleSource = url.searchParams.get('sampleSource')?.trim() || 'browser_rum';
      if (!siteKey || !conceptKey) {
        return jsonWithCors(request, { ok: false, error: 'siteKey and conceptKey are required' }, 400);
      }
      return jsonWithCors(request, await buildRumSummary(env, siteKey, conceptKey, sampleSource));
    }

    if (request.method === 'GET' && url.pathname === '/rum/recent') {
      const siteKey = url.searchParams.get('siteKey');
      const conceptKey = url.searchParams.get('conceptKey');
      const sampleSource = url.searchParams.get('sampleSource')?.trim() || 'browser_rum';
      const pagePath = url.searchParams.get('pagePath')?.trim() || null;
      const limit = clampLimit(Number(url.searchParams.get('limit') || 20));
      if (!siteKey || !conceptKey) {
        return jsonWithCors(request, { ok: false, error: 'siteKey and conceptKey are required' }, 400);
      }
      return jsonWithCors(request, await listRecentRumRows(env, siteKey, conceptKey, sampleSource, pagePath, limit));
    }

    if (request.method === 'GET' && url.pathname === '/crux/summary') {
      const siteKey = url.searchParams.get('siteKey');
      const conceptKey = url.searchParams.get('conceptKey');
      if (!siteKey || !conceptKey) {
        return jsonWithCors(request, { ok: false, error: 'siteKey and conceptKey are required' }, 400);
      }
      return jsonWithCors(request, await buildCruxSummary(env, siteKey, conceptKey));
    }

    if (request.method === 'POST' && url.pathname === '/rum') {
      const payload = (await request.json().catch(() => ({}))) as RumPayload;
      const validationError = validateRumPayload(payload);
      if (validationError) {
        return jsonWithCors(request, { ok: false, error: validationError }, 400);
      }
      await ingestRum(env, payload as Required<RumPayload>);
      return jsonWithCors(request, { ok: true });
    }

    if (request.method === 'POST' && url.pathname === '/crux/ingest') {
      const payload = (await request.json().catch(() => ({}))) as CruxIngestPayload;
      const validationError = validateCruxPayload(payload);
      if (validationError) {
        return jsonWithCors(request, { ok: false, error: validationError }, 400);
      }
      return jsonWithCors(request, await ingestCruxSnapshots(env, payload as Required<CruxIngestPayload>));
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

async function ingestRum(env: Env, payload: Required<RumPayload>): Promise<void> {
  await ensureRumTable(env.AUTONOMOUS_DB);
  const now = new Date().toISOString();
  for (const metric of payload.metrics) {
    await env.AUTONOMOUS_DB.prepare(
      `
        INSERT INTO metrics_rum (
          id, site_key, concept_key, page_path, page_type, metric_name, metric_value, rating,
          sample_source, session_id, device_class, viewport_width, viewport_height, user_agent, collected_at
        )
        VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15)
      `,
    )
      .bind(
        crypto.randomUUID(),
        payload.siteKey,
        payload.conceptKey,
        payload.pagePath,
        payload.pageType || null,
        metric.name,
        metric.value,
        metric.rating || null,
        payload.sampleSource || 'unknown',
        payload.sessionId || null,
        payload.deviceClass || null,
        payload.viewportWidth || null,
        payload.viewportHeight || null,
        truncateValue(payload.userAgent || '', 240),
        now,
      )
      .run();
  }
}

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

async function buildRumSummary(
  env: Env,
  siteKey: string,
  conceptKey: string,
  sampleSource: string,
): Promise<Record<string, unknown>> {
  await ensureRumTable(env.AUTONOMOUS_DB);
  const rows = await env.AUTONOMOUS_DB
    .prepare(
      `
        SELECT metric_name, metric_value, sample_source, session_id, device_class, page_type, page_path, collected_at
        FROM metrics_rum
        WHERE site_key = ?1
          AND concept_key = ?2
          AND sample_source = ?3
          AND collected_at >= datetime('now', '-28 day')
      `,
    )
    .bind(siteKey, conceptKey, sampleSource)
    .all<RumRow>();

  const metrics = summarizeRumRows(rows.results);
  const byDeviceClass = Object.fromEntries(
    ['mobile', 'desktop'].map((deviceClass) => [
      deviceClass,
      summarizeRumRows(rows.results.filter((row) => row.device_class === deviceClass)),
    ]),
  );

  const pageTypes = [...new Set(rows.results.map((row) => row.page_type).filter((value): value is string => Boolean(value)))];
  const byPageType = Object.fromEntries(
    pageTypes.map((pageType) => [
      pageType,
      summarizeRumRows(rows.results.filter((row) => row.page_type === pageType)),
    ]),
  );

  const topPages = summarizeTopPages(rows.results);

  return {
    ok: true,
    siteKey,
    conceptKey,
    sampleSource,
    metrics,
    byDeviceClass,
    byPageType,
    topPages,
    sampleCount: rows.results.length,
    generatedAt: new Date().toISOString(),
  };
}

async function listRecentRumRows(
  env: Env,
  siteKey: string,
  conceptKey: string,
  sampleSource: string,
  pagePath: string | null,
  limit: number,
): Promise<Record<string, unknown>> {
  await ensureRumTable(env.AUTONOMOUS_DB);
  const statement = pagePath
    ? env.AUTONOMOUS_DB.prepare(
        `
          SELECT page_path, page_type, metric_name, metric_value, rating, sample_source, session_id, device_class, collected_at
          FROM metrics_rum
          WHERE site_key = ?1
            AND concept_key = ?2
            AND sample_source = ?3
            AND page_path = ?4
          ORDER BY collected_at DESC
          LIMIT ?5
        `,
      ).bind(siteKey, conceptKey, sampleSource, pagePath, limit)
    : env.AUTONOMOUS_DB.prepare(
        `
          SELECT page_path, page_type, metric_name, metric_value, rating, sample_source, session_id, device_class, collected_at
          FROM metrics_rum
          WHERE site_key = ?1
            AND concept_key = ?2
            AND sample_source = ?3
          ORDER BY collected_at DESC
          LIMIT ?4
        `,
      ).bind(siteKey, conceptKey, sampleSource, limit);

  const rows = await statement.all<RecentRumRow>();

  return {
    ok: true,
    siteKey,
    conceptKey,
    sampleSource,
    pagePath,
    limit,
    rows: rows.results,
    generatedAt: new Date().toISOString(),
  };
}

async function ingestCruxSnapshots(
  env: Env,
  payload: Required<CruxIngestPayload>,
): Promise<Record<string, unknown>> {
  await ensureCruxSamplesTable(env.AUTONOMOUS_DB);
  const apiKey = await resolveRuntimeSecret(env, 'emdash-metrics-worker', 'CRUX_API_KEY');
  if (!apiKey) {
    return { ok: false, error: 'missing CRUX_API_KEY' };
  }

  const client = new CruxApiClient(apiKey);
  const origin = new URL(payload.siteUrl).origin;
  const targetUrls = [...new Set([payload.siteUrl, ...(payload.urls || [])])];
  const formFactors: CruxFormFactor[] = payload.formFactors?.length
    ? payload.formFactors
    : ['PHONE', 'DESKTOP', 'ALL_FORM_FACTORS'];

  const results: Array<Record<string, unknown>> = [];
  for (const formFactor of formFactors) {
    results.push(
      await storeCruxSample(env, client, {
        siteKey: payload.siteKey,
        conceptKey: payload.conceptKey,
        targetKind: 'origin',
        targetValue: origin,
        formFactor,
    request: { origin, formFactor },
      }),
    );

    for (const targetUrl of targetUrls) {
      results.push(
        await storeCruxSample(env, client, {
          siteKey: payload.siteKey,
          conceptKey: payload.conceptKey,
          targetKind: 'url',
          targetValue: targetUrl,
          formFactor,
          request: { url: targetUrl, formFactor },
        }),
      );
    }
  }

  return {
    ok: true,
    siteKey: payload.siteKey,
    conceptKey: payload.conceptKey,
    origin,
    targetUrlCount: targetUrls.length,
    formFactors,
    results,
    generatedAt: new Date().toISOString(),
  };
}

async function storeCruxSample(
  env: Env,
  client: CruxApiClient,
  input: {
    siteKey: string;
    conceptKey: string;
    targetKind: 'origin' | 'url';
    targetValue: string;
    formFactor: 'PHONE' | 'DESKTOP' | 'TABLET' | 'ALL_FORM_FACTORS';
    request: { origin?: string; url?: string; formFactor: CruxFormFactor };
  },
): Promise<Record<string, unknown>> {
  try {
    const response = await client.queryRecord(input.request);
    const metrics = extractCruxMetrics(response as Record<string, unknown>);
    const collectedAt = new Date().toISOString();

    await env.AUTONOMOUS_DB.prepare(
      `
        INSERT INTO metrics_crux_samples (
          id, site_key, concept_key, target_kind, target_value, form_factor, collected_at,
          lcp_p75, inp_p75, cls_p75, raw_json
        )
        VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)
      `,
    )
      .bind(
        crypto.randomUUID(),
        input.siteKey,
        input.conceptKey,
        input.targetKind,
        input.targetValue,
        input.formFactor,
        collectedAt,
        metrics.lcpP75,
        metrics.inpP75,
        metrics.clsP75,
        JSON.stringify(response),
      )
      .run();

    return {
      targetKind: input.targetKind,
      targetValue: input.targetValue,
      formFactor: input.formFactor,
      status: 'ingested',
      metrics,
    };
  } catch (error) {
    if (isCruxNoDataError(error)) {
      return {
        targetKind: input.targetKind,
        targetValue: input.targetValue,
        formFactor: input.formFactor,
        status: 'skipped',
        reason: 'crux_no_data',
      };
    }

    return {
      targetKind: input.targetKind,
      targetValue: input.targetValue,
      formFactor: input.formFactor,
      status: 'failed',
      error: toMessage(error),
    };
  }
}

async function buildCruxSummary(env: Env, siteKey: string, conceptKey: string): Promise<Record<string, unknown>> {
  await ensureCruxSamplesTable(env.AUTONOMOUS_DB);
  const rows = await env.AUTONOMOUS_DB
    .prepare(
      `
        SELECT target_kind, target_value, form_factor, collected_at, lcp_p75, inp_p75, cls_p75
        FROM metrics_crux_samples
        WHERE site_key = ?1
          AND concept_key = ?2
        ORDER BY collected_at DESC
        LIMIT 200
      `,
    )
    .bind(siteKey, conceptKey)
    .all<{
      target_kind: 'origin' | 'url';
      target_value: string;
      form_factor: string;
      collected_at: string;
      lcp_p75: number | null;
      inp_p75: number | null;
      cls_p75: number | null;
    }>();

  const latestByTarget = new Map<string, Record<string, unknown>>();
  const trends: Array<Record<string, unknown>> = [];
  for (const row of rows.results) {
    const key = `${row.target_kind}:${row.target_value}:${row.form_factor}`;
    if (!latestByTarget.has(key)) {
      latestByTarget.set(key, {
        targetKind: row.target_kind,
        targetValue: row.target_value,
        formFactor: row.form_factor,
        collectedAt: row.collected_at,
        lcpP75: row.lcp_p75,
        inpP75: row.inp_p75,
        clsP75: row.cls_p75,
      });
    }

    if (row.target_kind === 'url') {
      trends.push({
        targetValue: row.target_value,
        formFactor: row.form_factor,
        collectedAt: row.collected_at,
        lcpP75: row.lcp_p75,
        inpP75: row.inp_p75,
        clsP75: row.cls_p75,
      });
    }
  }

  return {
    ok: true,
    siteKey,
    conceptKey,
    latest: [...latestByTarget.values()],
    recentUrlTrend: trends.slice(0, 30),
    sampleCount: rows.results.length,
    generatedAt: new Date().toISOString(),
  };
}

async function ingestGsc(
  env: Env,
  host: { id: string; site_url: string },
  metricDate: string,
): Promise<TelemetryIngestionResult> {
  const accessToken = await resolveRuntimeSecret(env, 'emdash-metrics-worker', 'GSC_ACCESS_TOKEN');
  if (!accessToken) {
    return { source: 'gsc', status: 'skipped', detail: { reason: 'missing GSC_ACCESS_TOKEN' } };
  }

  try {
    const client = new GoogleSearchConsoleClient(accessToken);
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
  const apiKey = await resolveRuntimeSecret(env, 'emdash-metrics-worker', 'CRUX_API_KEY');
  if (!apiKey) {
    return { source: 'crux', status: 'skipped', detail: { reason: 'missing CRUX_API_KEY' } };
  }

  try {
    const client = new CruxApiClient(apiKey);
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
    if (isCruxNoDataError(error)) {
      return { source: 'crux', status: 'skipped', detail: { reason: 'crux_no_data' } };
    }
    return { source: 'crux', status: 'failed', detail: { error: toMessage(error) } };
  }
}

async function ingestBing(
  env: Env,
  host: { id: string; site_url: string },
  metricDate: string,
): Promise<TelemetryIngestionResult> {
  const apiKey = await resolveRuntimeSecret(env, 'emdash-metrics-worker', 'BING_WEBMASTER_API_KEY');
  if (!apiKey) {
    return {
      source: 'bing',
      status: 'skipped',
      detail: { reason: 'missing BING_WEBMASTER_API_KEY' },
    };
  }

  try {
    const client = new BingWebmasterClient(apiKey);
    const siteUrlVariants = buildBingSiteUrlVariants(host.site_url);
    let response: Record<string, unknown> | null = null;
    const attempted: Array<{ siteUrl: string; outcome: string }> = [];

    for (const siteUrl of siteUrlVariants) {
      try {
        response = await client.getQueryStats({
          siteUrl,
          startDate: metricDate,
          endDate: metricDate,
        });
        attempted.push({ siteUrl, outcome: 'ok' });
        break;
      } catch (error) {
        const message = toMessage(error);
        attempted.push({ siteUrl, outcome: message });
        if (!isBingNotAuthorizedError(error)) {
          throw error;
        }
      }
    }

    if (!response) {
      return {
        source: 'bing',
        status: 'skipped',
        detail: {
          reason: 'bing_not_authorized',
          attempted,
        },
      };
    }

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
  const key = await resolveRuntimeSecret(env, 'emdash-metrics-worker', 'INDEXNOW_KEY');
  if (!key) {
    return {
      source: 'indexnow',
      status: 'skipped',
      detail: { reason: 'missing INDEXNOW_KEY' },
    };
  }

  try {
    const hostname = new URL(host.site_url).hostname;
    const client = new IndexNowClient(hostname, key);
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

async function ensureCruxSamplesTable(db: D1Database): Promise<void> {
  await db
    .prepare(
      `
        CREATE TABLE IF NOT EXISTS metrics_crux_samples (
          id TEXT PRIMARY KEY,
          site_key TEXT NOT NULL,
          concept_key TEXT NOT NULL,
          target_kind TEXT NOT NULL,
          target_value TEXT NOT NULL,
          form_factor TEXT NOT NULL,
          collected_at TEXT NOT NULL,
          lcp_p75 REAL,
          inp_p75 REAL,
          cls_p75 REAL,
          raw_json TEXT NOT NULL
        )
      `,
    )
    .run();

  await db
    .prepare(
      `
        CREATE INDEX IF NOT EXISTS idx_metrics_crux_samples_scope_time
        ON metrics_crux_samples(site_key, concept_key, collected_at DESC)
      `,
    )
    .run();

  await db
    .prepare(
      `
        CREATE INDEX IF NOT EXISTS idx_metrics_crux_samples_target
        ON metrics_crux_samples(site_key, concept_key, target_kind, target_value, form_factor, collected_at DESC)
      `,
    )
    .run();
}

async function ensureRuntimeSecretFallbacksTable(db: D1Database): Promise<void> {
  await db
    .prepare(
      `
        CREATE TABLE IF NOT EXISTS runtime_secret_fallbacks (
          worker_name TEXT NOT NULL,
          secret_name TEXT NOT NULL,
          secret_value TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          PRIMARY KEY (worker_name, secret_name)
        )
      `,
    )
    .run();
}

async function ensureRumTable(db: D1Database): Promise<void> {
  await db
    .prepare(
      `
        CREATE TABLE IF NOT EXISTS metrics_rum (
          id TEXT PRIMARY KEY,
          site_key TEXT NOT NULL,
          concept_key TEXT NOT NULL,
          page_path TEXT NOT NULL,
          page_type TEXT,
          metric_name TEXT NOT NULL,
          metric_value REAL NOT NULL,
          rating TEXT,
          sample_source TEXT,
          session_id TEXT,
          device_class TEXT,
          viewport_width INTEGER,
          viewport_height INTEGER,
          user_agent TEXT,
          collected_at TEXT NOT NULL
        )
      `,
    )
    .run();

  await db
    .prepare(
      `
        CREATE INDEX IF NOT EXISTS idx_metrics_rum_scope_time
        ON metrics_rum(site_key, concept_key, metric_name, collected_at)
      `,
    )
    .run();
}

function validateRumPayload(payload: RumPayload): string | null {
  if (!payload.siteKey || !payload.conceptKey || !payload.pagePath || !payload.metrics?.length) {
    return 'siteKey, conceptKey, pagePath, and metrics are required';
  }

  if (!payload.sampleSource) {
    return 'sampleSource is required';
  }

  for (const metric of payload.metrics) {
    if (!FIELD_TARGETS[metric.name]) {
      return `Unsupported metric ${metric.name}`;
    }
    if (!Number.isFinite(metric.value) || metric.value <= 0) {
      return `Invalid value for ${metric.name}`;
    }
  }

  return null;
}

async function resolveRuntimeSecret(
  env: Env,
  workerName: string,
  secretName: 'GSC_ACCESS_TOKEN' | 'CRUX_API_KEY' | 'BING_WEBMASTER_API_KEY' | 'INDEXNOW_KEY',
): Promise<string | null> {
  const direct = env[secretName];
  if (direct && direct.trim()) {
    return direct.trim();
  }

  await ensureRuntimeSecretFallbacksTable(env.AUTONOMOUS_DB);
  const row = await env.AUTONOMOUS_DB
    .prepare(
      `
        SELECT secret_value
        FROM runtime_secret_fallbacks
        WHERE worker_name = ?1
          AND secret_name = ?2
        LIMIT 1
      `,
    )
    .bind(workerName, secretName)
    .first<{ secret_value: string }>();

  return row?.secret_value?.trim() || null;
}

function validateCruxPayload(payload: CruxIngestPayload): string | null {
  if (!payload.siteKey || !payload.conceptKey || !payload.siteUrl) {
    return 'siteKey, conceptKey, and siteUrl are required';
  }

  try {
    new URL(payload.siteUrl);
  } catch {
    return 'siteUrl must be a valid absolute URL';
  }

  for (const targetUrl of payload.urls ?? []) {
    try {
      new URL(targetUrl);
    } catch {
      return `Invalid CrUX url target: ${targetUrl}`;
    }
  }

  return null;
}

function percentile(values: number[], ratio: number): number | null {
  if (!values.length) return null;
  const index = Math.max(0, Math.min(values.length - 1, Math.ceil(values.length * ratio) - 1));
  return Number(values[index].toFixed(2));
}

function summarizeRumRows(rows: RumRow[]): Record<RumMetricName, Record<string, unknown>> {
  const byMetric = new Map<RumMetricName, number[]>();
  for (const row of rows) {
    const values = byMetric.get(row.metric_name) ?? [];
    values.push(Number(row.metric_value));
    byMetric.set(row.metric_name, values);
  }

  const summary = {} as Record<RumMetricName, Record<string, unknown>>;
  for (const metricName of Object.keys(FIELD_TARGETS) as RumMetricName[]) {
    const values = [...(byMetric.get(metricName) ?? [])].sort((a, b) => a - b);
    const target = FIELD_TARGETS[metricName];
    const p50 = percentile(values, 0.5);
    const p75 = percentile(values, 0.75);
    const p95 = percentile(values, 0.95);
    const p99 = percentile(values, 0.99);
    summary[metricName] = {
      sampleCount: values.length,
      p50,
      p75,
      p95,
      p99,
      rating: rateFieldMetric(metricName, p75),
      targetGood: target.good,
      targetPoor: target.poor,
      unit: target.unit,
    };
  }
  return summary;
}

function summarizeTopPages(rows: RumRow[]): Array<Record<string, unknown>> {
  const pageMap = new Map<
    string,
    {
      pageType: string | null;
      metrics: Map<RumMetricName, number[]>;
    }
  >();

  for (const row of rows) {
    const current = pageMap.get(row.page_path) ?? {
      pageType: row.page_type,
      metrics: new Map<RumMetricName, number[]>(),
    };
    const metricValues = current.metrics.get(row.metric_name) ?? [];
    metricValues.push(Number(row.metric_value));
    current.metrics.set(row.metric_name, metricValues);
    pageMap.set(row.page_path, current);
  }

  return [...pageMap.entries()]
    .map(([pagePath, pageData]) => {
      const lcpValues = [...(pageData.metrics.get('LCP') ?? [])].sort((a, b) => a - b);
      const inpValues = [...(pageData.metrics.get('INP') ?? [])].sort((a, b) => a - b);
      const clsValues = [...(pageData.metrics.get('CLS') ?? [])].sort((a, b) => a - b);
      return {
        pagePath,
        pageType: pageData.pageType,
        sampleCount: lcpValues.length || inpValues.length || clsValues.length,
        lcpP75: percentile(lcpValues, 0.75),
        inpP75: percentile(inpValues, 0.75),
        clsP75: percentile(clsValues, 0.75),
      };
    })
    .sort((left, right) => Number(right.lcpP75 ?? 0) - Number(left.lcpP75 ?? 0))
    .slice(0, 10);
}

function rateFieldMetric(metric: RumMetricName, value: number | null): 'good' | 'needs-improvement' | 'poor' | 'no-data' {
  if (value === null) return 'no-data';
  const target = FIELD_TARGETS[metric];
  if (value <= target.good) return 'good';
  if (value <= target.poor) return 'needs-improvement';
  return 'poor';
}

function corsHeaders(origin: string | null): HeadersInit {
  return {
    'access-control-allow-origin': origin || '*',
    'access-control-allow-methods': 'GET,POST,OPTIONS',
    'access-control-allow-headers': 'content-type,authorization',
  };
}

function jsonWithCors(request: Request, body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store, max-age=0',
      vary: 'Origin',
      ...corsHeaders(request.headers.get('origin')),
    },
  });
}

function truncateValue(value: string, maxLength: number): string {
  if (value.length <= maxLength) return value;
  return value.slice(0, maxLength);
}

function clampLimit(value: number): number {
  if (!Number.isFinite(value)) return 20;
  return Math.max(1, Math.min(50, Math.round(value)));
}

function isCruxNoDataError(error: unknown): boolean {
  const message = toMessage(error).toLowerCase();
  return (
    message.includes('chrome ux report data not found') ||
    message.includes('data not found') ||
    message.includes('not_found')
  );
}

function isBingNotAuthorizedError(error: unknown): boolean {
  const message = toMessage(error).toLowerCase();
  return message.includes('notauthorized') || message.includes('errorcode":14');
}

function buildBingSiteUrlVariants(siteUrl: string): string[] {
  try {
    const url = new URL(siteUrl);
    const host = url.hostname.replace(/^www\./i, '');
    return [...new Set([
      `https://www.${host}`,
      `https://${host}`,
      `http://www.${host}`,
      `http://${host}`,
    ])];
  } catch {
    return [siteUrl];
  }
}
