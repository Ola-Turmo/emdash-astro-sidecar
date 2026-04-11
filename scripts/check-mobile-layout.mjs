#!/usr/bin/env node

import { createServer } from 'node:http';
import { readFile, readdir, stat } from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';

const repoRoot = process.cwd();
const distDir = path.join(repoRoot, 'apps', 'blog', 'dist');
const outputRoot = path.join(repoRoot, 'output', 'playwright', 'mobile-layout');
const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
const runDir = path.join(outputRoot, timestamp);

const MOBILE_VIEWPORTS = [
  { name: 'mobile-320', width: 320, height: 740 },
  { name: 'mobile-375', width: 375, height: 812 },
  { name: 'mobile-390', width: 390, height: 844 },
];

async function main() {
  await ensureDir(runDir);

  const routes = await discoverAuditRoutes();
  const server = await startStaticServer(distDir);
  const browser = await chromium.launch({ headless: true });
  const findings = [];

  try {
    for (const route of routes) {
      for (const viewport of MOBILE_VIEWPORTS) {
        const page = await browser.newPage({
          viewport: { width: viewport.width, height: viewport.height },
          deviceScaleFactor: 2,
          isMobile: true,
          hasTouch: true,
        });

        const targetUrl = `${server.origin}${route}`;
        await page.goto(targetUrl, { waitUntil: 'networkidle' });

        const screenshotPath = path.join(runDir, `${slugify(`${route}-${viewport.name}`)}.png`);
        await page.screenshot({ path: screenshotPath, fullPage: true });

        const result = await page.evaluate(() => {
          const viewportWidth = window.innerWidth;
          const header = document.querySelector('header');
          const prose = document.querySelector('.article-prose');
          const headerHeight = header?.getBoundingClientRect().height ?? 0;
          const proseWidth = prose?.getBoundingClientRect().width ?? null;

          const overflowing = [...document.querySelectorAll('body *')]
            .filter((el) => !(el.closest('[data-mobile-scroll]')))
            .map((el) => {
              const rect = el.getBoundingClientRect();
              return {
                tag: el.tagName,
                className: (el.className || '').toString(),
                text: (el.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 80),
                left: rect.left,
                right: rect.right,
              };
            })
            .filter((item) => item.left < -1 || item.right > viewportWidth + 1);

          return {
            viewportWidth,
            scrollWidth: document.documentElement.scrollWidth,
            headerHeight,
            proseWidth,
            overflowCount: overflowing.length,
            overflowing: overflowing.slice(0, 10),
          };
        });

        if (result.scrollWidth > result.viewportWidth + 1) {
          findings.push(`${route} ${viewport.name}: horizontal overflow (${result.scrollWidth} > ${result.viewportWidth})`);
        }

        if (result.overflowCount > 0) {
          findings.push(`${route} ${viewport.name}: ${result.overflowCount} non-scrollable elements extend past viewport`);
        }

        if (result.headerHeight > 96) {
          findings.push(`${route} ${viewport.name}: header too tall (${Math.round(result.headerHeight)}px)`);
        }

        if (route.includes('/blog/') && result.proseWidth !== null && result.proseWidth < 220) {
          findings.push(`${route} ${viewport.name}: article text column too narrow (${Math.round(result.proseWidth)}px)`);
        }

        await page.close();
      }
    }
  } finally {
    await browser.close();
    await server.close();
  }

  if (findings.length) {
    console.error('Mobile layout gate failed:');
    for (const finding of findings) {
      console.error(`- ${finding}`);
    }
    process.exitCode = 1;
    return;
  }

  console.log(`Mobile layout gate passed. Screenshots saved to ${path.relative(repoRoot, runDir)}`);
}

async function discoverAuditRoutes() {
  const htmlFiles = await walkHtml(distDir);
  const routes = new Set(['/']);

  for (const filePath of htmlFiles) {
    const relative = path.relative(distDir, filePath).replace(/\\/g, '/');
    if (relative === 'index.html') {
      routes.add('/');
      continue;
    }
    if (relative.endsWith('/index.html')) {
      routes.add(`/${relative.slice(0, -'index.html'.length)}`);
    }
  }

  return [...routes]
    .filter((route) => !route.startsWith('/author/'))
    .sort((a, b) => {
      const aScore = a.startsWith('/blog/') ? 0 : 1;
      const bScore = b.startsWith('/blog/') ? 0 : 1;
      return aScore - bScore || a.localeCompare(b);
    })
    .slice(0, 4);
}

async function walkHtml(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const results = [];
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...await walkHtml(fullPath));
      continue;
    }
    if (entry.isFile() && entry.name.endsWith('.html')) {
      results.push(fullPath);
    }
  }
  return results;
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
    throw new Error('Could not start mobile layout server');
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
  return 'application/octet-stream';
}

async function ensureDir(dir) {
  await import('node:fs/promises').then(({ mkdir }) => mkdir(dir, { recursive: true }));
}

function slugify(value) {
  return value.replace(/[^a-z0-9]+/gi, '-').replace(/-+/g, '-').replace(/^-|-$/g, '').toLowerCase();
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
