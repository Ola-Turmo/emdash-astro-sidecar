import { claimNextJob, clampLeaseSeconds, completeJob, failJob } from '../../shared/job-runtime';
import {
  buildAutonomousDraftPrompt,
  buildDefaultProviderRegistry,
  buildFallbackDraftArtifact,
  buildSemanticSlug,
  countDraftWords,
  normalizeSearchText,
  normalizeAutonomousDraftArtifact,
  parseAutonomousDraftArtifact,
  resolveRoutingRuleFromEnvironment,
  salvageAutonomousDraftArtifact,
  selectProvider,
  type AutonomousDraftArtifact,
  type AutonomousDraftRequest,
  type AutonomousInternalLink,
  type AutonomousSourceExcerpt,
  type ProviderAdapter,
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
  THECLAWBAY_REASONING_EFFORT?: string;
  GEMINI_API_KEY?: string;
  GEMINI_BASE_URL?: string;
  GEMINI_MODEL?: string;
  MINIMAX_API_KEY?: string;
  MINIMAX_BASE_URL?: string;
  MINIMAX_MODEL?: string;
}

const WORKER_KIND = 'draft-worker';
const DRAFT_ARTIFACT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    title: { type: 'string' },
    description: { type: 'string' },
    excerpt: { type: 'string' },
    sections: {
      type: 'array',
      minItems: 3,
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          heading: { type: 'string' },
          body: { type: 'string' },
        },
        required: ['heading', 'body'],
      },
    },
    suggestedTags: {
      type: 'array',
      items: { type: 'string' },
    },
  },
  required: ['title', 'description', 'excerpt', 'sections', 'suggestedTags'],
} as const;

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method !== 'POST') {
      return new Response('Method Not Allowed', { status: 405 });
    }

    const now = new Date().toISOString();
    const body = (await request.json().catch(() => ({}))) as {
      hostId?: string;
    };

    if (body.hostId) {
      const result = await runDraftStepForHost(env.AUTONOMOUS_DB, env, body.hostId, now);
      return Response.json({
        ok: true,
        workerKind: WORKER_KIND,
        claimed: false,
        processed: [
          {
            source: 'direct_host_draft',
            hostId: body.hostId,
            result,
          },
        ],
      });
    }

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
  return runDraftStepForHost(db, env, job.payload.hostId, now, job.payload.runId);
}

