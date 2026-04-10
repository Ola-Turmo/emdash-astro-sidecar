import { claimNextJob, clampLeaseSeconds, completeJob, failJob } from '../../shared/job-runtime';

interface Env {
  AUTONOMOUS_DB: D1Database;
  JOB_LEASE_SECONDS?: string;
}

const WORKER_KIND = 'draft-worker';
const DEFAULT_CRITERION_IDS = [
  'single-h1',
  'reader-first-copy',
  'internal-links',
  'evidence-threshold',
];

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
      supportedSteps: ['draft_candidates'],
    });

    if (!job) {
      return Response.json({
        ok: true,
        workerKind: WORKER_KIND,
        claimed: false,
        message: 'No queued draft jobs are available.',
      });
    }

    try {
      const result = await runDraftStep(env.AUTONOMOUS_DB, job, now);
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
      const message = error instanceof Error ? error.message : 'Unknown draft-worker error';
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

async function runDraftStep(
  db: D1Database,
  job: Awaited<ReturnType<typeof claimNextJob>> extends infer T ? Exclude<T, null> : never,
  now: string,
): Promise<Record<string, unknown>> {
  if (job.step === 'draft_candidates') {
    const candidate = await db
      .prepare(
        `
          SELECT id, topic
          FROM topic_candidates
          WHERE host_id = ?1
            AND status = 'new'
          ORDER BY created_at ASC
          LIMIT 1
        `,
      )
      .bind(job.payload.hostId)
      .first<{ id: string; topic: string }>();

    if (!candidate) {
      return {
        status: 'skipped',
        step: job.step,
        reason: 'No new topic candidate available.',
      };
    }

    const draftId = crypto.randomUUID();
    const slug = toSlug(candidate.topic);
    await db
      .prepare(
        `
          INSERT INTO drafts (id, host_id, topic_candidate_id, slug, status)
          VALUES (?1, ?2, ?3, ?4, 'draft')
        `,
      )
      .bind(draftId, job.payload.hostId, candidate.id, slug)
      .run();

    const sections = [
      {
        heading: 'Hva du må vite først',
        body: `Denne delen forklarer hovedspørsmålet rundt "${candidate.topic}" på en konkret og lesbar måte.`,
      },
      {
        heading: 'Vanlige feil og misforståelser',
        body: 'Denne delen peker ut typiske feil og gir leseren et bedre beslutningsgrunnlag.',
      },
      {
        heading: 'Hva du bør gjøre videre',
        body: 'Denne delen peker leseren videre til riktig kurs, riktig neste steg eller videre lesing.',
      },
    ];

    for (const [index, section] of sections.entries()) {
      await db
        .prepare(
          `
            INSERT INTO draft_sections (id, draft_id, section_order, heading, body)
            VALUES (?1, ?2, ?3, ?4, ?5)
          `,
        )
        .bind(crypto.randomUUID(), draftId, index + 1, section.heading, section.body)
        .run();
    }

    await db
      .prepare(
        `
          UPDATE topic_candidates
          SET status = 'drafted'
          WHERE id = ?1
        `,
      )
      .bind(candidate.id)
      .run();

    return {
      status: 'completed',
      step: job.step,
      draftId,
      draftSectionsCreated: sections.length,
      topicCandidateId: candidate.id,
    };
  }

  const draft = await db
    .prepare(
      `
        SELECT id
        FROM drafts
        WHERE host_id = ?1
          AND status = 'draft'
        ORDER BY created_at ASC
        LIMIT 1
      `,
    )
    .bind(job.payload.hostId)
    .first<{ id: string }>();

  if (!draft) {
    return {
      status: 'skipped',
      step: job.step,
      reason: 'No draft available for evaluation.',
    };
  }

  for (const criterionId of DEFAULT_CRITERION_IDS) {
    await db
      .prepare(
        `
          INSERT INTO draft_evals (id, draft_id, criterion_id, passed, reason)
          VALUES (?1, ?2, ?3, 0, ?4)
        `,
      )
      .bind(
        crypto.randomUUID(),
        draft.id,
        criterionId,
        'Placeholder eval seeded by draft-worker. Actual evaluation step still pending.',
      )
      .run();
  }

  await db
    .prepare(
      `
        UPDATE drafts
        SET status = 'queued_eval'
        WHERE id = ?1
      `,
    )
    .bind(draft.id)
    .run();

  return {
    status: 'completed',
    step: job.step,
    draftId: draft.id,
    draftEvalRowsCreated: DEFAULT_CRITERION_IDS.length,
  };
}

function toSlug(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}
