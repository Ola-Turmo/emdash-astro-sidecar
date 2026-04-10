import { claimNextJob, clampLeaseSeconds, completeJob, failJob } from '../../shared/job-runtime';
import {
  buildAutonomousDraftPrompt,
  buildDefaultProviderRegistry,
  buildFallbackDraftArtifact,
  countDraftWords,
  parseAutonomousDraftArtifact,
  resolveRoutingRuleFromEnvironment,
  selectProvider,
  type AutonomousDraftRequest,
  type AutonomousInternalLink,
  type AutonomousSourceExcerpt,
  type ProviderEnvironment,
} from '../../../../../packages/model-runtime/src/index';

interface Env {
  AUTONOMOUS_DB: D1Database;
  JOB_LEASE_SECONDS?: string;
  AUTONOMOUS_ALLOW_FALLBACK_DRAFTS?: string;
  DRAFT_MAX_OUTPUT_TOKENS?: string;
  AUTONOMOUS_PROVIDER_ID?: string;
  AUTONOMOUS_MODEL_ID?: string;
  AUTONOMOUS_FALLBACK_PROVIDER_ID?: string;
  AUTONOMOUS_FALLBACK_MODEL_ID?: string;
  THECLAWBAY_API_KEY?: string;
  THECLAWBAY_BASE_URL?: string;
  THECLAWBAY_MODEL?: string;
  MINIMAX_API_KEY?: string;
  MINIMAX_BASE_URL?: string;
  MINIMAX_MODEL?: string;
}

