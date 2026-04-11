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

interface AuditResult {
  url: string;
  status: number | null;
  finalUrl: string | null;
  title: string;
  metaDescription: string;
  canonical: string;
  h1: string[];
  h1Count: number;
  internalLinks: number;
  externalLinks: number;
  imageCount: number;
  missingAlt: number;
  wordCount: number;
  findings: string[];
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
    const allowedTargets =
      requestedLimit && Number.isFinite(requestedLimit) && requestedLimit > 0
        ? requestedLimit
        : Math.max(1, Number(env.MAX_AUDIT_URLS_PER_RUN ?? '1'));

    if (targets.length > allowedTargets) {
      return Response.json(
        {
          ok: false,
          error: `Requested ${targets.length} targets, capped at ${allowedTargets}.`,
          guardrails,
          executionEnvelope,
        },
        { status: 429 },
      );
    }

    const results: AuditResult[] = [];
    for (const target of targets) {
      results.push(await auditTarget(target));
    }

    const payload = {
      ok: true,
      targets,
      guardrails,
      executionEnvelope,
      generatedAt: new Date().toISOString(),
      results,
    };

    if (url.searchParams.get('format') === 'markdown') {
      return new Response(renderMarkdown(payload), {
        headers: {
          'content-type': 'text/markdown; charset=utf-8',
          'cache-control': 'no-store',
        },
      });
    }

    return Response.json(payload);
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

async function auditTarget(target: string): Promise<AuditResult> {
  try {
    const response = await fetch(target, {
      redirect: 'follow',
      headers: {
        'user-agent': 'EmDashBrowserAuditWorker/1.0',
      },
    });
    const finalUrl = response.url;
    const html = await response.text();
    const parsed = parseHtmlAudit(html, finalUrl);

    return {
      url: target,
      status: response.status,
      finalUrl,
      ...parsed,
      findings: buildFindings(response.status, finalUrl, parsed),
    };
  } catch (error) {
    return {
      url: target,
      status: null,
      finalUrl: null,
      title: '',
      metaDescription: '',
      canonical: '',
      h1: [],
      h1Count: 0,
      internalLinks: 0,
      externalLinks: 0,
      imageCount: 0,
      missingAlt: 0,
      wordCount: 0,
      findings: [`Audit failed: ${error instanceof Error ? error.message : String(error)}`],
    };
  }
}

function parseHtmlAudit(html: string, finalUrl: string) {
  const title = html.match(/<title[^>]*>(.*?)<\/title>/is)?.[1]?.replace(/\s+/g, ' ').trim() ?? '';
  const metaDescription =
    html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i)?.[1]?.trim() ?? '';
  const canonicalRaw =
    html.match(/<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)["']/i)?.[1]?.trim() ?? '';
  const canonical = canonicalRaw ? new URL(canonicalRaw, finalUrl).toString() : '';
  const h1 = [...html.matchAll(/<h1[^>]*>(.*?)<\/h1>/gis)]
    .map((match) => (match[1] ?? '').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim())
    .filter(Boolean);
  const links = [...html.matchAll(/<a[^>]+href=["']([^"']+)["']/gi)].map((match) => match[1] ?? '');
  const origin = new URL(finalUrl).origin;
  const internalLinks = links.filter((href) => href.startsWith('/') || href.startsWith(origin)).length;
  const externalLinks = links.filter((href) => href.startsWith('http') && !href.startsWith(origin)).length;
  const images = [...html.matchAll(/<img\b[^>]*>/gi)].map((match) => match[0]);
  const missingAlt = images.filter((tag) => !/\balt=["'][^"']*["']/i.test(tag)).length;
  const wordCount = html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean).length;

  return {
    title,
    metaDescription,
    canonical,
    h1,
    h1Count: h1.length,
    internalLinks,
    externalLinks,
    imageCount: images.length,
    missingAlt,
    wordCount,
  };
}

function buildFindings(
  status: number,
  finalUrl: string,
  parsed: ReturnType<typeof parseHtmlAudit>,
): string[] {
  const findings: string[] = [];
  if (status >= 400) findings.push(`HTTP status ${status}`);
  if (!parsed.title) findings.push('Missing title');
  if (!parsed.metaDescription) findings.push('Missing meta description');
  if (!parsed.canonical) findings.push('Missing canonical');
  if (parsed.h1Count !== 1) findings.push(`Expected 1 H1, found ${parsed.h1Count}`);
  if (parsed.missingAlt > 0) findings.push(`${parsed.missingAlt} images missing alt text`);
  if (parsed.wordCount >= 300 && parsed.internalLinks < 2) findings.push('Long page has too few internal links');
  if (parsed.canonical && parsed.canonical !== finalUrl) findings.push(`Canonical points to ${parsed.canonical}`);
  return findings;
}

function renderMarkdown(payload: {
  generatedAt: string;
  results: AuditResult[];
}) {
  const lines = ['# Edge Audit Summary', '', `Generated: ${payload.generatedAt}`, ''];
  for (const result of payload.results) {
    lines.push(`## ${result.url}`);
    lines.push('');
    lines.push(`- Status: ${result.status ?? 'audit failed'}`);
    lines.push(`- Final URL: ${result.finalUrl ?? 'n/a'}`);
    lines.push(`- Title: ${result.title || 'n/a'}`);
    lines.push(`- Canonical: ${result.canonical || 'n/a'}`);
    lines.push(`- H1 count: ${result.h1Count}`);
    lines.push(`- Internal links: ${result.internalLinks}`);
    lines.push(`- External links: ${result.externalLinks}`);
    lines.push(`- Missing alt text: ${result.missingAlt}`);
    lines.push(`- Word count: ${result.wordCount}`);
    if (result.findings.length) {
      lines.push('- Findings:');
      for (const finding of result.findings) {
        lines.push(`  - ${finding}`);
      }
    } else {
      lines.push('- Findings: none');
    }
    lines.push('');
  }

  return lines.join('\n');
}
