import { claimNextJob, clampLeaseSeconds, completeJob, failJob } from '../../shared/job-runtime';
import {
  evaluateDraftArtifact,
  scoreEvalSuite,
} from '../../../../../packages/content-evals/src/index';

interface Env {
  AUTONOMOUS_DB: D1Database;
  JOB_LEASE_SECONDS?: string;
  EVAL_MAX_JOBS_PER_RUN?: string;
}

const WORKER_KIND = 'future-worker';
const EVAL_STEP = 'evaluate_candidates';

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method !== 'POST') {
      return new Response('Method Not Allowed', { status: 405 });
    }

    const now = new Date().toISOString();
    const requestBody = (await request.json().catch(() => ({}))) as {
      hostId?: string;
    };
    const leaseSeconds = clampLeaseSeconds(env.JOB_LEASE_SECONDS);
    const maxJobs = clampMaxJobs(env.EVAL_MAX_JOBS_PER_RUN);
    const processed: Array<Record<string, unknown>> = [];

    if (requestBody.hostId) {
      const result = await runEvalStep(env.AUTONOMOUS_DB, requestBody.hostId, now);
      return Response.json({
        ok: true,
        workerKind: 'eval-worker',
        claimed: false,
        processedCount: 1,
        processed: [
          {
            ok: true,
            source: 'direct_host_eval',
            hostId: requestBody.hostId,
            result,
          },
        ],
      });
    }

    for (let index = 0; index < maxJobs; index += 1) {
      const leaseOwner = crypto.randomUUID();
      const job = await claimNextJob(env.AUTONOMOUS_DB, {
        workerKind: WORKER_KIND,
        leaseOwner,
        now,
        leaseSeconds,
        supportedSteps: [EVAL_STEP],
      });

      if (!job) {
        break;
      }

      try {
        const result = await runEvalStep(env.AUTONOMOUS_DB, job.payload.hostId, now);
        await completeJob(env.AUTONOMOUS_DB, job.id, leaseOwner, now, result);
        processed.push({
          ok: true,
          jobId: job.id,
          hostId: job.payload.hostId,
          step: job.step,
          result,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown eval-worker error';
        await failJob(env.AUTONOMOUS_DB, job.id, leaseOwner, now, message);
        processed.push({
          ok: false,
          jobId: job.id,
          hostId: job.payload.hostId,
          step: job.step,
          error: message,
        });
      }
    }

    if (processed.length === 0) {
      const recovered = await runOrphanEvalRecovery(env.AUTONOMOUS_DB, now);
      if (recovered) {
        return Response.json({
          ok: true,
          workerKind: 'eval-worker',
          claimed: false,
          processedCount: 1,
          processed: [
            {
              ok: true,
              source: 'orphan_recovery',
              ...recovered,
            },
          ],
        });
      }
    }

    return Response.json({
      ok: processed.every((entry) => entry.ok !== false),
      workerKind: 'eval-worker',
      claimed: processed.length > 0,
      processedCount: processed.length,
      processed,
      message:
        processed.length > 0
          ? undefined
          : 'No queued evaluation jobs are available.',
    });
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
    hostId,
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

function clampMaxJobs(rawValue: string | undefined): number {
  const parsed = rawValue ? Number(rawValue) : 5;
  if (!Number.isFinite(parsed) || parsed <= 0) return 5;
  return Math.min(parsed, 20);
}

async function runOrphanEvalRecovery(
  db: D1Database,
  now: string,
): Promise<Record<string, unknown> | null> {
  const draft = await db
    .prepare(
      `
        SELECT host_id
        FROM drafts
        WHERE status = 'queued_eval'
        ORDER BY created_at ASC
        LIMIT 1
      `,
    )
    .first<{ host_id: string }>();

  if (!draft?.host_id) {
    return null;
  }

  const result = await runEvalStep(db, draft.host_id, now);
  return {
    hostId: draft.host_id,
    ...result,
  };
}
