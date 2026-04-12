import puppeteer from '@cloudflare/puppeteer';
import {
  buildExecutionEnvelope,
  defaultCloudflareGuardrails,
  parseCloudflareGuardMode,
  parseCloudflarePlanTier,
} from '../../../../../packages/cloudflare-guardrails/src/index';

interface Env {
  AUTONOMOUS_DB: D1Database;
  MYBROWSER: { fetch: typeof fetch };
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
  auditMode: 'browser' | 'fetch';
  screenshotCaptured: boolean;
  screenshotSha256?: string;
  screenshotBytes?: number;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const targets = collectTargets(url);

    if (targets.length === 0) {
      return Response.json({ ok: false, error: 'Missing ?target=<url> or ?targets=url1,url2' }, { status: 400 });
    }

    const guardrails = defaultCloudflareGuardrails(
      parseCloudflarePlanTier(env.CF_PLAN_TIER),
      parseCloudflareGuardMode(env.CF_RESOURCE_GUARD_MODE),
    );
    const allowedTargets =
      env.MAX_AUDIT_URLS_PER_RUN && Number.isFinite(Number(env.MAX_AUDIT_URLS_PER_RUN))
        ? Math.max(1, Number(env.MAX_AUDIT_URLS_PER_RUN))
        : 1;
    const executionEnvelope = buildExecutionEnvelope(guardrails, {
      hostMode: 'draft_only',
      requestedAuditUrls: Math.min(targets.length, allowedTargets),
      requestedHostRuns: 1,
    });

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

    const screenshotRequested =
      env.BROWSER_AUDIT_ENABLED === 'true' &&
      (url.searchParams.get('screenshot') === '1' || url.searchParams.get('format') === 'image');
    const effectiveExecutionEnvelope = {
      ...executionEnvelope,
      browserAuditEnabled: screenshotRequested || executionEnvelope.browserAuditEnabled,
    };

    let browser: Awaited<ReturnType<typeof puppeteer.launch>> | null = null;
    let page: Awaited<ReturnType<Awaited<ReturnType<typeof puppeteer.launch>>['newPage']>> | null = null;

