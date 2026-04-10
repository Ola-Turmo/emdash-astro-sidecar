import { nextLeaseExpiry, workerSupportsStep, type HostJobPayload, type HostJobRow, type HostWorkerKind } from '@emdash/host-jobs';

export async function claimNextJob(
  db: D1Database,
  input: {
    workerKind: HostWorkerKind;
    leaseOwner: string;
    now: string;
    leaseSeconds: number;
  },
): Promise<(HostJobRow & { payload: HostJobPayload }) | null> {
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

  return {
    ...job,
    payload: JSON.parse(job.payload_json) as HostJobPayload,
  };
}

export async function completeJob(
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

export async function failJob(
  db: D1Database,
  jobId: string,
  leaseOwner: string,
  now: string,
  errorMessage: string,
): Promise<void> {
  await db
    .prepare(
      `
        UPDATE host_jobs
        SET
          status = 'failed',
          lease_owner = NULL,
          lease_expires_at = NULL,
          last_error = ?1,
          updated_at = ?2
        WHERE id = ?3 AND lease_owner = ?4
      `,
    )
    .bind(errorMessage, now, jobId, leaseOwner)
    .run();
}

export function clampLeaseSeconds(rawValue: string | undefined): number {
  const parsed = rawValue ? Number(rawValue) : 120;
  if (!Number.isFinite(parsed) || parsed <= 0) return 120;
  return Math.min(parsed, 900);
}
