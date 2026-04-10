interface Env {
  AUTONOMOUS_DB: D1Database;
  MATERIALIZE_BATCH_LIMIT?: string;
  CONTENT_API_TOKEN?: string;
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
  if (!env.CONTENT_API_TOKEN) return true;
  const authHeader = request.headers.get('authorization');
  return authHeader === `Bearer ${env.CONTENT_API_TOKEN}`;
}
