#!/usr/bin/env node

import { createServer } from 'node:http';
import { stat, mkdir, writeFile, readFile, access } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { chromium, devices } from 'playwright';
import { loadMunicipalityPages } from './lib/municipality-pages.mjs';

const repoRoot = process.cwd();
const distRoot = path.join(repoRoot, 'apps', 'blog', 'dist', 'kurs-ing');
const outputRoot = path.join(repoRoot, 'output', 'playwright', 'municipality-batch');
const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
const runDir = path.join(outputRoot, timestamp);
const screenshotsDir = path.join(runDir, 'screenshots');

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const entries = await loadMunicipalityPages(repoRoot);
  const targets = selectTargets(entries, args);

  if (!targets.length) {
    throw new Error('No municipality pages matched the requested batch audit filters.');
  }

  await mkdir(screenshotsDir, { recursive: true });

  const localMode = !args.liveBaseUrl;
  const server = null;
  const baseUrl = args.liveBaseUrl || null;
  const browser = await chromium.launch({ headless: true });
  const mobileDevice = devices['iPhone 13'];
  const results = [];
  const findings = [];

  try {
    for (const target of targets) {
      const route = resolveRoute({ target, liveBaseUrl: args.liveBaseUrl, baseUrl });
      if (route.localFilePath) {
        await waitForLocalRoute(route.localFilePath);
      }
      const routeUrl = route.url;
      const desktopPage = await browser.newPage({ viewport: { width: 1440, height: 1200 } });
      const mobilePage = await browser.newPage(mobileDevice);

      await desktopPage.goto(routeUrl, { waitUntil: 'domcontentloaded', timeout: 45000 });
      await mobilePage.goto(routeUrl, { waitUntil: 'domcontentloaded', timeout: 45000 });
      await desktopPage.waitForTimeout(1200);
      await mobilePage.waitForTimeout(1200);

      const desktopScreenshot = path.join(screenshotsDir, `${target.slug}-desktop.png`);
      const mobileScreenshot = path.join(screenshotsDir, `${target.slug}-mobile.png`);
      await desktopPage.screenshot({ path: desktopScreenshot, fullPage: true });
      await mobilePage.screenshot({ path: mobileScreenshot, fullPage: true });

      const audit = await desktopPage.evaluate(() => {
        const h1 = document.querySelector('h1')?.textContent?.trim() || '';
        const title = document.title || '';
        const description = document.querySelector('meta[name="description"]')?.getAttribute('content') || '';
        const bodyText = (document.body?.innerText || '').replace(/\s+/g, ' ').trim();
        return {
          h1,
          title,
          description,
          linkCount: document.querySelectorAll('a[href]').length,
          hasCourseRootMarker: bodyText.includes('Kurs for Etablererproven'),
          hasKommuneMarker: bodyText.includes('Kurs.ing Kommune') || title.includes('Kurs.ing Kommune'),
        };
      });

      if (!audit.h1) {
        findings.push(`${target.slug}: missing H1`);
      }
      if (!audit.title.includes(target.municipality)) {
        findings.push(`${target.slug}: title does not include municipality name`);
      }
      if (!audit.hasKommuneMarker) {
        findings.push(`${target.slug}: page does not present the kommune concept marker`);
      }
      if (audit.hasCourseRootMarker) {
        findings.push(`${target.slug}: page contains the main sales-page marker`);
      }

      results.push({
        ...target,
        url: routeUrl,
        mode: localMode ? 'local-file-or-server' : 'live-base-url',
        audit,
        screenshots: {
          desktop: path.relative(repoRoot, desktopScreenshot),
          mobile: path.relative(repoRoot, mobileScreenshot),
        },
      });

      await desktopPage.close();
      await mobilePage.close();
    }
  } finally {
    await browser.close();
    if (server) {
      await server.close();
    }
  }

  const summary = {
    generatedAt: new Date().toISOString(),
    liveBaseUrl: args.liveBaseUrl || null,
    targetCount: results.length,
    results,
    findings,
  };

  const markdown = [
    '# Municipality Batch Audit',
    '',
    `Generated: ${summary.generatedAt}`,
    `Targets: ${summary.targetCount}`,
    `Mode: ${args.mode}`,
    args.liveBaseUrl ? `Base URL: ${args.liveBaseUrl}` : 'Base URL: local file URLs',
    '',
    '## Findings',
    '',
    ...(findings.length ? findings.map((item) => `- ${item}`) : ['- None']),
    '',
    '## Pages',
    '',
    ...results.flatMap((result) => [
      `### ${result.municipality}`,
      '',
      `- URL: ${result.url}`,
      `- Score: ${result.qualityScore}`,
      `- Draft: ${result.draft}`,
      `- Publishable: ${result.publishable}`,
      `- H1: ${result.audit.h1}`,
      `- Title: ${result.audit.title}`,
      `- Description: ${result.audit.description}`,
      `- Desktop screenshot: \`${result.screenshots.desktop}\``,
      `- Mobile screenshot: \`${result.screenshots.mobile}\``,
      '',
    ]),
  ].join('\n');

  await writeFile(path.join(runDir, 'summary.json'), JSON.stringify(summary, null, 2), 'utf8');
  await writeFile(path.join(runDir, 'SUMMARY.md'), markdown, 'utf8');

  console.log(`Wrote ${path.relative(repoRoot, path.join(runDir, 'SUMMARY.md'))}`);
  console.log(`Wrote ${path.relative(repoRoot, path.join(runDir, 'summary.json'))}`);

  if (findings.length) {
    console.error('Municipality batch audit found issues:');
    for (const finding of findings) {
      console.error(`- ${finding}`);
    }
    process.exitCode = 1;
    return;
  }

  console.log(`Municipality batch audit passed for ${results.length} pages`);
}

