interface Env {
  AUTONOMOUS_DB: D1Database;
  MATERIALIZE_BATCH_LIMIT?: string;
  CONTENT_API_TOKEN?: string;
  REVIEW_BATCH_LIMIT?: string;
  PUBLISH_WORKER_URL?: string;
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
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (!isAuthorized(request, env)) {
      return new Response('Unauthorized', { status: 401 });
    }

    const url = new URL(request.url);
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
              tc.topic
            FROM drafts d
            LEFT JOIN topic_candidates tc ON tc.id = d.topic_candidate_id
            WHERE d.status = 'ready_for_review'
            ORDER BY d.created_at ASC
            LIMIT ?1
          `,
        )
        .bind(limit)
        .all<ReviewDraftRow>();

      return Response.json({
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
        })),
      });
    }

    if (request.method === 'POST' && url.pathname === '/review/approve') {
      const payload = (await request.json().catch(() => ({}))) as {
        draftId?: string;
      };

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

      return Response.json({
        ok: true,
        draftId: payload.draftId,
        status: 'approved_for_publish',
      });
    }

    if (request.method === 'POST' && url.pathname === '/review/approve-and-publish') {
      const payload = (await request.json().catch(() => ({}))) as {
        draftId?: string;
        hostId?: string;
      };

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

      const publishWorkerUrl = env.PUBLISH_WORKER_URL?.trim();
      if (!publishWorkerUrl) {
        return Response.json(
          {
            ok: false,
            error: 'PUBLISH_WORKER_URL is not configured.',
          },
          { status: 500 },
        );
      }

      const publishResponse = await fetch(publishWorkerUrl, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          hostId: payload.hostId,
        }),
      });
      const publishPayload = await publishResponse.json().catch(() => ({}));

      return Response.json({
        ok: publishResponse.ok,
        draftId: payload.draftId,
        hostId: payload.hostId,
        publish: publishPayload,
      });
    }

    if (request.method === 'POST' && url.pathname === '/review/reject') {
      const payload = (await request.json().catch(() => ({}))) as {
        draftId?: string;
        reason?: string;
      };

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

      return Response.json({
        ok: true,
        draftId: payload.draftId,
        status: 'review_rejected',
        reason: payload.reason ?? null,
      });
    }

    if (request.method === 'POST' && url.pathname === '/publication-artifacts/materialized') {
      const payload = (await request.json().catch(() => ({}))) as {
        materializationId?: string;
        materializedPath?: string;
      };

      if (!payload.materializationId || !payload.materializedPath) {
        return Response.json(
          {
            ok: false,
            error: 'Both materializationId and materializedPath are required.',
          },
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
      const payload = (await request.json().catch(() => ({}))) as {
        materializationId?: string;
      };

      if (!payload.materializationId) {
        return Response.json(
          {
            ok: false,
            error: 'materializationId is required.',
          },
          { status: 400 },
        );
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

function clampLimit(requested: string | null, envLimit: string | undefined): number {
  const parsedRequested = requested ? Number(requested) : undefined;
  const parsedEnv = envLimit ? Number(envLimit) : 3;
  const hardCap = Number.isFinite(parsedEnv) && parsedEnv > 0 ? parsedEnv : 3;

  if (!Number.isFinite(parsedRequested) || !parsedRequested || parsedRequested <= 0) {
    return hardCap;
  }

  return Math.min(parsedRequested, hardCap);
}

function isAuthorized(request: Request, env: Env): boolean {
  const expectedToken = env.CONTENT_API_TOKEN?.trim();
  if (!expectedToken) return true;
  const authHeader = request.headers.get('authorization')?.trim();
  return authHeader === `Bearer ${expectedToken}`;
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
