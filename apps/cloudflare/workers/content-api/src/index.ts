import { buildPublicationArtifact, validatePublicationArtifact } from '../../../../../packages/publish-engine/src/index';

interface Env {
  AUTONOMOUS_DB: D1Database;
  MATERIALIZE_BATCH_LIMIT?: string;
  CONTENT_API_TOKEN?: string;
  REVIEW_BATCH_LIMIT?: string;
  BROWSER_AUDIT_WORKER_URL?: string;
}

interface MaterializationRow {
  materialization_id: string;
  artifact_id: string;
  host_id: string;
  draft_id: string;
  suggested_path: string;
  artifact_content: string;
  slug: string;
  url: string;
}

interface ReviewDraftRow {
  draft_id: string;
  host_id: string;
  slug: string;
  title: string | null;
  description: string | null;
  excerpt: string | null;
  word_count: number | null;
  quality_notes_json: string | null;
  provider_id: string | null;
  model_id: string | null;
  topic: string | null;
  created_at: string | null;
}

interface SummaryHostRow {
  host_id: string;
  host_name: string;
  site_url: string;
  base_path: string;
  host_mode: string | null;
  ready_for_review_count: number;
  ready_for_publish_count: number;
  published_count: number;
}

interface RecentPublicationRow {
  host_name: string;
  url: string;
  published_at: string;
}

interface RecentAuditRow {
  host_name: string;
  url: string;
  status_code: number | null;
  created_at: string;
}

interface ProviderSummaryRow {
  provider_id: string | null;
  model_id: string | null;
  draft_count: number;
  published_count: number;
}

interface PromptSummaryRow {
  family_id: string;
  validation_score: number;
  total_score: number;
  max_score: number;
  kept: number;
  created_at: string;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (!isAuthorized(request, env, url)) {
      return new Response('Unauthorized', { status: 401 });
    }

    if (request.method === 'GET' && url.pathname === '/publication-artifacts') {
      const limit = clampLimit(url.searchParams.get('limit'), env.MATERIALIZE_BATCH_LIMIT);
      const artifacts = await env.AUTONOMOUS_DB
        .prepare(
          `
            SELECT
              pm.id AS materialization_id,
              pm.artifact_id,
              pm.host_id,
              pm.draft_id,
              pm.suggested_path,
              pa.artifact_content,
              d.slug,
              p.url
            FROM publication_materializations pm
            JOIN publication_artifacts pa ON pa.id = pm.artifact_id
            JOIN drafts d ON d.id = pm.draft_id
            LEFT JOIN publications p ON p.draft_id = pm.draft_id
            WHERE pm.status = 'pending'
            ORDER BY pm.created_at ASC
            LIMIT ?1
          `,
        )
        .bind(limit)
        .all<MaterializationRow>();

      return Response.json({
        ok: true,
        limit,
        artifacts: artifacts.results.map((row) => ({
          materializationId: row.materialization_id,
          artifactId: row.artifact_id,
          hostId: row.host_id,
          draftId: row.draft_id,
          slug: row.slug,
          suggestedPath: row.suggested_path,
          url: row.url,
          mdx: row.artifact_content,
        })),
      });
    }

    if (request.method === 'GET' && url.pathname === '/review/drafts') {
      return Response.json(await listReviewDrafts(env, url));
    }

    if (request.method === 'GET' && url.pathname === '/observability/summary') {
      return Response.json(await buildObservabilitySummary(env));
    }

    if (request.method === 'GET' && url.pathname === '/review/ui') {
      return htmlResponse(await buildReviewUi(env, url));
    }

    if (request.method === 'GET' && url.pathname === '/observability/ui') {
      return htmlResponse(await buildObservabilityUi(env));
    }