function resolveRoute({ target, liveBaseUrl, baseUrl }) {
  if (liveBaseUrl) {
    return {
      url: `${liveBaseUrl.replace(/\/$/, '')}/${target.slug}/`,
      localFilePath: null,
    };
  }

  if (baseUrl) {
    return {
      url: `${baseUrl.replace(/\/$/, '')}/${target.slug}/`,
      localFilePath: null,
    };
  }

  const localFilePath = path.join(distRoot, 'kommune', target.slug, 'index.html');
  return {
    url: pathToFileURL(localFilePath).href,
    localFilePath,
  };
}

async function waitForLocalRoute(filePath, attempts = 20, delayMs = 250) {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      await access(filePath);
      return;
    } catch (error) {
      if (attempt === attempts - 1) {
        throw error;
      }
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
}

function parseArgs(argv) {
  const args = {
    mode: 'publishable-drafted',
    limit: 20,
    slugs: [],
    liveBaseUrl: '',
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--mode' && argv[index + 1]) {
      args.mode = argv[index + 1];
      index += 1;
      continue;
    }
    if (arg.startsWith('--mode=')) {
      args.mode = arg.slice('--mode='.length);
      continue;
    }
    if (arg === '--limit' && argv[index + 1]) {
      args.limit = Number(argv[index + 1]);
      index += 1;
      continue;
    }
    if (arg.startsWith('--limit=')) {
      args.limit = Number(arg.slice('--limit='.length));
      continue;
    }
    if (arg === '--slug' && argv[index + 1]) {
      args.slugs.push(argv[index + 1]);
      index += 1;
      continue;
    }
    if (arg.startsWith('--slug=')) {
      args.slugs.push(arg.slice('--slug='.length));
      continue;
    }
    if (arg === '--live-base-url' && argv[index + 1]) {
      args.liveBaseUrl = argv[index + 1];
      index += 1;
      continue;
    }
    if (arg.startsWith('--live-base-url=')) {
      args.liveBaseUrl = arg.slice('--live-base-url='.length);
    }
  }

  return args;
}

function selectTargets(entries, args) {
  if (args.slugs.length) {
    const wanted = new Set(args.slugs.map((value) => value.toLowerCase()));
    return entries.filter((entry) => wanted.has(entry.slug.toLowerCase()));
  }

  if (args.mode === 'published') {
    return entries.filter((entry) => !entry.draft).slice(0, args.limit);
  }

  if (args.mode === 'publishable-all') {
    return entries.filter((entry) => entry.publishable).slice(0, args.limit);
  }

  return entries.filter((entry) => entry.publishable && entry.draft).slice(0, args.limit);
}

async function startStaticServer(rootDir) {
  const server = createServer(async (req, res) => {
    try {
      const requestPath = req.url?.split('?')[0] || '/';
      let filePath = path.join(rootDir, requestPath);
      const fileStat = await safeStat(filePath);

      if (fileStat?.isDirectory()) {
        filePath = path.join(filePath, 'index.html');
      } else if (!fileStat) {
        const nestedIndex = path.join(rootDir, requestPath, 'index.html');
        if (await safeStat(nestedIndex)) {
          filePath = nestedIndex;
        }
      }

      const finalStat = await safeStat(filePath);
      if (!finalStat?.isFile()) {
        res.statusCode = 404;
        res.end('Not found');
        return;
      }

      const data = await readFile(filePath);
      res.statusCode = 200;
      res.setHeader('content-type', contentType(filePath));
      res.end(data);
    } catch (error) {
      res.statusCode = 500;
      res.end(error instanceof Error ? error.message : String(error));
    }
  });

  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  if (!address || typeof address === 'string') {
    throw new Error('Could not start municipality batch audit server');
  }

  return {
    origin: `http://127.0.0.1:${address.port}`,
    close: () => new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve())),
  };
}

async function safeStat(filePath) {
  try {
    return await stat(filePath);
  } catch {
    return null;
  }
}

function contentType(filePath) {
  if (filePath.endsWith('.html')) return 'text/html; charset=utf-8';
  if (filePath.endsWith('.css')) return 'text/css; charset=utf-8';
  if (filePath.endsWith('.js')) return 'application/javascript; charset=utf-8';
  if (filePath.endsWith('.xml')) return 'application/xml; charset=utf-8';
  if (filePath.endsWith('.txt')) return 'text/plain; charset=utf-8';
  if (filePath.endsWith('.svg')) return 'image/svg+xml';
  if (filePath.endsWith('.webp')) return 'image/webp';
  if (filePath.endsWith('.png')) return 'image/png';
  return 'application/octet-stream';
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
