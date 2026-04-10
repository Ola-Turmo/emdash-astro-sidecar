import { claimNextJob, clampLeaseSeconds, completeJob, failJob } from '../../shared/job-runtime';
import { buildPublicationArtifact } from '@emdash/publish-engine';

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
        SELECT d.id, d.slug, tc.topic, h.host_name, h.site_url, h.base_path
        FROM drafts d
        JOIN hosts h ON h.id = d.host_id
        LEFT JOIN topic_candidates tc ON tc.id = d.topic_candidate_id
        WHERE d.host_id = ?1
          AND d.status = 'ready_for_publish'
        ORDER BY d.created_at ASC
        LIMIT 1
      `,
    )
    .bind(hostId)
    .first<{
      id: string;
      slug: string;
      topic: string | null;
      host_name: string;
      site_url: string;
      base_path: string;
    }>();

  if (!draft) {
    return {
      status: 'skipped',
      step,
      reason: 'No draft is ready for publish.',
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
      sections: sectionsResult.results,
    },
  );
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
      `apps/blog/src/content/blog/autonomous/${draft.slug}.mdx`,
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
    draftId: draft.id,
    artifactId,
    url: artifact.url,
    title: artifact.title,
  };
}

function isPublishStep(step: string): step is (typeof SUPPORTED_STEPS)[number] {
  return SUPPORTED_STEPS.includes(step as (typeof SUPPORTED_STEPS)[number]);
}