async function runDraftStepForHost(
  db: D1Database,
  env: Env,
  hostId: string,
  now: string,
  runId: string = crypto.randomUUID(),
): Promise<Record<string, unknown>> {
  const host = await db
    .prepare(
      `
        SELECT host_name, site_url, base_path
        FROM hosts
        WHERE id = ?1
      `,
    )
    .bind(hostId)
    .first<{ host_name: string; site_url: string; base_path: string }>();

  if (!host) {
    throw new Error(`Missing host record for ${hostId}.`);
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
    .bind(hostId)
    .first<{ id: string; topic: string }>();

  if (!candidate) {
    return {
      status: 'skipped',
      step: 'draft_candidates',
      reason: 'No new topic candidate available.',
    };
  }

  const draftContext = await buildDraftRequest(db, hostId, {
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
  const providerTrace: Array<Record<string, unknown>> = [];

  try {
    const providerEnv = getProviderEnvironment(env);
    const registry = await buildDefaultProviderRegistry(providerEnv);
    const rule = resolveRoutingRuleFromEnvironment(providerEnv, 'article_draft_generation');
    const provider = selectProvider(registry, rule);
    providerId = provider.descriptor.providerId;
    modelId = provider.descriptor.modelId;

    const generation = await provider.adapter.generateStructured({
      schemaName: 'autonomous_draft_artifact',
      schema: DRAFT_ARTIFACT_SCHEMA,
      system:
        'You produce valid JSON only. Escape newlines and quotation marks correctly. Do not add commentary before or after the JSON.',
      prompt: buildAutonomousDraftPrompt(draftContext),
      temperature: 0.15,
      maxOutputTokens,
      metadata: {
        hostId,
        runId,
        topicCandidateId: candidate.id,
      },
    });
    providerTrace.push({
      phase: 'generate',
      providerId,
      modelId,
      text: truncateTrace(generation.text),
    });

    artifact = await parseOrRepairArtifact(provider.adapter, generation.text, candidate.topic, draftContext);
    artifact = normalizeAutonomousDraftArtifact(artifact, draftContext);
    providerTrace.push({
      phase: 'parsed',
      providerId,
      modelId,
      wordCount: artifact.wordCount,
      qualityNotes: artifact.qualityNotes,
    });

    artifact = await reviseArtifactForQuality(provider.adapter, artifact, draftContext, candidate.topic);
    artifact = normalizeAutonomousDraftArtifact(artifact, draftContext);
    providerTrace.push({
      phase: 'revised',
      providerId,
      modelId,
      wordCount: artifact.wordCount,
      qualityNotes: artifact.qualityNotes,
    });
  } catch (error) {
    await persistDraftTrace(db, {
      hostId,
      runId,
      snapshotType: 'draft-generation-error',
      content: {
        topicCandidateId: candidate.id,
        providerId,
        modelId,
        trace: providerTrace,
        error: error instanceof Error ? error.message : String(error),
      },
      now,
    });

    if (!allowFallbackDrafts) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`Draft generation failed without fallback enabled: ${message}`);
    }
    usedFallback = true;
  }

  const draftId = crypto.randomUUID();
  const slug = buildSemanticSlug(candidate.topic, {
    fallback: artifact.title || candidate.topic,
  });
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
      hostId,
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

  await persistDraftTrace(db, {
    hostId,
    runId,
    snapshotType: 'draft-generation',
    content: {
      draftId,
      topicCandidateId: candidate.id,
      providerId,
      modelId,
      usedFallback,
      sourceCount: draftContext.sourceExcerpts.length,
      internalLinkCount: draftContext.internalLinks.length,
      qualityNotes,
      trace: providerTrace,
    },
    now,
  });

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
    step: 'draft_candidates',
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

async function parseOrRepairArtifact(
  adapter: ProviderAdapter,
  responseText: string,
  topic: string,
  draftContext: AutonomousDraftRequest,
): Promise<AutonomousDraftArtifact> {
  try {
    return parseAutonomousDraftArtifact(responseText, topic);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    try {
      const repair = await adapter.generateStructured({
        schemaName: 'autonomous_draft_artifact_repair',
        schema: DRAFT_ARTIFACT_SCHEMA,
        system:
          'Repair malformed model output into valid JSON that matches the schema exactly. Preserve meaning, remove stray commentary, and return JSON only.',
        prompt: [
          `Tema: ${topic}`,
          'Opprinnelig respons som må repareres:',
          responseText,
          '',
          `Parser-feil: ${message}`,
        ].join('\n'),
        temperature: 0.1,
        maxOutputTokens: 1800,
      });

      return parseAutonomousDraftArtifact(repair.text, topic);
    } catch {
      return salvageAutonomousDraftArtifact(responseText, topic, draftContext.internalLinks);
    }
  }
}

async function reviseArtifactForQuality(
  adapter: ProviderAdapter,
  artifact: AutonomousDraftArtifact,
  draftContext: AutonomousDraftRequest,
  topic: string,
): Promise<AutonomousDraftArtifact> {
  const deficits = collectArtifactDeficits(artifact);
  if (deficits.length === 0) {
    return artifact;
  }

  try {
    const revised = await adapter.generateStructured({
      schemaName: 'autonomous_draft_artifact_revision',
      schema: DRAFT_ARTIFACT_SCHEMA,
      system:
        'Revise the article so it becomes more complete and reader-friendly. Return valid JSON only. Keep the language Norwegian, concrete, and free of internal jargon.',
      prompt: [
        `Tema: ${topic}`,
        'Denne artikkelen må forbedres før den kan godkjennes.',
        `Manglene som må løses: ${deficits.join('; ')}.`,
        '',
        'Tillatte interne lenker som må brukes naturlig i teksten:',
        ...draftContext.internalLinks.map((link) => `- ${link.label}: ${link.url}`),
        '',
        'Nåværende artikkelutkast:',
        JSON.stringify(artifact),
        '',
        'Krav:',
        '- minst 4 korte, konkrete seksjoner hvis nødvendig for å nå dybdekravet',
        '- minst to interne markdown-lenker til vertssidens sider',
        '- minst 320 ord totalt',
        '- tydelig første svar og tydelig siste neste steg',
      ].join('\n'),
      temperature: 0.15,
      maxOutputTokens: 2200,
    });

    return parseOrRepairArtifact(adapter, revised.text, topic, draftContext);
  } catch {
    return artifact;
  }
}

async function persistDraftTrace(
  db: D1Database,
  input: {
    hostId: string;
    runId: string;
    snapshotType: string;
    content: Record<string, unknown>;
    now: string;
  },
): Promise<void> {
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
      input.hostId,
      input.runId,
      input.snapshotType,
      JSON.stringify({
        ...input.content,
        createdAt: input.now,
      }),
    )
    .run();
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
    title: normalizeSearchText(source.title ?? `${input.hostName} kilde`),
    url: source.source_url,
    excerpt: normalizeSearchText(
      source.body_excerpt ??
        `Kildesammendrag fra ${input.hostName}. Bruk denne informasjonen forsiktig og konkret.`,
    ),
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

function collectArtifactDeficits(artifact: AutonomousDraftArtifact): string[] {
  const visibleText = artifact.sections.map((section) => section.body).join('\n\n');
  const internalLinkCount = [...visibleText.matchAll(/\[[^\]]+\]\(([^)]+)\)/g)].length;
  const deficits: string[] = [];

  if (artifact.sections.length < 3) {
    deficits.push('for få seksjoner');
  }
  if ((artifact.wordCount || countDraftWords(artifact.sections)) < 320) {
    deficits.push('for lite innhold');
  }
  if (internalLinkCount < 2) {
    deficits.push('mangler nok interne lenker');
  }
  if (artifact.qualityNotes.some((note) => note.startsWith('contains-banned-term:'))) {
    deficits.push('synlig tekst inneholder intern terminologi');
  }

  return deficits;
}

