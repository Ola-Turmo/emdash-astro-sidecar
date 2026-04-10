import {
  buildExecutionEnvelope,
  defaultCloudflareGuardrails,
  parseCloudflareGuardMode,
  parseCloudflarePlanTier,
} from '../../../../../packages/cloudflare-guardrails/src/index';

interface Env {
  CF_PLAN_TIER?: string;
  CF_RESOURCE_GUARD_MODE?: string;
  BROWSER_AUDIT_ENABLED?: string;
  MAX_AUDIT_URLS_PER_RUN?: string;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const targets = collectTargets(url);

    if (targets.length === 0) {
      return Response.json(
        {
          ok: false,
          error: 'Missing ?target=<url> or ?targets=url1,url2',
        },
        { status: 400 },
      );
    }

    const guardrails = defaultCloudflareGuardrails(
      parseCloudflarePlanTier(env.CF_PLAN_TIER),
      parseCloudflareGuardMode(env.CF_RESOURCE_GUARD_MODE),
    );
    const requestedLimit = env.MAX_AUDIT_URLS_PER_RUN ? Number(env.MAX_AUDIT_URLS_PER_RUN) : undefined;
    const executionEnvelope = buildExecutionEnvelope(guardrails, {
      hostMode: 'draft_only',
      requestedAuditUrls:
        requestedLimit && Number.isFinite(requestedLimit) && requestedLimit > 0
          ? Math.min(targets.length, requestedLimit)
          : targets.length,
      requestedHostRuns: 1,
    });

    const browserAuditEnabled =
      env.BROWSER_AUDIT_ENABLED === 'true' && executionEnvelope.browserAuditEnabled;

    if (!browserAuditEnabled) {
      return Response.json(
        {
          ok: false,
          error: 'Browser audit is disabled by Cloudflare resource guardrails.',
          guardrails,
          executionEnvelope,
        },
        { status: 503 },
      );
    }

    if (targets.length > executionEnvelope.allowedAuditUrlsThisRun) {
      return Response.json(
        {
          ok: false,
          error: `Requested ${targets.length} targets, capped at ${executionEnvelope.allowedAuditUrlsThisRun}.`,
          guardrails,
          executionEnvelope,
        },
        { status: 429 },
      );
    }

    return Response.json({
      ok: true,
      targets,
      guardrails,
      executionEnvelope,
      note: 'Guardrailed browser audit scaffold. Next implementation pass should integrate Browser Rendering screenshots and DOM checks behind the same execution envelope.',
    });
  },
};

function collectTargets(url: URL): string[] {
  const directTargets = url.searchParams.getAll('target');
  const csvTargets = (url.searchParams.get('targets') ?? '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);

  return [...new Set([...directTargets, ...csvTargets])];
}