    if (request.method === 'POST' && url.pathname === '/review/approve') {
      const payload = await parseActionPayload(request);
      if (!payload.draftId) {
        return Response.json({ ok: false, error: 'draftId is required.' }, { status: 400 });
      }

      await env.AUTONOMOUS_DB
        .prepare(
          `
            UPDATE drafts
            SET status = 'approved_for_publish'
            WHERE id = ?1
              AND status = 'ready_for_review'
          `,
        )
        .bind(payload.draftId)
        .run();

      return maybeRedirectToUi(request, payload, {
        ok: true,
        draftId: payload.draftId,
        status: 'approved_for_publish',
      });
    }

    if (request.method === 'POST' && url.pathname === '/review/approve-and-publish') {
      const payload = await parseActionPayload(request);
      if (!payload.draftId || !payload.hostId) {
        return Response.json(
          { ok: false, error: 'draftId and hostId are required.' },
          { status: 400 },
        );
      }

      await env.AUTONOMOUS_DB
        .prepare(
          `
            UPDATE drafts
            SET status = 'approved_for_publish'
            WHERE id = ?1
              AND status = 'ready_for_review'
          `,
        )
        .bind(payload.draftId)
        .run();

      const publishPayload = await publishApprovedDraft(env.AUTONOMOUS_DB, payload.hostId, payload.draftId);
      return maybeRedirectToUi(request, payload, {
        ok: true,
        draftId: payload.draftId,
        hostId: payload.hostId,
        publishStatus: 200,
        publishMode: 'direct_d1_publish',
        publish: publishPayload,
      });
    }

    if (request.method === 'POST' && url.pathname === '/review/reject') {
      const payload = await parseActionPayload(request);
      if (!payload.draftId) {
        return Response.json({ ok: false, error: 'draftId is required.' }, { status: 400 });
      }

      await env.AUTONOMOUS_DB
        .prepare(
          `
            UPDATE drafts
            SET status = 'review_rejected'
            WHERE id = ?1
              AND status = 'ready_for_review'
          `,
        )
        .bind(payload.draftId)
        .run();

      return maybeRedirectToUi(request, payload, {
        ok: true,
        draftId: payload.draftId,
        status: 'review_rejected',
        reason: payload.reason ?? null,
      });
    }

    if (request.method === 'POST' && url.pathname === '/publication-artifacts/materialized') {
      const payload = await parseActionPayload(request);
      if (!payload.materializationId || !payload.materializedPath) {
        return Response.json(
          { ok: false, error: 'Both materializationId and materializedPath are required.' },
          { status: 400 },
        );
      }

      await env.AUTONOMOUS_DB
        .prepare(
          `
            UPDATE publication_materializations
            SET
              status = 'materialized',
              materialized_path = ?1,
              updated_at = CURRENT_TIMESTAMP
            WHERE id = ?2
          `,
        )
        .bind(payload.materializedPath, payload.materializationId)
        .run();

      return Response.json({
        ok: true,
        materializationId: payload.materializationId,
        materializedPath: payload.materializedPath,
      });
    }

    if (request.method === 'POST' && url.pathname === '/publication-artifacts/deployed') {
      const payload = await parseActionPayload(request);
      if (!payload.materializationId) {
        return Response.json({ ok: false, error: 'materializationId is required.' }, { status: 400 });
      }

      await env.AUTONOMOUS_DB
        .prepare(
          `
            UPDATE publication_materializations
            SET
              status = 'deployed',
              updated_at = CURRENT_TIMESTAMP
            WHERE id = ?1
          `,
        )
        .bind(payload.materializationId)
        .run();

      return Response.json({
        ok: true,
        materializationId: payload.materializationId,
        status: 'deployed',
      });
    }

    return new Response('Not Found', { status: 404 });
  },
};

