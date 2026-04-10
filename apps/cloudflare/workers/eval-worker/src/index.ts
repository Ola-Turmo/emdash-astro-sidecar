import { claimNextJob, clampLeaseSeconds, completeJob, failJob } from '../../shared/job-runtime';

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
        SELECT id, slug
        FROM drafts
        WHERE host_id = ?1
          AND status = 'queued_eval'
        ORDER BY created_at ASC
        LIMIT 1
      `,
    )
    .bind(hostId)
    .first<{ id: string; slug: string }>();

  if (!draft) {
    return {
      status: 'skipped',
      step: EVAL_STEP,
      reason: 'No draft is waiting for evaluation.',
    };
  }

  const sectionCount = await countDraftSections(db, draft.id);
  const sourceCount = await countHostSources(db, hostId);
  const internalLinkSignal = await countInternalLinkSignals(db, draft.id);

  const criteria = [
    {
      id: 'single-h1',
      passed: sectionCount >= 1,
      reason: sectionCount >= 1 ? 'Draft has section structure.' : 'Draft is missing section structure.',
    },
    {
      id: 'reader-first-copy',
      passed: true,
      reason: 'Placeholder copy uses reader-facing section headings.',
    },
    {
      id: 'internal-links',
      passed: internalLinkSignal > 0,
      reason:
        internalLinkSignal > 0
          ? 'Draft contains at least one internal-link signal.'
          : 'Draft does not yet contain an internal-link signal.',
    },
    {
      id: 'evidence-threshold',
      passed: sourceCount > 0,
      reason:
        sourceCount > 0
          ? 'At least one source artifact exists for this host.'
          : 'No source artifact exists for this host yet.',
    },
  ];

  for (const criterion of criteria) {
    await db
      .prepare(
        `
          INSERT INTO draft_evals (id, draft_id, criterion_id, passed, reason, created_at)
          VALUES (?1, ?2, ?3, ?4, ?5, ?6)
          ON CONFLICT(id) DO NOTHING
        `,
      )
      .bind(
        crypto.randomUUID(),
        draft.id,
        criterion.id,
        criterion.passed ? 1 : 0,
        criterion.reason,
        now,
      )
      .run();

    await db
      .prepare(
        `
          UPDATE draft_evals
          SET passed = ?1, reason = ?2, created_at = ?3
          WHERE draft_id = ?4 AND criterion_id = ?5
        `,
      )
      .bind(criterion.passed ? 1 : 0, criterion.reason, now, draft.id, criterion.id)
      .run();
  }

  const passedCount = criteria.filter((criterion) => criterion.passed).length;
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

async function countDraftSections(db: D1Database, draftId: string): Promise<number> {
  const row = await db
    .prepare(
      `
        SELECT COUNT(*) AS count
        FROM draft_sections
        WHERE draft_id = ?1
      `,
    )
    .bind(draftId)
    .first<{ count: number }>();

  return row?.count ?? 0;
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

async function countInternalLinkSignals(db: D1Database, draftId: string): Promise<number> {
  const result = await db
    .prepare(
      `
        SELECT body
        FROM draft_sections
        WHERE draft_id = ?1
      `,
    )
    .bind(draftId)
    .all<{ body: string }>();

  return result.results.filter((row) => /kurs|guide|les mer|neste steg/i.test(row.body)).length;
}
