#!/usr/bin/env node

import { exec, execFile } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { chromium, devices } from 'playwright';
import { walkFiles } from './lib/repo-utils.mjs';

const execAsync = promisify(exec);
const execFileAsync = promisify(execFile);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');
const blogDistDir = path.join(repoRoot, 'apps', 'blog', 'dist');
const localToolRoot = path.join(process.env.LOCALAPPDATA || os.tmpdir(), 'emdash-astro-sidecar-tools');
const LIGHTHOUSE_VERSION = '13.1.0';
const LIGHTHOUSE_TOOL_DIR = path.join(localToolRoot, `lighthouse-${LIGHTHOUSE_VERSION}`);
const LIGHTHOUSE_CLI_PATH = path.join(LIGHTHOUSE_TOOL_DIR, 'node_modules', 'lighthouse', 'cli', 'index.js');
const LIGHTHOUSE_TMP_DIR = path.join(LIGHTHOUSE_TOOL_DIR, 'tmp');

const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
const outputRoot = path.join(repoRoot, 'output', 'playwright', 'deployed-audit', timestamp);
const screenshotsDir = path.join(outputRoot, 'screenshots');
const lighthouseDir = path.join(outputRoot, 'lighthouse');

function slugifyUrl(url) {
  return url
    .replace(/^https?:\/\//, '')
    .replace(/[^\w/-]+/g, '-')
    .replace(/[\\/]+/g, '__')
    .replace(/-+/g, '-')
    .replace(/^[-_]+|[-_]+$/g, '');
}

function parseArgs(argv) {
  const urls = [];
  const sitemaps = [];
  const usesPsiAlias = argv.includes('--psi');
  const includeLighthouse = argv.includes('--lighthouse') || usesPsiAlias;
  const includeConfigured = argv.includes('--include-configured');

  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--url' && argv[i + 1]) {
      urls.push(argv[i + 1]);
      i += 1;
    }

    if (argv[i] === '--sitemap' && argv[i + 1]) {
      sitemaps.push(argv[i + 1]);
      i += 1;
    }
  }

  return { urls, sitemaps, includeLighthouse, includeConfigured, usesPsiAlias };
}

function ensureTrailingSlash(url) {
  return url.endsWith('/') ? url : `${url}/`;
}

function htmlFileToDeployedUrl(filePath, siteUrl) {
  const relativePath = path.relative(blogDistDir, filePath).replace(/\\/g, '/');
  if (relativePath === '404.html') return null;

  let route = '';
  if (relativePath === 'index.html') {
    return siteUrl;
  } else if (relativePath.endsWith('/index.html')) {
    route = relativePath.slice(0, -'index.html'.length);
  } else if (relativePath.endsWith('.html')) {
    route = relativePath.slice(0, -'.html'.length);
  } else {
    return null;
  }

  const normalizedRoute = route && !route.endsWith('/') ? `${route}/` : route;
  return new URL(normalizedRoute, ensureTrailingSlash(siteUrl)).toString();
}

async function discoverDistUrls(siteUrl) {
  if (!existsSync(blogDistDir)) {
    return [];
  }

  const htmlFiles = await walkFiles(blogDistDir, (filePath) => filePath.endsWith('.html'));
  return htmlFiles
    .map((filePath) => htmlFileToDeployedUrl(filePath, siteUrl))
    .filter((url) => Boolean(url));
}

async function loadSiteAuditTargets() {
  const siteConfigModule = await import(pathToFileURL(path.join(repoRoot, 'apps/blog/src/site-config.ts')).href);
  return {
    siteUrl: siteConfigModule.SITE_URL || siteConfigModule.siteConfig?.brand?.siteUrl,
    urls: siteConfigModule.DEPLOY_AUDIT_EXTRA_URLS || [],
    sitemaps: siteConfigModule.DEPLOY_AUDIT_SITEMAPS || [],
  };
}