async function listReviewDrafts(env: Env, url: URL): Promise<Record<string, unknown>> {
  const limit = clampLimit(url.searchParams.get('limit'), env.REVIEW_BATCH_LIMIT ?? '10');
  const drafts = await env.AUTONOMOUS_DB
    .prepare(
      `
        SELECT
          d.id AS draft_id,
          d.host_id,
          d.slug,
          d.title,
          d.description,
          d.excerpt,
          d.word_count,
          d.quality_notes_json,
          d.provider_id,
          d.model_id,
          tc.topic,
          d.created_at
        FROM drafts d
        LEFT JOIN topic_candidates tc ON tc.id = d.topic_candidate_id
        WHERE d.status = 'ready_for_review'
        ORDER BY d.created_at ASC
        LIMIT ?1
      `,
    )
    .bind(limit)
    .all<ReviewDraftRow>();

  return {
    ok: true,
    limit,
    drafts: drafts.results.map((row) => ({
      draftId: row.draft_id,
      hostId: row.host_id,
      slug: row.slug,
      title: row.title,
      description: row.description,
      excerpt: row.excerpt,
      wordCount: row.word_count,
      qualityNotes: parseJsonArray(row.quality_notes_json),
      providerId: row.provider_id,
      modelId: row.model_id,
      topic: row.topic,
      createdAt: row.created_at,
    })),
  };
}

async function buildObservabilitySummary(env: Env): Promise<Record<string, unknown>> {
  const hosts = await env.AUTONOMOUS_DB
    .prepare(
      `
        SELECT
          h.id AS host_id,
          h.host_name,
          h.site_url,
          h.base_path,
          hm.mode AS host_mode,
          SUM(CASE WHEN d.status = 'ready_for_review' THEN 1 ELSE 0 END) AS ready_for_review_count,
          SUM(CASE WHEN d.status IN ('ready_for_publish', 'approved_for_publish') THEN 1 ELSE 0 END) AS ready_for_publish_count,
          SUM(CASE WHEN d.status = 'published' THEN 1 ELSE 0 END) AS published_count
        FROM hosts h
        LEFT JOIN host_modes hm ON hm.host_id = h.id
        LEFT JOIN drafts d ON d.host_id = h.id
        GROUP BY h.id, h.host_name, h.site_url, h.base_path, hm.mode
        ORDER BY h.host_name ASC
      `,
    )
    .all<SummaryHostRow>();

  const recentPublications = await env.AUTONOMOUS_DB
    .prepare(
      `
        SELECT h.host_name, p.url, p.published_at
        FROM publications p
        JOIN hosts h ON h.id = p.host_id
        ORDER BY p.published_at DESC
        LIMIT 12
      `,
    )
    .all<RecentPublicationRow>();

  const recentAudits = await env.AUTONOMOUS_DB
    .prepare(
      `
        SELECT h.host_name, a.url, a.status_code, a.created_at
        FROM audit_runs a
        JOIN hosts h ON h.id = a.host_id
        ORDER BY a.created_at DESC
        LIMIT 12
      `,
    )
    .all<RecentAuditRow>();

  const latestCrux = await env.AUTONOMOUS_DB
    .prepare(
      `
        SELECT host_id, metric_week, lcp_p75, inp_p75, cls_p75
        FROM metrics_crux
        WHERE (host_id, metric_week) IN (
          SELECT host_id, MAX(metric_week)
          FROM metrics_crux
          GROUP BY host_id
        )
      `,
    )
    .all<Record<string, unknown>>();

  const providerSummary = await env.AUTONOMOUS_DB
    .prepare(
      `
        SELECT
          provider_id,
          model_id,
          COUNT(*) AS draft_count,
          SUM(CASE WHEN status = 'published' THEN 1 ELSE 0 END) AS published_count
        FROM drafts
        GROUP BY provider_id, model_id
        ORDER BY draft_count DESC
      `,
    )
    .all<ProviderSummaryRow>();

  const promptSummary = await env.AUTONOMOUS_DB
    .prepare(
      `
        SELECT family_id, validation_score, total_score, max_score, kept, created_at
        FROM prompt_runs
        ORDER BY created_at DESC
        LIMIT 12
      `,
    )
    .all<PromptSummaryRow>();

  return {
    ok: true,
    generatedAt: new Date().toISOString(),
    hosts: hosts.results,
    recentPublications: recentPublications.results,
    recentAudits: recentAudits.results,
    latestCrux: latestCrux.results,
    providerSummary: providerSummary.results,
    promptSummary: promptSummary.results,
  };
}

