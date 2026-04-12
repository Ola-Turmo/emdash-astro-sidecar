import { buildPublicationArtifact, validatePublicationArtifact } from '../../../../../packages/publish-engine/src/index';

interface Env {
  AUTONOMOUS_DB: D1Database;
  MATERIALIZE_BATCH_LIMIT?: string;
  CONTENT_API_TOKEN?: string;
  REVIEW_BATCH_LIMIT?: string;
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

      const publishPayload = await publishApprovedDraft(env.AUTONOMOUS_DB, payload.hostId, payload.draftId);

      return Response.json({
        ok: true,
        draftId: payload.draftId,
        hostId: payload.hostId,
        publishStatus: 200,
        publishMode: 'direct_d1_publish',
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