async function parseSitemap(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch sitemap ${url}: ${response.status}`);
  }

  const xml = await response.text();
  return [...xml.matchAll(/<loc>(.*?)<\/loc>/g)].map((match) => match[1]);
}

function toScore(score) {
  if (typeof score !== 'number') return null;
  return Math.round(score * 100);
}

function npmCommand() {
  return process.platform === 'win32' ? 'npm.cmd' : 'npm';
}

function parseJsonFromStdout(stdout) {
  const trimmed = stdout.trim();
  if (!trimmed) {
    throw new Error('Lighthouse returned no JSON output');
  }

  try {
    return JSON.parse(trimmed);
  } catch {
    const firstBrace = trimmed.indexOf('{');
    const lastBrace = trimmed.lastIndexOf('}');
    if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) {
      throw new Error('Lighthouse output was not valid JSON');
    }
    return JSON.parse(trimmed.slice(firstBrace, lastBrace + 1));
  }
}

async function ensureLocalLighthouseCli() {
  if (existsSync(LIGHTHOUSE_CLI_PATH)) {
    return LIGHTHOUSE_CLI_PATH;
  }

  await mkdir(LIGHTHOUSE_TOOL_DIR, { recursive: true });
  await mkdir(LIGHTHOUSE_TMP_DIR, { recursive: true });

  const packageJsonPath = path.join(LIGHTHOUSE_TOOL_DIR, 'package.json');
  if (!existsSync(packageJsonPath)) {
    await writeFile(
      packageJsonPath,
      JSON.stringify(
        {
          name: 'emdash-local-lighthouse-runtime',
          private: true,
          type: 'module',
        },
        null,
        2,
      ),
      'utf8',
    );
  }

  console.log(`Bootstrapping local Lighthouse runtime in ${LIGHTHOUSE_TOOL_DIR}`);
  await execAsync(
    `${npmCommand()} install --no-save --no-fund --no-audit lighthouse@${LIGHTHOUSE_VERSION}`,
    {
      cwd: LIGHTHOUSE_TOOL_DIR,
      windowsHide: true,
      maxBuffer: 20 * 1024 * 1024,
    },
  );

  if (!existsSync(LIGHTHOUSE_CLI_PATH)) {
    throw new Error(`Lighthouse CLI was not installed at ${LIGHTHOUSE_CLI_PATH}`);
  }

  return LIGHTHOUSE_CLI_PATH;
}

function summarizeLighthouseWarning(error) {
  const message = error instanceof Error ? error.message : String(error);
  if (/EPERM/i.test(message) && /lighthouse\./i.test(message)) {
    return 'Lighthouse returned valid JSON, but Windows blocked temp-folder cleanup after the run.';
  }
  const firstLine = message.split(/\r?\n/).find((line) => line.trim());
  return firstLine || 'Lighthouse returned valid JSON with a non-zero exit code.';
}

async function buildLighthouseResult(report, strategy, reportPath, warning) {
  const categories = report?.categories || {};
  return {
    ok: true,
    strategy,
    performance: toScore(categories.performance?.score),
    accessibility: toScore(categories.accessibility?.score),
    bestPractices: toScore(categories['best-practices']?.score),
    seo: toScore(categories.seo?.score),
    reportPath: path.relative(repoRoot, reportPath),
    warning,
  };
}

async function runLighthouseAudit(url, strategy, pageSlug) {
  const cliPath = await ensureLocalLighthouseCli();
  const reportPath = path.join(lighthouseDir, `${pageSlug}-${strategy}.json`);
  const args = [
    cliPath,
    url,
    '--quiet',
    '--output=json',
    `--output-path=${reportPath}`,
    '--only-categories=performance,accessibility,best-practices,seo',
    `--chrome-path=${chromium.executablePath()}`,
    '--chrome-flags=--headless=new --no-sandbox --disable-dev-shm-usage',
  ];

  if (strategy === 'desktop') {
    args.push('--preset=desktop');
  }

  try {
    await execFileAsync(process.execPath, args, {
      cwd: LIGHTHOUSE_TOOL_DIR,
      windowsHide: true,
      maxBuffer: 40 * 1024 * 1024,
      env: {
        ...process.env,
        TMP: LIGHTHOUSE_TMP_DIR,
        TEMP: LIGHTHOUSE_TMP_DIR,
      },
    });
    const report = JSON.parse(await readFileSafe(reportPath));
    return buildLighthouseResult(report, strategy, reportPath);
  } catch (error) {
    if (existsSync(reportPath)) {
      try {
        const report = JSON.parse(await readFileSafe(reportPath));
        return buildLighthouseResult(
          report,
          strategy,
          reportPath,
          summarizeLighthouseWarning(error),
        );
      } catch {
        // fall through to the normal error return
      }
    }

    return {
      ok: false,
      strategy,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

async function readFileSafe(filePath) {
  return readFile(filePath, 'utf8');
}

function getRedirectChain(response) {
  if (!response) return [];

  const chain = [];
  let request = response.request();

  while (request) {
    chain.unshift(request.url());
    request = request.redirectedFrom();
  }

  return chain;
}

function buildEmptyAnalytics() {
  return {
    title: '',
    metaDescription: '',
    canonical: '',
    robots: '',
    lang: '',
    h1s: [],
    h1Count: 0,
    internalLinks: 0,
    externalLinks: 0,
    imageCount: 0,
    missingAlt: 0,
    wordCount: 0,
    navigation: null,
  };
}

function buildFindings({ url, finalUrl, analytics, canonicalUrl, failedRequests, responseStatus }) {
  const findings = [];

  if (!responseStatus || responseStatus >= 400) {
    findings.push(`HTTP status ${responseStatus ?? 'unknown'}`);
  }

  if (!analytics.title) findings.push('Missing title');
  if (!analytics.metaDescription) findings.push('Missing meta description');
  if (!analytics.canonical) findings.push('Missing canonical');
  if (analytics.h1Count !== 1) findings.push(`Expected 1 H1, found ${analytics.h1Count}`);
  if (analytics.missingAlt > 0) findings.push(`${analytics.missingAlt} images missing alt text`);
  if (analytics.robots.includes('noindex')) findings.push('Page is marked noindex');
  if (failedRequests.length > 0) findings.push(`${failedRequests.length} failed network requests`);
  if (analytics.wordCount >= 300 && analytics.internalLinks === 0) findings.push('Long page has no internal links');
  if (canonicalUrl && finalUrl && canonicalUrl !== finalUrl) findings.push(`Canonical points to ${canonicalUrl}`);

  if (/\/preview\//.test(url) || /\/preview\//.test(finalUrl || '')) {
    findings.push('Preview route is publicly accessible');
  }

  const legacyStrings = [analytics.title, analytics.metaDescription, canonicalUrl].filter(Boolean).join(' ');
  if (/EmDash|new\.kurs\.ing|Thoughtful articles on web development/i.test(legacyStrings)) {
    findings.push('Page still exposes legacy brand or host strings');
  }

  return findings;
}

async function auditUrl(browser, url, includeLighthouse) {
  const desktopContext = await browser.newContext({
    viewport: { width: 1440, height: 1200 },
    userAgent: 'EmDashDeployAudit/1.0',
  });
  const mobileContext = await browser.newContext({
    ...devices['iPhone 13'],
    userAgent: 'EmDashDeployAudit/1.0',
  });

  const desktopPage = await desktopContext.newPage();
  const mobilePage = await mobileContext.newPage();
  const failedRequests = [];

  desktopPage.on('requestfailed', (request) => {
    failedRequests.push({
      url: request.url(),
      method: request.method(),
      failure: request.failure()?.errorText || 'unknown',
    });
  });

  try {
    const desktopResponse = await desktopPage.goto(url, { waitUntil: 'networkidle', timeout: 90000 });
    await mobilePage.goto(url, { waitUntil: 'networkidle', timeout: 90000 });

    const pageSlug = slugifyUrl(url);
    const desktopScreenshot = path.join(screenshotsDir, `${pageSlug}-desktop.png`);
    const mobileScreenshot = path.join(screenshotsDir, `${pageSlug}-mobile.png`);

    await desktopPage.screenshot({ path: desktopScreenshot, fullPage: true });
    await mobilePage.screenshot({ path: mobileScreenshot, fullPage: true });

    const analytics = await desktopPage.evaluate(() => {
      const metaDescription = document.querySelector('meta[name="description"]')?.getAttribute('content') || '';
      const canonical = document.querySelector('link[rel="canonical"]')?.getAttribute('href') || '';
      const robots = document.querySelector('meta[name="robots"]')?.getAttribute('content') || '';
      const lang = document.documentElement.lang || '';
      const h1s = Array.from(document.querySelectorAll('h1'))
        .map((el) => el.textContent?.trim() || '')
        .filter(Boolean);
      const links = Array.from(document.querySelectorAll('a[href]')).map((el) => el.getAttribute('href') || '');
      const images = Array.from(document.querySelectorAll('img'));
      const navigation = performance.getEntriesByType('navigation')[0];
      const bodyText = document.body?.innerText || '';

      const internalLinks = links.filter((href) => href.startsWith('/') || href.startsWith(location.origin)).length;
      const externalLinks = links.filter((href) => href.startsWith('http') && !href.startsWith(location.origin)).length;
      const missingAlt = images.filter((img) => !img.getAttribute('alt')?.trim()).length;

      return {
        title: document.title,
        metaDescription,
        canonical,
        robots,
        lang,
        h1s,
        h1Count: h1s.length,
        internalLinks,
        externalLinks,
        imageCount: images.length,
        missingAlt,
        wordCount: bodyText.trim() ? bodyText.trim().split(/\s+/).length : 0,
        navigation: navigation
          ? {
              domContentLoaded: Math.round(navigation.domContentLoadedEventEnd),
              loadEvent: Math.round(navigation.loadEventEnd),
              responseEnd: Math.round(navigation.responseEnd),
              transferSize: navigation.transferSize ?? null,
              encodedBodySize: navigation.encodedBodySize ?? null,
            }
          : null,
      };
    });

    const finalUrl = desktopPage.url();
    let canonicalUrl = '';

    if (analytics.canonical) {
      try {
        canonicalUrl = new URL(analytics.canonical, finalUrl).toString();
      } catch {
        canonicalUrl = analytics.canonical;
      }
    }

    const lighthouse = includeLighthouse
      ? {
          mobile: await runLighthouseAudit(finalUrl || url, 'mobile', pageSlug),
          desktop: await runLighthouseAudit(finalUrl || url, 'desktop', pageSlug),
        }
      : undefined;

    return {
      url,
      finalUrl,
      redirectChain: getRedirectChain(desktopResponse),
      status: desktopResponse?.status() ?? null,
      screenshots: {
        desktop: path.relative(repoRoot, desktopScreenshot),
        mobile: path.relative(repoRoot, mobileScreenshot),
      },
      analytics: {
        ...analytics,
        canonicalUrl,
      },
      failedRequests,
      findings: buildFindings({
        url,
        finalUrl,
        analytics,
        canonicalUrl,
        failedRequests,
        responseStatus: desktopResponse?.status() ?? null,
      }),
      lighthouse,
    };
  } catch (error) {
    return {
      url,
      finalUrl: null,
      redirectChain: [],
      status: null,
      screenshots: {
        desktop: null,
        mobile: null,
      },
      analytics: buildEmptyAnalytics(),
      failedRequests,
      findings: [`Audit failed: ${error instanceof Error ? error.message : String(error)}`],
      lighthouse: undefined,
    };
  } finally {
    await desktopContext.close();
    await mobileContext.close();
  }
}

function renderMarkdown(report) {
  const lines = [
    '# Deployed URL Audit',
    '',
    `Generated: ${report.generatedAt}`,
    '',
    `URL count: ${report.urls.length}`,
    `Configured extra URLs: ${report.sources.extraUrls.length}`,
    `Sitemap URLs: ${report.sources.sitemaps.length}`,
    `Dist-discovered URLs: ${report.sources.distUrls.length}`,
    '',
  ];

  for (const entry of report.results) {
    lines.push(`## ${entry.url}`);
    lines.push('');
    lines.push(`- Status: ${entry.status ?? 'audit failed'}`);
    lines.push(`- Final URL: ${entry.finalUrl ?? 'n/a'}`);
    lines.push(`- Title: ${entry.analytics.title || 'n/a'}`);
    lines.push(`- Canonical: ${entry.analytics.canonicalUrl || entry.analytics.canonical || 'n/a'}`);
    lines.push(`- H1 count: ${entry.analytics.h1Count}`);
    lines.push(`- Word count: ${entry.analytics.wordCount}`);
    lines.push(`- Internal links: ${entry.analytics.internalLinks}`);
    lines.push(`- External links: ${entry.analytics.externalLinks}`);
    lines.push(`- Missing alt text: ${entry.analytics.missingAlt}`);
    lines.push(`- Desktop screenshot: \`${entry.screenshots.desktop ?? 'not captured'}\``);
    lines.push(`- Mobile screenshot: \`${entry.screenshots.mobile ?? 'not captured'}\``);

    if (entry.redirectChain.length > 1) {
      lines.push(`- Redirect chain: ${entry.redirectChain.join(' -> ')}`);
    }

    if (entry.analytics.navigation) {
      lines.push(`- DOMContentLoaded: ${entry.analytics.navigation.domContentLoaded} ms`);
      lines.push(`- Load event: ${entry.analytics.navigation.loadEvent} ms`);
    }

    if (entry.lighthouse?.desktop) {
      if (entry.lighthouse.desktop.ok) {
        lines.push(
          `- Lighthouse desktop: perf ${entry.lighthouse.desktop.performance}, acc ${entry.lighthouse.desktop.accessibility}, best ${entry.lighthouse.desktop.bestPractices}, seo ${entry.lighthouse.desktop.seo}`,
        );
        lines.push(`- Lighthouse desktop report: \`${entry.lighthouse.desktop.reportPath}\``);
        if (entry.lighthouse.desktop.warning) {
          lines.push(`- Lighthouse desktop note: ${entry.lighthouse.desktop.warning}`);
        }
      } else {
        lines.push(`- Lighthouse desktop: unavailable (${entry.lighthouse.desktop.error})`);
      }
    }

    if (entry.lighthouse?.mobile) {
      if (entry.lighthouse.mobile.ok) {
        lines.push(
          `- Lighthouse mobile: perf ${entry.lighthouse.mobile.performance}, acc ${entry.lighthouse.mobile.accessibility}, best ${entry.lighthouse.mobile.bestPractices}, seo ${entry.lighthouse.mobile.seo}`,
        );
        lines.push(`- Lighthouse mobile report: \`${entry.lighthouse.mobile.reportPath}\``);
        if (entry.lighthouse.mobile.warning) {
          lines.push(`- Lighthouse mobile note: ${entry.lighthouse.mobile.warning}`);
        }
      } else {
        lines.push(`- Lighthouse mobile: unavailable (${entry.lighthouse.mobile.error})`);
      }
    }

    if (entry.findings.length) {
      lines.push('- Findings:');
      for (const finding of entry.findings) {
        lines.push(`  - ${finding}`);
      }
    } else {
      lines.push('- Findings: none');
    }

    lines.push('');
  }

  return lines.join('\n');
}