async function buildReviewUi(env: Env, url: URL): Promise<string> {
  const drafts = (await listReviewDrafts(env, url)).drafts as Array<Record<string, unknown>>;
  const observability = await buildObservabilitySummary(env);
  const token = url.searchParams.get('token') ?? '';

  const draftCards = drafts.length
    ? drafts
        .map((draft) => {
          const qualityNotes = (draft.qualityNotes as string[] | undefined) ?? [];
          return `
            <article class="card">
              <p class="eyebrow">${escapeHtml(String(draft.hostId ?? 'ukjent vert'))}</p>
              <h2>${escapeHtml(String(draft.title ?? draft.slug ?? 'Uten tittel'))}</h2>
              <p class="copy">${escapeHtml(String(draft.excerpt ?? draft.description ?? ''))}</p>
              <dl class="meta">
                <div><dt>Slug</dt><dd>${escapeHtml(String(draft.slug ?? ''))}</dd></div>
                <div><dt>Provider</dt><dd>${escapeHtml(String(draft.providerId ?? '-'))}</dd></div>
                <div><dt>Modell</dt><dd>${escapeHtml(String(draft.modelId ?? '-'))}</dd></div>
                <div><dt>Ord</dt><dd>${escapeHtml(String(draft.wordCount ?? '-'))}</dd></div>
              </dl>
              ${
                qualityNotes.length
                  ? `<ul class="notes">${qualityNotes.map((note) => `<li>${escapeHtml(note)}</li>`).join('')}</ul>`
                  : ''
              }
              <div class="actions">
                ${buildActionForm('/review/approve', token, {
                  draftId: String(draft.draftId ?? ''),
                }, 'Godkjenn')}
                ${buildActionForm('/review/approve-and-publish', token, {
                  draftId: String(draft.draftId ?? ''),
                  hostId: String(draft.hostId ?? ''),
                }, 'Godkjenn og publiser', true)}
                ${buildRejectForm(token, String(draft.draftId ?? ''))}
              </div>
            </article>
          `;
        })
        .join('')
    : '<article class="card"><p>Ingen utkast venter på review akkurat nå.</p></article>';

  return `<!DOCTYPE html>
<html lang="nb">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>EmDash review dashboard</title>
    <style>
      body { margin: 0; font-family: Manrope, system-ui, sans-serif; background: #f8fafc; color: #0f172a; }
      main { width: min(1180px, calc(100% - 32px)); margin: 0 auto; padding: 32px 0 64px; }
      .eyebrow { font-size: 12px; font-weight: 800; letter-spacing: .16em; text-transform: uppercase; color: #0f766e; }
      h1 { margin: 0 0 12px; font-size: 2.3rem; letter-spacing: -.03em; }
      .copy { color: #475569; line-height: 1.7; }
      .grid { display: grid; gap: 20px; grid-template-columns: 1.4fr .9fr; align-items: start; }
      .stack { display: grid; gap: 20px; }
      .card { background: white; border: 1px solid #e2e8f0; border-radius: 24px; padding: 24px; box-shadow: 0 18px 40px rgba(15, 23, 42, .05); }
      .meta { display: grid; gap: 12px; grid-template-columns: repeat(2, minmax(0, 1fr)); margin: 16px 0; }
      .meta div { background: #f8fafc; border-radius: 18px; padding: 12px; }
      .meta dt { font-size: 12px; font-weight: 800; text-transform: uppercase; color: #64748b; margin-bottom: 6px; }
      .meta dd { margin: 0; font-weight: 700; color: #0f172a; }
      .notes { margin: 0 0 16px; padding-left: 18px; color: #475569; }
      .actions { display: grid; gap: 10px; }
      form { display: flex; gap: 10px; flex-wrap: wrap; }
      input[type="text"] { flex: 1 1 240px; border: 1px solid #cbd5e1; border-radius: 14px; padding: 10px 12px; }
      button { border: 0; border-radius: 999px; padding: 10px 16px; font-weight: 800; cursor: pointer; }
      .primary { background: #115e59; color: white; }
      .secondary { background: #0f172a; color: white; }
      .danger { background: #fee2e2; color: #991b1b; }
      table { width: 100%; border-collapse: collapse; }
      th, td { padding: 10px 0; text-align: left; border-bottom: 1px solid #e2e8f0; font-size: 14px; }
      th { color: #64748b; font-size: 12px; text-transform: uppercase; letter-spacing: .12em; }
      @media (max-width: 980px) { .grid { grid-template-columns: 1fr; } }
    </style>
  </head>
  <body>
    <main>
      <p class="eyebrow">Cloudflare review</p>
      <h1>Review- og observasjonsflate</h1>
      <p class="copy">Denne flaten viser hva som står klart til review, hva som nylig ble publisert, og grunnleggende driftssignaler fra kontrollplanet.</p>
      <div class="grid">
        <section class="stack">
          ${draftCards}
        </section>
        <section class="stack">
          <article class="card">
            <p class="eyebrow">Vertsstatus</p>
            ${renderHostTable(observability.hosts as SummaryHostRow[])}
          </article>
          <article class="card">
            <p class="eyebrow">Nylig publisert</p>
            ${renderPublicationList(observability.recentPublications as RecentPublicationRow[])}
          </article>
          <article class="card">
            <p class="eyebrow">Nylige audits</p>
            ${renderAuditList(observability.recentAudits as RecentAuditRow[], env.BROWSER_AUDIT_WORKER_URL)}
          </article>
          <article class="card">
            <p class="eyebrow">Leverandører</p>
            ${renderProviderTable(observability.providerSummary as ProviderSummaryRow[])}
          </article>
        </section>
      </div>
    </main>
  </body>
</html>`;
}

