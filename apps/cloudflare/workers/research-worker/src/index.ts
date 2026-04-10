import { claimNextJob, clampLeaseSeconds, completeJob, failJob } from '../../shared/job-runtime';

interface Env {
  AUTONOMOUS_DB: D1Database;
  JOB_LEASE_SECONDS?: string;
}

const WORKER_KIND = 'research-worker';

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

    try {
      const result = await runResearchStep(env.AUTONOMOUS_DB, job, now);
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
      const message = error instanceof Error ? error.message : 'Unknown research-worker error';
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

async function runResearchStep(
  db: D1Database,
  job: Awaited<ReturnType<typeof claimNextJob>> extends infer T ? Exclude<T, null> : never,
  now: string,
): Promise<Record<string, unknown>> {
  const host = await db
    .prepare(
      `
        SELECT host_name, site_url, base_path
        FROM hosts
        WHERE id = ?1
      `,
    )
    .bind(job.payload.hostId)
    .first<{ host_name: string; site_url: string; base_path: string }>();

  if (!host) {
    throw new Error(`Missing host record for ${job.payload.hostId}.`);
  }

  if (job.step === 'ingest_signals') {
    const sourceDocumentId = crypto.randomUUID();
    await db
      .prepare(
        `
          INSERT INTO source_documents (
            id,
            host_id,
            run_id,
            source_type,
            source_url,
            title,
            body_excerpt
          )
          VALUES (?1, ?2, ?3, 'host-homepage', ?4, ?5, ?6)
        `,
      )
      .bind(
        sourceDocumentId,
        job.payload.hostId,
        job.payload.runId,
        host.site_url,
        `${host.host_name} source capture`,
        `Initial source capture for ${host.host_name} mounted at ${host.base_path}.`,
      )
      .run();

    await db
      .prepare(
        `
          INSERT INTO source_snapshots (
            id,
            host_id,
            run_id,
            source_document_id,
            snapshot_type,
            content_json
          )
          VALUES (?1, ?2, ?3, ?4, 'host-config', ?5)
        `,
      )
      .bind(
        crypto.randomUUID(),
        job.payload.hostId,
        job.payload.runId,
        sourceDocumentId,
        JSON.stringify({
          hostName: host.host_name,
          siteUrl: host.site_url,
          basePath: host.base_path,
          requestedAt: job.payload.requestedAt,
        }),
      )
      .run();

    return {
      status: 'completed',
      step: job.step,
      sourceDocumentsCreated: 1,
      sourceSnapshotsCreated: 1,
    };
  }

  if (job.step === 'discover_topics') {
    const seededTopics = [
      `Hva må du kunne før du går opp til prøven hos ${host.host_name}?`,
      `Vanlige feil kandidater gjør før de kjøper kurs eller går opp til prøve`,
      `Hvordan forberede seg effektivt til kommunens prøve med ${host.host_name}`,
    ];

    for (const topic of seededTopics) {
      await db
        .prepare(
          `
            INSERT INTO topic_candidates (id, host_id, topic, status, source)
            VALUES (?1, ?2, ?3, 'new', ?4)
          `,
        )
        .bind(crypto.randomUUID(), job.payload.hostId, topic, `run:${job.payload.runId}`)
        .run();
    }

    return {
      status: 'completed',
      step: job.step,
      topicCandidatesCreated: seededTopics.length,
    };
  }

  await db
    .prepare(
      `
        INSERT INTO source_snapshots (
          id,
          host_id,
          run_id,
          source_document_id,
          snapshot_type,
          content_json
        )
        VALUES (?1, ?2, ?3, NULL, ?4, ?5)
      `,
    )
    .bind(
      crypto.randomUUID(),
      job.payload.hostId,
      job.payload.runId,
      job.step,
      JSON.stringify({
        step: job.step,
        mode: job.payload.mode,
        requestedAt: job.payload.requestedAt,
        note: 'Bounded research-step placeholder snapshot',
      }),
    )
    .run();

  return {
    status: 'completed',
    step: job.step,
    sourceSnapshotsCreated: 1,
  };
}