function renderSingleUrlSummary(report) {
  const entry = report.results[0];
  const lines = [
    '# Post-Publish Summary',
    '',
    `Generated: ${report.generatedAt}`,
    `URL: ${entry.url}`,
    `Final URL: ${entry.finalUrl ?? 'n/a'}`,
    `Status: ${entry.status ?? 'audit failed'}`,
    `Title: ${entry.analytics.title || 'n/a'}`,
    `Canonical: ${entry.analytics.canonicalUrl || entry.analytics.canonical || 'n/a'}`,
    `Meta description: ${entry.analytics.metaDescription || 'n/a'}`,
    `H1: ${entry.analytics.h1s?.[0] || 'n/a'}`,
    `Desktop screenshot: \`${entry.screenshots.desktop ?? 'not captured'}\``,
    `Mobile screenshot: \`${entry.screenshots.mobile ?? 'not captured'}\``,
  ];

  if (entry.lighthouse?.mobile?.ok) {
    lines.push(
      `Mobile Lighthouse: perf ${entry.lighthouse.mobile.performance}, acc ${entry.lighthouse.mobile.accessibility}, best ${entry.lighthouse.mobile.bestPractices}, seo ${entry.lighthouse.mobile.seo}`,
    );
  }
  if (entry.lighthouse?.desktop?.ok) {
    lines.push(
      `Desktop Lighthouse: perf ${entry.lighthouse.desktop.performance}, acc ${entry.lighthouse.desktop.accessibility}, best ${entry.lighthouse.desktop.bestPractices}, seo ${entry.lighthouse.desktop.seo}`,
    );
  }

  lines.push('');
  lines.push('## Findings');
  lines.push('');
  if (entry.findings.length) {
    for (const finding of entry.findings) {
      lines.push(`- ${finding}`);
    }
  } else {
    lines.push('- None');
  }

  return lines.join('\n');
}