async function buildObservabilityUi(env: Env): Promise<string> {
  const summary = await buildObservabilitySummary(env);
  return `<!DOCTYPE html>
<html lang="nb">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>EmDash observability</title>
    <style>
      body { margin: 0; font-family: Manrope, system-ui, sans-serif; background: #020617; color: #e2e8f0; }
      main { width: min(1100px, calc(100% - 32px)); margin: 0 auto; padding: 32px 0 64px; }
      .eyebrow { font-size: 12px; font-weight: 800; letter-spacing: .16em; text-transform: uppercase; color: #5eead4; }
      h1 { margin: 0 0 12px; font-size: 2.3rem; letter-spacing: -.03em; }
      .card { margin-top: 20px; background: rgba(15,23,42,.72); border: 1px solid rgba(51,65,85,.8); border-radius: 24px; padding: 24px; }
      table { width: 100%; border-collapse: collapse; }
      th, td { padding: 10px 0; text-align: left; border-bottom: 1px solid rgba(51,65,85,.8); font-size: 14px; }
      th { color: #94a3b8; font-size: 12px; text-transform: uppercase; letter-spacing: .12em; }
      pre { white-space: pre-wrap; word-break: break-word; }
    </style>
  </head>
  <body>
    <main>
      <p class="eyebrow">Observability</p>
      <h1>Kontrollplanstatus</h1>
      <div class="card">${renderHostTable(summary.hosts as SummaryHostRow[])}</div>
      <div class="card"><p class="eyebrow">Modellbruk</p>${renderProviderTable(summary.providerSummary as ProviderSummaryRow[])}</div>
      <div class="card"><p class="eyebrow">Prompt runs</p>${renderPromptTable(summary.promptSummary as PromptSummaryRow[])}</div>
      <div class="card"><p class="eyebrow">Nylige audits</p>${renderAuditList(summary.recentAudits as RecentAuditRow[], env.BROWSER_AUDIT_WORKER_URL)}</div>
      <div class="card"><pre>${escapeHtml(JSON.stringify(summary.latestCrux, null, 2))}</pre></div>
    </main>
  </body>
</html>`;
}