function clampMaxTokens(rawValue: string | undefined): number {
  const parsed = rawValue ? Number(rawValue) : 1600;
  if (!Number.isFinite(parsed) || parsed <= 0) return 1600;
  return Math.min(Math.max(parsed, 600), 3200);
}

function truncateTrace(value: string): string {
  if (value.length <= 6000) return value;
  return `${value.slice(0, 6000)}\n...[truncated]`;
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
    THECLAWBAY_REASONING_EFFORT: env.THECLAWBAY_REASONING_EFFORT,
    GEMINI_API_KEY: env.GEMINI_API_KEY,
    GEMINI_BASE_URL: env.GEMINI_BASE_URL,
    GEMINI_MODEL: env.GEMINI_MODEL,
    MINIMAX_API_KEY: env.MINIMAX_API_KEY,
    MINIMAX_BASE_URL: env.MINIMAX_BASE_URL,
    MINIMAX_MODEL: env.MINIMAX_MODEL,
  };
}

function normalizeBasePath(basePath: string): string {
  if (!basePath.startsWith('/')) return `/${basePath}/`;
  return basePath.endsWith('/') ? basePath : `${basePath}/`;
}

function toSafeSlug(value: string): string {
  return value
    .replace(/[\u00E6\u00C6]/g, 'ae')
    .replace(/[\u00F8\u00D8]/g, 'o')
    .replace(/[\u00E5\u00C5]/g, 'a')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function toSlug(value: string): string {
  return value
    .replace(/[æÆ]/g, 'ae')
    .replace(/[øØ]/g, 'o')
    .replace(/[åÅ]/g, 'a')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
