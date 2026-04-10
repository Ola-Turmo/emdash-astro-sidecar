import { nextLeaseExpiry, workerSupportsStep, type HostJobRow } from '@emdash/host-jobs';

interface Env {
  AUTONOMOUS_DB: D1Database;
  JOB_LEASE_SECONDS?: string;
}

const WORKER_KIND = 'research-worker';
const RESEARCH_RESULT = {
  status: 'stubbed',
  note: 'Research worker scaffold completed the job. Next pass should attach actual signal ingestion and topic discovery work.',
};

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
    });

    if (!job) {
      return Response.json({
        ok: true,
        workerKind: WORKER_KIND,
        claimed: false,
        message: 'No queued research jobs are available.',
      });
    }

    await completeJob(env.AUTONOMOUS_DB, job.id, leaseOwner, now, RESEARCH_RESULT);

    return Response.json({
      ok: true,
      workerKind: WORKER_KIND,
      claimed: true,
      jobId: job.id,
      step: job.step,
      result: RESEARCH_RESULT,
    });
  },
};

async function claimNextJob(
  db: D1Database,
  input: {
    workerKind: 'research-worker';
    leaseOwner: string;
    now: string;
    leaseSeconds: number;
  },
): Promise<HostJobRow | null> {
  const result = await db
    .prepare(
      `
        SELECT
          id,
          host_id,
          run_id,
          step,
          worker_kind,
          status,
          priority,
          payload_json,
          attempt_count,
          lease_owner,
          lease_expires_at,
          last_error,
          created_at,
          updated_at
        FROM host_jobs
        WHERE worker_kind = ?1
          AND status = 'queued'
        ORDER BY priority ASC, created_at ASC
        LIMIT 1
      `,
    )
    .bind(input.workerKind)
    .all<HostJobRow>();

  const job = result.results[0] ?? null;
  if (!job || !workerSupportsStep(input.workerKind, job.step)) {
    return null;
  }

  await db
    .prepare(
      `
        UPDATE host_jobs
        SET
          status = 'running',
          attempt_count = attempt_count + 1,
          lease_owner = ?1,
          lease_expires_at = ?2,
          updated_at = ?3
        WHERE id = ?4
      `,
    )
    .bind(input.leaseOwner, nextLeaseExpiry(input.now, input.leaseSeconds), input.now, job.id)
    .run();

  return job;
}

async function completeJob(
  db: D1Database,
  jobId: string,
  leaseOwner: string,
  now: string,
  result: Record<string, unknown>,
): Promise<void> {
  await db
    .prepare(
      `
        UPDATE host_jobs
        SET
          status = 'completed',
          lease_owner = NULL,
          lease_expires_at = NULL,
          last_error = ?1,
          updated_at = ?2
        WHERE id = ?3 AND lease_owner = ?4
      `,
    )
    .bind(JSON.stringify(result), now, jobId, leaseOwner)
    .run();
}

function clampLeaseSeconds(rawValue: string | undefined): number {
  const parsed = rawValue ? Number(rawValue) : 120;
  if (!Number.isFinite(parsed) || parsed <= 0) return 120;
  return Math.min(parsed, 900);
}