async function parseActionPayload(request: Request): Promise<Record<string, string>> {
  const contentType = request.headers.get('content-type') ?? '';
  if (contentType.includes('application/json')) {
    return ((await request.json().catch(() => ({}))) as Record<string, unknown>) as Record<string, string>;
  }

  if (contentType.includes('application/x-www-form-urlencoded') || contentType.includes('multipart/form-data')) {
    const form = await request.formData();
    const payload: Record<string, string> = {};
    form.forEach((value, key) => {
      payload[key] = String(value);
    });
    return payload;
  }

  return {};
}

function clampLimit(requested: string | null, envLimit: string | undefined): number {
  const parsedRequested = requested ? Number(requested) : undefined;
  const parsedEnv = envLimit ? Number(envLimit) : 3;
  const hardCap = Number.isFinite(parsedEnv) && parsedEnv > 0 ? parsedEnv : 3;
  if (!Number.isFinite(parsedRequested) || !parsedRequested || parsedRequested <= 0) return hardCap;
  return Math.min(parsedRequested, hardCap);
}

function isAuthorized(request: Request, env: Env, url: URL): boolean {
  const expectedToken = env.CONTENT_API_TOKEN?.trim();
  if (!expectedToken) return true;
  const authHeader = request.headers.get('authorization')?.trim();
  const operatorHeader = request.headers.get('x-content-api-token')?.trim();
  const queryToken = url.searchParams.get('token')?.trim();
  return authHeader === `Bearer ${expectedToken}` || operatorHeader === expectedToken || queryToken === expectedToken;
}

function parseJsonArray(value: string | null): string[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((entry): entry is string => typeof entry === 'string') : [];
  } catch {
    return [];
  }
}