async function main() {
  const {
    urls: cliUrls,
    sitemaps: cliSitemaps,
    includeLighthouse,
    includeConfigured,
    usesPsiAlias,
  } = parseArgs(process.argv.slice(2));
  if (usesPsiAlias) {
    console.warn(
      'The --psi mode is a compatibility alias for the local Lighthouse audit. Use `pnpm report:pagespeed-public` for the real public PageSpeed API report.',
    );
  }
  const configured = await loadSiteAuditTargets();
  const useConfiguredTargets = includeConfigured || (cliUrls.length === 0 && cliSitemaps.length === 0);
  const distUrls = useConfiguredTargets && configured.siteUrl ? await discoverDistUrls(configured.siteUrl) : [];
  const sitemaps = [...new Set([...(useConfiguredTargets ? configured.sitemaps : []), ...cliSitemaps])];
  const directUrls = [...new Set([...(useConfiguredTargets ? configured.urls : []), ...cliUrls])];

  const discoveredUrls = new Set([...directUrls, ...distUrls]);
  for (const sitemap of sitemaps) {
    const sitemapUrls = await parseSitemap(sitemap);
    sitemapUrls.forEach((url) => discoveredUrls.add(url));
  }

  const urls = [...discoveredUrls].filter((url) => /^https?:\/\//.test(url));
  if (!urls.length) {
    throw new Error('No URLs to audit. Provide --url, --sitemap, or configure siteConfig.audit.');
  }

  await mkdir(screenshotsDir, { recursive: true });
  if (includeLighthouse) {
    await mkdir(lighthouseDir, { recursive: true });
  }
  const browser = await chromium.launch({ headless: true });
  const results = [];

  for (const url of urls) {
    console.log(`Auditing ${url}`);
    results.push(await auditUrl(browser, url, includeLighthouse));
  }

  await browser.close();

  const report = {
    generatedAt: new Date().toISOString(),
    urls,
    sources: {
      extraUrls: directUrls,
      sitemaps,
      distUrls,
    },
    includeLighthouse,
    results,
  };

  await writeFile(path.join(outputRoot, 'audit.json'), JSON.stringify(report, null, 2), 'utf8');
  await writeFile(path.join(outputRoot, 'SUMMARY.md'), renderMarkdown(report), 'utf8');
  if (report.results.length === 1) {
    await writeFile(
      path.join(outputRoot, 'POST_PUBLISH_SUMMARY.md'),
      renderSingleUrlSummary(report),
      'utf8',
    );
  }

  console.log(`Audit written to ${outputRoot}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack || error.message : String(error));
  process.exit(1);
});