    try {
      if (screenshotRequested) {
        browser = await puppeteer.launch(env.MYBROWSER);
        page = await browser.newPage();
        await page.setViewport({ width: 1280, height: 1600, deviceScaleFactor: 1 });
      }

      const results: AuditResult[] = [];
      let firstScreenshot: Uint8Array | null = null;

      for (const target of targets) {
        const result: AuditResult & { screenshot?: Uint8Array | null } = screenshotRequested && page
          ? await auditTargetWithBrowser(page, target, !firstScreenshot)
          : await auditTargetWithFetch(target);

        if (!firstScreenshot && 'screenshot' in result && result.screenshot) {
          firstScreenshot = result.screenshot;
        }

        const auditResult = stripScreenshot(result);
        results.push(auditResult);

        if (url.searchParams.get('persist') === '1') {
          await persistAudit(env.AUTONOMOUS_DB, url.searchParams.get('hostId'), auditResult);
        }
      }

      if (url.searchParams.get('format') === 'image') {
        if (!firstScreenshot || targets.length !== 1) {
          return Response.json({ ok: false, error: 'Image format requires one target and screenshot=1.' }, { status: 400 });
        }
        return new Response(new Blob([Uint8Array.from(firstScreenshot)], { type: 'image/jpeg' }), {
          headers: {
            'content-type': 'image/jpeg',
            'cache-control': 'no-store',
          },
        });
      }

      const payload = {
        ok: true,
        targets,
        guardrails,
        executionEnvelope: effectiveExecutionEnvelope,
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
    } finally {
      await page?.close().catch(() => undefined);
      await browser?.close().catch(() => undefined);
    }
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

async function auditTargetWithBrowser(
  page: Awaited<ReturnType<Awaited<ReturnType<typeof puppeteer.launch>>['newPage']>>,
  target: string,
  captureScreenshot: boolean,
): Promise<AuditResult & { screenshot?: Uint8Array | null }> {
  try {
    const response = await page.goto(target, {
      waitUntil: 'networkidle2',
      timeout: 45000,
    });
    await new Promise((resolve) => setTimeout(resolve, 500));

    const parsed = await page.evaluate(() => {
      const globalScope = globalThis as unknown as {
        document: any;
        location: { href: string; origin: string };
      };
      const doc = globalScope.document;
      const title = doc.title || '';
      const metaDescription =
        doc.querySelector('meta[name="description"]')?.getAttribute('content')?.trim() ?? '';
      const canonical = doc.querySelector('link[rel="canonical"]')?.getAttribute('href')?.trim() ?? '';
      const h1 = Array.from(doc.querySelectorAll('h1')).map((node: any) => node.textContent?.replace(/\s+/g, ' ').trim() ?? '').filter(Boolean);
      const links = Array.from(doc.querySelectorAll('a[href]')).map((node: any) => node.getAttribute('href') ?? '');
      const images = Array.from(doc.querySelectorAll('img'));
      const missingAlt = images.filter((img: any) => !img.getAttribute('alt')).length;
      const text = doc.body?.innerText?.replace(/\s+/g, ' ').trim() ?? '';
      return {
        title,
        metaDescription,
        canonical,
        h1,
        h1Count: h1.length,
        internalLinks: links.filter((href: string) => href.startsWith('/') || href.startsWith(globalScope.location.origin)).length,
        externalLinks: links.filter((href: string) => href.startsWith('http') && !href.startsWith(globalScope.location.origin)).length,
        imageCount: images.length,
        missingAlt,
        wordCount: text ? text.split(/\s+/).filter(Boolean).length : 0,
        finalUrl: globalScope.location.href,
      };
    });

    let screenshot: Uint8Array | null = null;
    let screenshotSha256: string | undefined;
    let screenshotBytes: number | undefined;

    if (captureScreenshot) {
      const raw = await page.screenshot({
        type: 'jpeg',
        quality: 65,
        fullPage: true,
      });
      screenshot = raw instanceof Uint8Array ? raw : new Uint8Array(raw);
      screenshotBytes = screenshot.byteLength;
      screenshotSha256 = await digestHex(screenshot);
    }

    const findings = buildFindings(response?.status() ?? 0, parsed.finalUrl, parsed);
    return {
      url: target,
      status: response?.status() ?? null,
      finalUrl: parsed.finalUrl,
      title: parsed.title,
      metaDescription: parsed.metaDescription,
      canonical: parsed.canonical ? new URL(parsed.canonical, parsed.finalUrl).toString() : '',
      h1: parsed.h1,
      h1Count: parsed.h1Count,
      internalLinks: parsed.internalLinks,
      externalLinks: parsed.externalLinks,
      imageCount: parsed.imageCount,
      missingAlt: parsed.missingAlt,
      wordCount: parsed.wordCount,
      findings,
      auditMode: 'browser',
      screenshotCaptured: Boolean(screenshot),
      screenshotSha256,
      screenshotBytes,
      screenshot,
    };
  } catch (error) {
    return {
      ...(await auditTargetWithFetch(target)),
      auditMode: 'fetch',
      findings: [`Browser audit failed: ${error instanceof Error ? error.message : String(error)}`],
      screenshotCaptured: false,
      screenshot: null,
    };
  }
}

async function auditTargetWithFetch(target: string): Promise<AuditResult> {
  try {
    const response = await fetch(target, {
      redirect: 'follow',
      headers: { 'user-agent': 'EmDashBrowserAuditWorker/1.0' },
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
      auditMode: 'fetch',
      screenshotCaptured: false,
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
      auditMode: 'fetch',
      screenshotCaptured: false,
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
  parsed: {
    title: string;
    metaDescription: string;
    canonical: string;
    h1Count: number;
    missingAlt: number;
    wordCount: number;
    internalLinks: number;
  },
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

async function persistAudit(
  db: D1Database,
  hostId: string | null,
  result: AuditResult,
): Promise<void> {
  if (!hostId) return;
  await db
    .prepare(
      `
        INSERT INTO audit_runs (id, host_id, url, status_code, findings_json, created_at)
        VALUES (?1, ?2, ?3, ?4, ?5, ?6)
      `,
    )
    .bind(
      crypto.randomUUID(),
      hostId,
      result.finalUrl ?? result.url,
      result.status,
      JSON.stringify({
        ...result,
      }),
      new Date().toISOString(),
    )
    .run();
}

function stripScreenshot(result: AuditResult & { screenshot?: Uint8Array | null }): AuditResult {
  const { screenshot: _screenshot, ...rest } = result;
  return rest;
}

async function digestHex(bytes: Uint8Array): Promise<string> {
  const copied = Uint8Array.from(bytes);
  const digest = await crypto.subtle.digest('SHA-256', copied);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

function renderMarkdown(payload: { generatedAt: string; results: AuditResult[] }) {
  const lines = ['# Edge Audit Summary', '', `Generated: ${payload.generatedAt}`, ''];
  for (const result of payload.results) {
    lines.push(`## ${result.url}`);
    lines.push('');
    lines.push(`- Status: ${result.status ?? 'audit failed'}`);
    lines.push(`- Final URL: ${result.finalUrl ?? 'n/a'}`);
    lines.push(`- Title: ${result.title || 'n/a'}`);
    lines.push(`- Canonical: ${result.canonical || 'n/a'}`);
    lines.push(`- Mode: ${result.auditMode}`);
    lines.push(`- Screenshot captured: ${result.screenshotCaptured ? 'yes' : 'no'}`);
    if (result.screenshotSha256) lines.push(`- Screenshot SHA-256: ${result.screenshotSha256}`);
    lines.push(`- H1 count: ${result.h1Count}`);
    lines.push(`- Internal links: ${result.internalLinks}`);
    lines.push(`- External links: ${result.externalLinks}`);
    lines.push(`- Missing alt text: ${result.missingAlt}`);
    lines.push(`- Word count: ${result.wordCount}`);
    if (result.findings.length) {
      lines.push('- Findings:');
      for (const finding of result.findings) lines.push(`  - ${finding}`);
    } else {
      lines.push('- Findings: none');
    }
    lines.push('');
  }
  return lines.join('\n');
}