async function publishApprovedDraft(
  db: D1Database,
  hostId: string,
  draftId: string,
): Promise<Record<string, unknown>> {
  const draft = await db
    .prepare(
      `
        SELECT
          d.id,
          d.slug,
          d.title,
          d.description,
          d.excerpt,
          tc.topic,
          h.host_name,
          h.site_url,
          h.base_path
        FROM drafts d
        JOIN hosts h ON h.id = d.host_id
        LEFT JOIN topic_candidates tc ON tc.id = d.topic_candidate_id
        WHERE d.host_id = ?1
          AND d.id = ?2
          AND d.status = 'approved_for_publish'
        LIMIT 1
      `,
    )
    .bind(hostId, draftId)
    .first<{
      id: string;
      slug: string;
      title: string | null;
      description: string | null;
      excerpt: string | null;
      topic: string | null;
      host_name: string;
      site_url: string;
      base_path: string;
    }>();

  if (!draft) {
    throw new Error(`No approved draft found for host ${hostId} and draft ${draftId}.`);
  }

  const sectionsResult = await db
    .prepare(
      `
        SELECT heading, body
        FROM draft_sections
        WHERE draft_id = ?1
        ORDER BY section_order ASC
      `,
    )
    .bind(draft.id)
    .all<{ heading: string; body: string }>();

  const artifact = buildPublicationArtifact(
    {
      hostId,
      hostName: draft.host_name,
      siteUrl: draft.site_url,
      basePath: draft.base_path,
    },
    {
      draftId: draft.id,
      slug: draft.slug,
      topic: draft.topic ?? draft.slug.replace(/-/g, ' '),
      title: draft.title,
      description: draft.description,
      excerpt: draft.excerpt,
      sections: sectionsResult.results,
    },
  );
  const validation = validatePublicationArtifact(artifact);
  if (!validation.valid) {
    throw new Error(`Publication artifact failed validation: ${validation.reasons.join(' ')}`);
  }

  const artifactId = crypto.randomUUID();
  const now = new Date().toISOString();

  await db
    .prepare(
      `
        INSERT INTO publication_artifacts (id, host_id, draft_id, artifact_format, artifact_content)
        VALUES (?1, ?2, ?3, 'mdx', ?4)
      `,
    )
    .bind(artifactId, hostId, draft.id, artifact.mdx)
    .run();

  await db
    .prepare(
      `
        INSERT INTO publication_edge_artifacts (
          id,
          host_id,
          draft_id,
          slug,
          url,
          title,
          description,
          html_content
        )
        VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)
      `,
    )
    .bind(
      crypto.randomUUID(),
      hostId,
      draft.id,
      artifact.slug,
      artifact.url,
      artifact.title,
      artifact.description,
      artifact.html,
    )
    .run();

  await db
    .prepare(
      `
        INSERT INTO publication_materializations (
          id,
          artifact_id,
          host_id,
          draft_id,
          status,
          suggested_path
        )
        VALUES (?1, ?2, ?3, ?4, 'pending', ?5)
      `,
    )
    .bind(
      crypto.randomUUID(),
      artifactId,
      hostId,
      draft.id,
      `apps/blog/src/content/blog/${artifact.slug}.mdx`,
    )
    .run();

  await db
    .prepare(
      `
        INSERT INTO publications (id, host_id, draft_id, url, published_at)
        VALUES (?1, ?2, ?3, ?4, ?5)
      `,
    )
    .bind(crypto.randomUUID(), hostId, draft.id, artifact.url, now)
    .run();

  await db
    .prepare(
      `
        INSERT INTO publication_events (id, host_id, draft_id, event_type, detail_json)
        VALUES (?1, ?2, ?3, 'artifact_built', ?4)
      `,
    )
    .bind(
      crypto.randomUUID(),
      hostId,
      draft.id,
      JSON.stringify({
        step: 'approve_and_publish',
        url: artifact.url,
        title: artifact.title,
        description: artifact.description,
        category: artifact.category,
        tags: artifact.tags,
      }),
    )
    .run();

  await db
    .prepare(
      `
        INSERT INTO publication_events (id, host_id, draft_id, event_type, detail_json)
        VALUES (?1, ?2, ?3, 'published', ?4)
      `,
    )
    .bind(
      crypto.randomUUID(),
      hostId,
      draft.id,
      JSON.stringify({
        step: 'approve_and_publish',
        url: artifact.url,
        excerpt: artifact.excerpt,
      }),
    )
    .run();

  await db
    .prepare(
      `
        UPDATE drafts
        SET status = 'published'
        WHERE id = ?1
      `,
    )
    .bind(draft.id)
    .run();

  return {
    status: 'completed',
    draftId: draft.id,
    artifactId,
    url: artifact.url,
    title: artifact.title,
    category: artifact.category,
    tags: artifact.tags,
  };
}

function maybeRedirectToUi(
  request: Request,
  payload: Record<string, string>,
  body: Record<string, unknown>,
): Response {
  const url = new URL(request.url);
  const wantsHtml = request.headers.get('accept')?.includes('text/html');
  if (!wantsHtml) {
    return Response.json(body);
  }

  const next = new URL('/review/ui', url.origin);
  if (payload.token) next.searchParams.set('token', payload.token);
  next.searchParams.set('message', String(body.ok ? 'ok' : 'failed'));
  return Response.redirect(next.toString(), 303);
}

function buildActionForm(action: string, token: string, payload: Record<string, string>, label: string, primary = false): string {
  const inputs = Object.entries(payload)
    .map(([key, value]) => `<input type="hidden" name="${escapeHtml(key)}" value="${escapeHtml(value)}" />`)
    .join('');
  const tokenInput = token ? `<input type="hidden" name="token" value="${escapeHtml(token)}" />` : '';
  return `<form method="post" action="${escapeHtml(action)}">${tokenInput}${inputs}<button class="${primary ? 'primary' : 'secondary'}" type="submit">${escapeHtml(label)}</button></form>`;
}

function buildRejectForm(token: string, draftId: string): string {
  const tokenInput = token ? `<input type="hidden" name="token" value="${escapeHtml(token)}" />` : '';
  return `<form method="post" action="/review/reject">${tokenInput}<input type="hidden" name="draftId" value="${escapeHtml(draftId)}" /><input type="text" name="reason" placeholder="Kort grunn for avslag" /><button class="danger" type="submit">Avslå</button></form>`;
}