const WORKER_KIND = 'draft-worker';

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
      const result = await runDraftStep(env.AUTONOMOUS_DB, env, job, now);
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
  env: Env,
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

  const draftContext = await buildDraftRequest(db, job.payload.hostId, {
    topic: candidate.topic,
    hostName: host.host_name,
    siteUrl: host.site_url,
    basePath: host.base_path,
  });

  const maxOutputTokens = clampMaxTokens(env.DRAFT_MAX_OUTPUT_TOKENS);
  const allowFallbackDrafts = env.AUTONOMOUS_ALLOW_FALLBACK_DRAFTS === 'true';
  let providerId = 'fallback';
  let modelId = 'deterministic-fallback';
  let usedFallback = false;
  let artifact = buildFallbackDraftArtifact(draftContext);

  try {
    const providerEnv = getProviderEnvironment(env);
    const registry = await buildDefaultProviderRegistry(providerEnv);
    const rule = resolveRoutingRuleFromEnvironment(providerEnv, 'article_draft_generation');
    const provider = selectProvider(registry, rule);
    providerId = provider.descriptor.providerId;
    modelId = provider.descriptor.modelId;

    const generation = await provider.adapter.runAgentStep({
      taskType: 'article_draft_generation',
      prompt: buildAutonomousDraftPrompt(draftContext),
      temperature: 0.35,
      maxOutputTokens,
      metadata: {
        hostId: job.payload.hostId,
        runId: job.payload.runId,
        topicCandidateId: candidate.id,
      },
    });

    artifact = parseAutonomousDraftArtifact(generation.text, candidate.topic);
  } catch (error) {
    if (!allowFallbackDrafts) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`Draft generation failed without fallback enabled: ${message}`);
    }
    usedFallback = true;
  }

  const draftId = crypto.randomUUID();
  const slug = toSlug(candidate.topic);
  const qualityNotes = [...new Set(artifact.qualityNotes)].sort();

  await db
    .prepare(
      `
        INSERT INTO drafts (
          id,
          host_id,
          topic_candidate_id,
          slug,
          status,
          title,
          description,
          excerpt,
          provider_id,
          model_id,
          word_count,
          quality_notes_json
        )
        VALUES (?1, ?2, ?3, ?4, 'queued_eval', ?5, ?6, ?7, ?8, ?9, ?10, ?11)
      `,
    )
    .bind(
      draftId,
      job.payload.hostId,
      candidate.id,
      slug,
      artifact.title,
      artifact.description,
      artifact.excerpt,
      providerId,
      modelId,
      artifact.wordCount || countDraftWords(artifact.sections),
      JSON.stringify(qualityNotes),
    )
    .run();

  for (const [index, section] of artifact.sections.entries()) {
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
        INSERT INTO source_snapshots (
          id,
          host_id,
          run_id,
          source_document_id,
          snapshot_type,
          content_json
        )
        VALUES (?1, ?2, ?3, NULL, 'draft-generation', ?4)
      `,
    )
    .bind(
      crypto.randomUUID(),
      job.payload.hostId,
      job.payload.runId,
      JSON.stringify({
        draftId,
        topicCandidateId: candidate.id,
        providerId,
        modelId,
        usedFallback,
        sourceCount: draftContext.sourceExcerpts.length,
        internalLinkCount: draftContext.internalLinks.length,
        qualityNotes,
        createdAt: now,
      }),
    )
    .run();

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
    draftStatus: 'queued_eval',
    draftSectionsCreated: artifact.sections.length,
    topicCandidateId: candidate.id,
    providerId,
    modelId,
    usedFallback,
    qualityNotes,
  };
}

async function buildDraftRequest(
  db: D1Database,
  hostId: string,
  input: {
    topic: string;
    hostName: string;
    siteUrl: string;
    basePath: string;
  },
): Promise<AutonomousDraftRequest> {
  const sources = await db
    .prepare(
      `
        SELECT title, source_url, body_excerpt
        FROM source_documents
        WHERE host_id = ?1
        ORDER BY created_at DESC
        LIMIT 5
      `,
    )
    .bind(hostId)
    .all<{
      title: string | null;
      source_url: string | null;
      body_excerpt: string | null;
    }>();

  const publications = await db
    .prepare(
      `
        SELECT url
        FROM publications
        WHERE host_id = ?1
        ORDER BY published_at DESC
        LIMIT 3
      `,
    )
    .bind(hostId)
    .all<{ url: string }>();

  const internalLinks = buildInternalLinks(input.siteUrl, input.basePath, publications.results);
  const sourceExcerpts: AutonomousSourceExcerpt[] = sources.results.map((source) => ({
    title: source.title ?? `${input.hostName} kilde`,
    url: source.source_url,
    excerpt:
      source.body_excerpt ??
      `Kildesammendrag fra ${input.hostName}. Bruk denne informasjonen forsiktig og konkret.`,
  }));

  return {
    topic: input.topic,
    hostName: input.hostName,
    siteUrl: input.siteUrl,
    basePath: input.basePath,
    sourceExcerpts,
    internalLinks,
  };
}

function buildInternalLinks(
  siteUrl: string,
  basePath: string,
  publications: Array<{ url: string }>,
): AutonomousInternalLink[] {
  const guideRootUrl = new URL(normalizeBasePath(basePath), siteUrl).toString();
  const homepageUrl = new URL('/', siteUrl).toString();
  const links: AutonomousInternalLink[] = [
    {
      label: 'Kursoversikten på hovedsiden',
      url: homepageUrl,
      reason: 'brukes når leseren trenger hovedsiden eller riktig kurs',
    },
    {
      label: 'Guidesiden',
      url: guideRootUrl,
      reason: 'brukes når leseren trenger flere forklarende artikler',
    },
  ];

  for (const publication of publications) {
    links.push({
      label: 'Relatert guide',
      url: publication.url,
      reason: 'brukes når leseren bør gå videre til en nærliggende artikkel',
    });
  }

  return links.slice(0, 5);
}

function clampMaxTokens(rawValue: string | undefined): number {
  const parsed = rawValue ? Number(rawValue) : 1600;
  if (!Number.isFinite(parsed) || parsed <= 0) return 1600;
  return Math.min(Math.max(parsed, 600), 3200);
}

function getProviderEnvironment(env: Env): ProviderEnvironment {
  return {
    AUTONOMOUS_PROVIDER_ID: env.AUTONOMOUS_PROVIDER_ID,
    AUTONOMOUS_MODEL_ID: env.AUTONOMOUS_MODEL_ID,
    AUTONOMOUS_FALLBACK_PROVIDER_ID: env.AUTONOMOUS_FALLBACK_PROVIDER_ID,
    AUTONOMOUS_FALLBACK_MODEL_ID: env.AUTONOMOUS_FALLBACK_MODEL_ID,
    THECLAWBAY_API_KEY: env.THECLAWBAY_API_KEY,
    THECLAWBAY_BASE_URL: env.THECLAWBAY_BASE_URL,
    THECLAWBAY_MODEL: env.THECLAWBAY_MODEL,
    MINIMAX_API_KEY: env.MINIMAX_API_KEY,
    MINIMAX_BASE_URL: env.MINIMAX_BASE_URL,
    MINIMAX_MODEL: env.MINIMAX_MODEL,
  };
}

function normalizeBasePath(basePath: string): string {
  if (!basePath.startsWith('/')) return `/${basePath}/`;
  return basePath.endsWith('/') ? basePath : `${basePath}/`;
}

function toSlug(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
