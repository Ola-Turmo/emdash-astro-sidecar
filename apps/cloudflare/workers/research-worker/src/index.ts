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
      const result = await runResearchStep(env.AUTONOMOUS_DB, job);
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
    const sourceDocumentsCreated = await ingestHostPages(db, job, host);
    return {
      status: 'completed',
      step: job.step,
      sourceDocumentsCreated,
      sourceSnapshotsCreated: sourceDocumentsCreated,
    };
  }

  if (job.step === 'discover_topics') {
    const topicCandidatesCreated = await discoverHostTopics(db, job, host);
    return {
      status: 'completed',
      step: job.step,
      topicCandidatesCreated,
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

async function ingestHostPages(
  db: D1Database,
  job: Awaited<ReturnType<typeof claimNextJob>> extends infer T ? Exclude<T, null> : never,
  host: { host_name: string; site_url: string; base_path: string },
): Promise<number> {
  const urls = buildResearchUrls(host.site_url, host.base_path);
  let created = 0;

  for (const candidate of urls) {
    const snapshot = await fetchPageSnapshot(candidate.url);
    if (!snapshot) continue;

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
          VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)
        `,
      )
      .bind(
        sourceDocumentId,
        job.payload.hostId,
        job.payload.runId,
        candidate.sourceType,
        candidate.url,
        snapshot.title || `${host.host_name} kilde`,
        snapshot.bodyExcerpt,
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
          VALUES (?1, ?2, ?3, ?4, 'host-page', ?5)
        `,
      )
      .bind(
        crypto.randomUUID(),
        job.payload.hostId,
        job.payload.runId,
        sourceDocumentId,
        JSON.stringify({
          url: candidate.url,
          sourceType: candidate.sourceType,
          title: snapshot.title,
          metaDescription: snapshot.metaDescription,
          h1: snapshot.h1,
          bodyExcerpt: snapshot.bodyExcerpt,
          firstPartyLinks: snapshot.firstPartyLinks,
        }),
      )
      .run();

    created += 1;
  }

  return created;
}

async function discoverHostTopics(
  db: D1Database,
  job: Awaited<ReturnType<typeof claimNextJob>> extends infer T ? Exclude<T, null> : never,
  host: { host_name: string; site_url: string; base_path: string },
): Promise<number> {
  const sources = await db
    .prepare(
      `
        SELECT title, source_url, body_excerpt
        FROM source_documents
        WHERE host_id = ?1
        ORDER BY created_at DESC
        LIMIT 12
      `,
    )
    .bind(job.payload.hostId)
    .all<{ title: string | null; source_url: string | null; body_excerpt: string | null }>();

  const topics = deriveTopicCandidates(host.host_name, sources.results);
  let created = 0;

  for (const topic of topics) {
    const existing = await db
      .prepare(
        `
          SELECT id
          FROM topic_candidates
          WHERE host_id = ?1
            AND topic = ?2
          LIMIT 1
        `,
      )
      .bind(job.payload.hostId, topic)
      .first<{ id: string }>();

    if (existing) continue;

    await db
      .prepare(
        `
          INSERT INTO topic_candidates (id, host_id, topic, status, source)
          VALUES (?1, ?2, ?3, 'new', ?4)
        `,
      )
      .bind(crypto.randomUUID(), job.payload.hostId, topic, `source-run:${job.payload.runId}`)
      .run();

    created += 1;
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
        VALUES (?1, ?2, ?3, NULL, 'topic-discovery', ?4)
      `,
    )
    .bind(
      crypto.randomUUID(),
      job.payload.hostId,
      job.payload.runId,
      JSON.stringify({
        topics,
        sourceCount: sources.results.length,
      }),
    )
    .run();

  return created;
}

function buildResearchUrls(siteUrl: string, basePath: string): Array<{ url: string; sourceType: string }> {
  const candidates = [
    { url: new URL('/', siteUrl).toString(), sourceType: 'host-homepage' },
    { url: new URL(normalizeBasePath(basePath), siteUrl).toString(), sourceType: 'host-guide-root' },
    { url: new URL('/etablererproven', siteUrl).toString(), sourceType: 'host-course-page' },
    { url: new URL('/skjenkebevilling', siteUrl).toString(), sourceType: 'host-course-page' },
    { url: new URL('/salgsbevilling', siteUrl).toString(), sourceType: 'host-course-page' },
  ];

  return [...new Map(candidates.map((entry) => [entry.url, entry])).values()];
}

async function fetchPageSnapshot(url: string): Promise<{
  title: string;
  metaDescription: string;
  h1: string;
  bodyExcerpt: string;
  firstPartyLinks: string[];
} | null> {
  try {
    const response = await fetch(url, {
      headers: {
        'user-agent': 'EmDashResearchWorker/1.0',
      },
    });
    if (!response.ok) return null;
    const html = await response.text();
    return extractHtmlSnapshot(html, url);
  } catch {
    return null;
  }
}

function extractHtmlSnapshot(
  html: string,
  url: string,
): {
  title: string;
  metaDescription: string;
  h1: string;
  bodyExcerpt: string;
  firstPartyLinks: string[];
} {
  const title = html.match(/<title[^>]*>(.*?)<\/title>/is)?.[1]?.replace(/\s+/g, ' ').trim() ?? '';
  const metaDescription =
    html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i)?.[1]?.trim() ?? '';
  const h1 =
    html.match(/<h1[^>]*>(.*?)<\/h1>/is)?.[1]?.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim() ??
    '';
  const bodyExcerpt = stripHtmlToText(html).slice(0, 420).trim();
  const origin = new URL(url).origin;
  const firstPartyLinks = [...html.matchAll(/<a[^>]+href=["']([^"']+)["']/gi)]
    .map((match) => match[1] ?? '')
    .filter((href) => href.startsWith('/') || href.startsWith(origin))
    .slice(0, 10);

  return {
    title,
    metaDescription,
    h1,
    bodyExcerpt,
    firstPartyLinks,
  };
}

function stripHtmlToText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ');
}

function deriveTopicCandidates(
  hostName: string,
  sources: Array<{ title: string | null; source_url: string | null; body_excerpt: string | null }>,
): string[] {
  const corpus = sources
    .map((source) => `${source.title ?? ''} ${source.source_url ?? ''} ${source.body_excerpt ?? ''}`.toLowerCase())
    .join(' ');

  const topics = new Set<string>();
  if (corpus.includes('etablerer')) {
    topics.add('Hva må du kunne til etablererprøven?');
    topics.add('Hvor lang tid tar det å forberede seg til etablererprøven?');
  }
  if (corpus.includes('skjenk')) {
    topics.add('Hva må du kunne før skjenkebevillingsprøven?');
    topics.add('Vanlige feil kandidater gjør på skjenkebevillingsprøven');
  }
  if (corpus.includes('salgs')) {
    topics.add('Hva må du kunne til salgsbevillingens prøve?');
    topics.add('Forskjellen på salgsbevilling og skjenkebevilling');
  }

  topics.add(`Hva bør du vite før du velger kurs hos ${hostName}?`);
  topics.add('Hva er den raskeste måten å forberede seg til kommunens prøve?');

  return [...topics];
}

function normalizeBasePath(basePath: string): string {
  if (!basePath.startsWith('/')) return `/${basePath}/`;
  return basePath.endsWith('/') ? basePath : `${basePath}/`;
}