function renderHostTable(hosts: SummaryHostRow[]): string {
  if (!hosts.length) return '<p>Ingen vertsdata enda.</p>';
  return `<table><thead><tr><th>Vert</th><th>Modus</th><th>Review</th><th>Klar</th><th>Publisert</th></tr></thead><tbody>${hosts
    .map(
      (host) => `<tr><td>${escapeHtml(host.host_name)}</td><td>${escapeHtml(host.host_mode ?? '-')}</td><td>${host.ready_for_review_count}</td><td>${host.ready_for_publish_count}</td><td>${host.published_count}</td></tr>`,
    )
    .join('')}</tbody></table>`;
}

function renderPublicationList(rows: RecentPublicationRow[]): string {
  if (!rows.length) return '<p>Ingen nylige publiseringer.</p>';
  return `<table><thead><tr><th>Vert</th><th>URL</th><th>Tid</th></tr></thead><tbody>${rows
    .map(
      (row) => `<tr><td>${escapeHtml(row.host_name)}</td><td><a href="${escapeHtml(row.url)}">${escapeHtml(row.url)}</a></td><td>${escapeHtml(row.published_at)}</td></tr>`,
    )
    .join('')}</tbody></table>`;
}

function renderAuditList(rows: RecentAuditRow[], browserAuditWorkerUrl?: string): string {
  if (!rows.length) return '<p>Ingen nylige audits.</p>';
  return `<table><thead><tr><th>Vert</th><th>Status</th><th>URL</th><th>Skjermbilde</th></tr></thead><tbody>${rows
    .map(
      (row) => `<tr><td>${escapeHtml(row.host_name)}</td><td>${escapeHtml(String(row.status_code ?? '-'))}</td><td>${escapeHtml(row.url)}</td><td>${renderAuditScreenshotLink(row.url, browserAuditWorkerUrl)}</td></tr>`,
    )
    .join('')}</tbody></table>`;
}

function renderProviderTable(rows: ProviderSummaryRow[]): string {
  if (!rows.length) return '<p>Ingen provider-data enda.</p>';
  return `<table><thead><tr><th>Provider</th><th>Modell</th><th>Utkast</th><th>Publisert</th></tr></thead><tbody>${rows
    .map(
      (row) => `<tr><td>${escapeHtml(row.provider_id ?? 'ukjent')}</td><td>${escapeHtml(row.model_id ?? 'ukjent')}</td><td>${row.draft_count}</td><td>${row.published_count}</td></tr>`,
    )
    .join('')}</tbody></table>`;
}

function renderPromptTable(rows: PromptSummaryRow[]): string {
  if (!rows.length) return '<p>Ingen prompt-runs enda.</p>';
  return `<table><thead><tr><th>Familie</th><th>Validering</th><th>Total</th><th>Kept</th><th>Tid</th></tr></thead><tbody>${rows
    .map(
      (row) => `<tr><td>${escapeHtml(row.family_id)}</td><td>${row.validation_score}/${row.max_score}</td><td>${row.total_score}</td><td>${row.kept}</td><td>${escapeHtml(row.created_at)}</td></tr>`,
    )
    .join('')}</tbody></table>`;
}

function renderAuditScreenshotLink(targetUrl: string, browserAuditWorkerUrl?: string): string {
  if (!browserAuditWorkerUrl) return '-';
  const screenshotUrl = `${browserAuditWorkerUrl}?target=${encodeURIComponent(targetUrl)}&screenshot=1&format=image`;
  return `<a href="${escapeHtml(screenshotUrl)}" target="_blank" rel="noreferrer">Åpne</a>`;
}

function htmlResponse(html: string): Response {
  return new Response(html, {
    headers: {
      'content-type': 'text/html; charset=utf-8',
      'cache-control': 'no-store',
    },
  });
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
