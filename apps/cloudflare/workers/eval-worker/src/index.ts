import { claimNextJob, clampLeaseSeconds, completeJob, failJob } from '../../shared/job-runtime';
import {
  evaluateDraftArtifact,
  scoreEvalSuite,
} from '../../../../../packages/content-evals/src/index';

interface Env {
  AUTONOMOUS_DB: D1Database;
  JOB_LEASE_SECONDS?: string;
}

const WORKER_KIND = 'future-worker';
const EVAL_STEP = 'evaluate_candidates';

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
      supportedSteps: [EVAL_STEP],
    });

    if (!job) {
      return Response.json({
        ok: true,
        workerKind: 'eval-worker',
        claimed: false,
        message: 'No queued evaluation jobs are available.',
      });
    }

    try {
      const result = await runEvalStep(env.AUTONOMOUS_DB, job.payload.hostId, now);
      await completeJob(env.AUTONOMOUS_DB, job.id, leaseOwner, now, result);

      return Response.json({
        ok: true,
        workerKind: 'eval-worker',
        claimed: true,
        jobId: job.id,
        step: job.step,
        result,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown eval-worker error';
      await failJob(env.AUTONOMOUS_DB, job.id, leaseOwner, now, message);

      return Response.json(
        {
          ok: false,
          workerKind: 'eval-worker',
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

async function runEvalStep(
  db: D1Database,
  hostId: string,
  now: string,
): Promise<Record<string, unknown>> {
  const draft = await db
    .prepare(
      `
        SELECT d.id, d.slug, d.title, d.description, d.excerpt, h.site_url
        FROM drafts d
        JOIN hosts h ON h.id = d.host_id
        WHERE d.host_id = ?1
          AND d.status = 'queued_eval'
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
      site_url: string;
    }>();

  if (!draft) {
    return {
      status: 'skipped',
      step: EVAL_STEP,
      reason: 'No draft is waiting for evaluation.',
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
  const criteria = evaluateDraftArtifact({
    title: draft.title ?? '',
    description: draft.description ?? '',
    excerpt: draft.excerpt ?? '',
    sections: sectionsResult.results,
    sourceCount,
    siteUrl: draft.site_url,
  });

  await db
    .prepare(
      `
        DELETE FROM draft_evals
        WHERE draft_id = ?1
      `,
    )
    .bind(draft.id)
    .run();

  for (const criterion of criteria) {
    await db
      .prepare(
        `
          INSERT INTO draft_evals (id, draft_id, criterion_id, passed, reason, created_at)
          VALUES (?1, ?2, ?3, ?4, ?5, ?6)
        `,
      )
      .bind(
        crypto.randomUUID(),
        draft.id,
        criterion.criterionId,
        criterion.passed ? 1 : 0,
        criterion.reason ?? null,
        now,
      )
      .run();
  }

  const passedCount = scoreEvalSuite(criteria);
  const finalStatus = passedCount === criteria.length ? 'ready_for_publish' : 'eval_failed';

  await db
    .prepare(
      `
        UPDATE drafts
        SET status = ?1
        WHERE id = ?2
      `,
    )
    .bind(finalStatus, draft.id)
    .run();

  return {
    status: 'completed',
    step: EVAL_STEP,
    draftId: draft.id,
    draftSlug: draft.slug,
    passedCount,
    totalCriteria: criteria.length,
    finalStatus,
    criteria,
  };
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
    .first<{ count: number }>();

  return row?.count ?? 0;
}
