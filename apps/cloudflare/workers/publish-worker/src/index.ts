import { claimNextJob, clampLeaseSeconds, completeJob, failJob } from '../../shared/job-runtime';
import { buildPublicationArtifact, validatePublicationArtifact } from '../../../../../packages/publish-engine/src/index';
import {
  defaultHostBudgets,
  evaluatePublishDecision,
  isHostMode,
} from '../../../../../packages/content-policy/src/index';
import type { HostMode } from '../../../../../packages/content-policy/src/index';

interface Env {
  AUTONOMOUS_DB: D1Database;
  JOB_LEASE_SECONDS?: string;
}

const WORKER_KIND = 'publish-worker';
const SUPPORTED_STEPS = ['publish_refreshes', 'publish_net_new'] as const;

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method !== 'POST') {
      return new Response('Method Not Allowed', { status: 405 });
    }

    const now = new Date().toISOString();
    const body = (await request.json().catch(() => ({}))) as {
      hostId?: string;
    };

    if (body.hostId) {
      const result = await runPublishStep(env.AUTONOMOUS_DB, body.hostId, 'publish_refreshes', now);
      return Response.json({
        ok: true,
        workerKind: WORKER_KIND,
        claimed: false,
        processed: [
          {
            source: 'direct_host_publish',
            hostId: body.hostId,
            result,
          },
        ],
      });
    }

    const leaseSeconds = clampLeaseSeconds(env.JOB_LEASE_SECONDS);
    const leaseOwner = crypto.randomUUID();

    const job = await claimNextJob(env.AUTONOMOUS_DB, {
      workerKind: WORKER_KIND,
      leaseOwner,
      now,
      leaseSeconds,
      supportedSteps: [...SUPPORTED_STEPS],
    });

    if (!job) {
      return Response.json({
        ok: true,
        workerKind: WORKER_KIND,
        claimed: false,
        message: 'No queued publish jobs are available.',
      });
    }

    if (!isPublishStep(job.step)) {
      await failJob(env.AUTONOMOUS_DB, job.id, leaseOwner, now, `Unsupported publish step: ${job.step}`);
      return Response.json(
        {
          ok: false,
          workerKind: WORKER_KIND,
          claimed: true,
          jobId: job.id,
          step: job.step,
          error: `Unsupported publish step: ${job.step}`,
        },
        { status: 500 },
      );
    }

    try {
      const result = await runPublishStep(env.AUTONOMOUS_DB, job.payload.hostId, job.step, now);
      await completeJob(env.AUTONOMOUS_DB, job.id, leaseOwner, now, result);

      return Response.json({
        ok: true,
        workerKind: WORKER_KIND,
        claimed: true,
        jobId: job.id,
        step: job.step,
        result,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown publish-worker error';
      await failJob(env.AUTONOMOUS_DB, job.id, leaseOwner, now, message);

      return Response.json(
        {
          ok: false,
          workerKind: WORKER_KIND,
          claimed: true,
          jobId: job.id,
          step: job.step,
          error: message,
        },
        { status: 500 },
      );
    }
  },
};

async function runPublishStep(
  db: D1Database,
  hostId: string,
  step: (typeof SUPPORTED_STEPS)[number],
  now: string,
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
          h.base_path,
          hm.mode AS host_mode
        FROM drafts d
        JOIN hosts h ON h.id = d.host_id
        LEFT JOIN topic_candidates tc ON tc.id = d.topic_candidate_id
        LEFT JOIN host_modes hm ON hm.host_id = d.host_id
        WHERE d.host_id = ?1
          AND d.status IN ('ready_for_publish', 'approved_for_publish')
        ORDER BY d.created_at ASC
        LIMIT 1
      `,
    )
    .bind(hostId)
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
      host_mode: string | null;
    }>();

  if (!draft) {
    return {
      status: 'skipped',
      step,
      reason: 'No draft is ready for publish.',
      hostId,
    };
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

  const sourceCount = await countHostSources(db, hostId);
  const publicationBudgetCounts = await db
    .prepare(
      `
        SELECT
          SUM(CASE WHEN published_at >= datetime('now', '-7 day') THEN 1 ELSE 0 END) AS published_this_week
        FROM publications
        WHERE host_id = ?1
      `,
    )
    .bind(hostId)
    .first<{ published_this_week: number | null }>();
  const draftAttemptsToday = await db
    .prepare(
      `
        SELECT COUNT(*) AS count
        FROM drafts
        WHERE host_id = ?1
          AND created_at >= datetime('now', 'start of day')
      `,
    )
    .bind(hostId)
    .first<{ count: number | null }>();
  const duplicateRisk = await db
    .prepare(
      `
        SELECT COUNT(*) AS count
        FROM publication_edge_artifacts
        WHERE host_id = ?1
          AND slug = ?2
      `,
    )
    .bind(hostId, draft.slug)
    .first<{ count: number | null }>();
  const failedEvalCount = await db
    .prepare(
      `
        SELECT COUNT(*) AS count
        FROM draft_evals
        WHERE draft_id = ?1
          AND passed = 0
      `,
    )
    .bind(draft.id)
    .first<{ count: number | null }>();

  const budgets = defaultHostBudgets();
  const hostMode: HostMode = isHostMode(draft.host_mode ?? undefined) ? (draft.host_mode as HostMode) : 'draft_only';
  const publishDecision = evaluatePublishDecision({
    hostMode,
    budgets,
    netNewPagesPublishedThisWeek: publicationBudgetCounts?.published_this_week ?? 0,
    autoRefreshesToday: 0,
    draftAttemptsToday: draftAttemptsToday?.count ?? 0,
    providerRetriesThisHour: 0,
    allContentEvalsPassed: (failedEvalCount?.count ?? 0) === 0,
    routeAuditPassed: true,
    evidenceThresholdMet: sourceCount >= 1,
    topicApproved: true,
    duplicateRiskDetected: (duplicateRisk?.count ?? 0) > 0,
    isNetNewPage: true,
  });

  if (!publishDecision.allowed) {
    return {
      status: 'blocked',
      step,
      hostId,
      draftId: draft.id,
      reasons: publishDecision.reasons,
    };
  }

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
        step,
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
        step,
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
    step,
    hostId,
    draftId: draft.id,
    artifactId,
    url: artifact.url,
    title: artifact.title,
    category: artifact.category,
    tags: artifact.tags,
  };
}

function isPublishStep(step: string): step is (typeof SUPPORTED_STEPS)[number] {
  return SUPPORTED_STEPS.includes(step as (typeof SUPPORTED_STEPS)[number]);
}

async function countHostSources(db: D1Database, hostId: string): Promise<number> {
  const row = await db
    .prepare(
      `
        SELECT COUNT(*) AS count
        FROM source_documents
        WHERE host_id = ?1
      `,
    )
    .bind(hostId)
    .first<{ count: number | null }>();

  return row?.count ?? 0;
}
