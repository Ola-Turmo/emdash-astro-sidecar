#!/usr/bin/env node

import path from 'node:path';
import { existsSync } from 'node:fs';
import { getResolvedSiteCopy, getShellQualityFixtures } from '../apps/blog/site-copy.mjs';
import { getConceptOutputDir, siteProfiles } from '../apps/blog/site-profiles.mjs';
import { failIfFindings, readUtf8 } from './lib/repo-utils.mjs';

const repoRoot = process.cwd();
const blogRoot = path.join(repoRoot, 'apps', 'blog');
const findings = [];
const { bannedShellPhrases, mojibakePatterns, shellStopwords } = getShellQualityFixtures();

for (const [siteKey, site] of Object.entries(siteProfiles)) {
  for (const [conceptKey, concept] of Object.entries(site.concepts)) {
    const resolvedCopy = getResolvedSiteCopy(siteKey, conceptKey);
    const distRoot = path.join(
      blogRoot,
      getConceptOutputDir(siteKey, conceptKey).replace(/^\.\//u, ''),
    );
    const landingPath = path.join(distRoot, 'index.html');

    if (!existsSync(landingPath)) {
      findings.push(`${siteKey}/${conceptKey} is missing built landing page: ${path.relative(repoRoot, landingPath)}`);
      continue;
    }

    const landingHtml = await readUtf8(landingPath);
    const landingText = normalizeText(stripHtml(landingHtml));
    const renderedAnchors = extractAnchors(landingHtml);

    for (const pattern of mojibakePatterns) {
      if (pattern.test(landingHtml)) {
        findings.push(`${siteKey}/${conceptKey} landing contains mojibake or broken encoding`);
        break;
      }
    }

    for (const phrase of bannedShellPhrases) {
      if (landingText.includes(phrase.toLowerCase())) {
        findings.push(`${siteKey}/${conceptKey} landing contains banned internal phrase "${phrase}"`);
      }
    }

    const expectedSnippets = [
      resolvedCopy.shell.homeTitle,
      resolvedCopy.shell.homeDescription,
      resolvedCopy.shell.listingTitle,
      resolvedCopy.shell.footerTitle,
    ];
    if (concept.pageStructure === 'directory') {
      expectedSnippets.push(
        resolvedCopy.shell.directorySearchTitle,
        resolvedCopy.shell.directorySearchDescription,
      );
    }

    for (const snippet of expectedSnippets.filter(Boolean)) {
      if (!landingText.includes(normalizeText(snippet))) {
        findings.push(`${siteKey}/${conceptKey} landing is missing expected shell copy: "${snippet}"`);
      }
    }

    validateInternalLinks({
      site,
      concept,
      distRoot,
      anchors: renderedAnchors,
      findings,
    });

    await validateExternalLinks({
      siteKey,
      site,
      concept,
      anchors: renderedAnchors,
      resolvedCopy,
      findings,
      shellStopwords,
    });
  }
}

failIfFindings(findings, 'Rendered shell quality gate failed');
console.log('Rendered shell quality gate passed');

function validateInternalLinks({ site, concept, distRoot, anchors, findings }) {
  const conceptOrigin = new URL(concept.siteUrl).origin;

  for (const anchor of anchors) {
    if (!anchor.href || anchor.href.startsWith('#') || anchor.href.startsWith('mailto:')) {
      continue;
    }

    const resolvedUrl = safeUrl(anchor.href, concept.siteUrl);
    if (!resolvedUrl) {
      findings.push(`${site.key}/${concept.key} landing has an invalid href: ${anchor.href}`);
      continue;
    }

    if (resolvedUrl.origin !== conceptOrigin || !resolvedUrl.pathname.startsWith(concept.basePath)) {
      continue;
    }

    const outputPath = resolveConceptOutputPath(distRoot, concept.basePath, resolvedUrl.pathname);
    if (!outputPath || !existsSync(outputPath)) {
      findings.push(
        `${site.key}/${concept.key} landing links to missing concept output: ${resolvedUrl.pathname}`,
      );
    }
  }
}

async function validateExternalLinks({
  siteKey,
  site,
  concept,
  anchors,
  resolvedCopy,
  findings,
  shellStopwords,
}) {
  const conceptOrigin = new URL(concept.siteUrl).origin;
  const qualityByHref = buildQualityMap(site, resolvedCopy);
  const uniqueAnchors = dedupeAnchors(anchors);

  for (const anchor of uniqueAnchors) {
    if (!/^https?:\/\//u.test(anchor.href)) continue;

    const resolvedUrl = safeUrl(anchor.href, concept.siteUrl);
    if (!resolvedUrl || resolvedUrl.origin === conceptOrigin) {
      continue;
    }

    const quality = qualityByHref.get(resolvedUrl.toString()) ?? qualityByHref.get(stripTrailingSlash(resolvedUrl.toString()));
    if (!quality && siteKey !== 'kurs-ing') {
      continue;
    }

    try {
      const response = await fetch(resolvedUrl.toString(), { redirect: 'follow' });
      const finalUrl = new URL(response.url);
      const contentType = response.headers.get('content-type') ?? '';
      const responseText = await response.text();
      const visibleText = normalizeText(stripHtml(responseText));

      if (!response.ok) {
        findings.push(`${site.key}/${concept.key} link ${resolvedUrl} returned ${response.status}`);
        continue;
      }

      if (!contentType.includes('text/html')) {
        findings.push(`${site.key}/${concept.key} link ${resolvedUrl} did not return HTML content`);
        continue;
      }

      if (looksLikeSoft404(visibleText)) {
        findings.push(`${site.key}/${concept.key} link ${resolvedUrl} resolved to a soft 404 or error page`);
        continue;
      }

      if (visibleText.length < 200) {
        findings.push(`${site.key}/${concept.key} link ${resolvedUrl} does not look content-rich enough`);
        continue;
      }

      if (quality?.expectedHost && finalUrl.host !== quality.expectedHost) {
        findings.push(
          `${site.key}/${concept.key} link ${resolvedUrl} resolved to ${finalUrl.host}, expected ${quality.expectedHost}`,
        );
      }

      if (quality?.pathIncludes && !finalUrl.pathname.includes(quality.pathIncludes)) {
        findings.push(
          `${site.key}/${concept.key} link ${resolvedUrl} resolved to unexpected path ${finalUrl.pathname}`,
        );
      }

      if (quality?.mode === 'keyword') {
        const keywords = quality.requiredKeywords?.length
          ? quality.requiredKeywords
          : deriveKeywords(anchor.text, shellStopwords);
        const matchedKeywords = keywords.filter((keyword) => visibleText.includes(keyword.toLowerCase()));
        const minimumMatches = Math.min(2, keywords.length);
        if (matchedKeywords.length < minimumMatches) {
          findings.push(
            `${site.key}/${concept.key} link ${resolvedUrl} does not match expected intent strongly enough`,
          );
        }
      }
    } catch (error) {
      findings.push(
        `${site.key}/${concept.key} link ${resolvedUrl} could not be validated: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
}

function buildQualityMap(site, resolvedCopy) {
  const map = new Map();

  for (const link of resolvedCopy.courseLinks) {
    map.set(normalizeHref(`${site.brand.mainSiteUrl}${link.path}`), link.quality);
  }

  for (const cta of Object.values(resolvedCopy.callsToAction)) {
    map.set(normalizeHref(cta.href), cta.quality);
  }

  map.set(normalizeHref(site.brand.mainSiteUrl), {
    mode: 'destination',
    expectedHost: new URL(site.brand.mainSiteUrl).host,
    pathIncludes: '/',
  });

  return map;
}

function dedupeAnchors(anchors) {
  const seen = new Set();
  const results = [];

  for (const anchor of anchors) {
    const key = `${normalizeHref(anchor.href)}|${anchor.text}`;
    if (seen.has(key)) continue;
    seen.add(key);
    results.push(anchor);
  }

  return results;
}

function extractAnchors(html) {
  const anchors = [];
  const anchorPattern = /<a\b[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/giu;
  for (const match of html.matchAll(anchorPattern)) {
    anchors.push({
      href: match[1],
      text: stripHtml(match[2]).replace(/\s+/gu, ' ').trim(),
    });
  }
  return anchors;
}

function stripHtml(value) {
  return String(value ?? '')
    .replace(/<script[\s\S]*?<\/script>/giu, ' ')
    .replace(/<style[\s\S]*?<\/style>/giu, ' ')
    .replace(/<[^>]+>/gu, ' ')
    .replace(/&nbsp;/gu, ' ')
    .replace(/&amp;/gu, '&')
    .replace(/&quot;/gu, '"')
    .replace(/&#39;/gu, "'")
    .replace(/&lt;/gu, '<')
    .replace(/&gt;/gu, '>');
}

function normalizeText(value) {
  return stripHtml(value).replace(/\s+/gu, ' ').trim().toLowerCase();
}

function safeUrl(value, baseUrl) {
  try {
    return new URL(value, baseUrl);
  } catch {
    return null;
  }
}

function resolveConceptOutputPath(distRoot, basePath, pathname) {
  if (!pathname.startsWith(basePath)) {
    return null;
  }

  const relativePath = pathname.slice(basePath.length) || '/';
  if (relativePath === '/' || relativePath === '') {
    return path.join(distRoot, 'index.html');
  }
  if (/\.[a-z0-9]+$/iu.test(relativePath)) {
    return path.join(distRoot, relativePath.replace(/^\//u, ''));
  }
  return path.join(distRoot, relativePath.replace(/^\//u, ''), 'index.html');
}

function looksLikeSoft404(text) {
  const soft404Patterns = [
    /\b404\b/u,
    /page not found/u,
    /not found/u,
    /siden finnes ikke/u,
    /beklager,? du er kommet til en side som ikke eksisterer/u,
    /sorry, the page you were looking for/i,
  ];
  return soft404Patterns.some((pattern) => pattern.test(text));
}

function deriveKeywords(text, shellStopwords) {
  return [...new Set(
    String(text ?? '')
      .toLowerCase()
      .normalize('NFKD')
      .replace(/[^\p{Letter}\p{Number}\s-]/gu, ' ')
      .split(/\s+/u)
      .map((token) => token.trim())
      .filter((token) => token.length >= 4 && !shellStopwords.has(token)),
  )].slice(0, 5);
}

function normalizeHref(value) {
  return stripTrailingSlash(String(value ?? '').trim());
}

function stripTrailingSlash(value) {
  return value.endsWith('/') && !value.endsWith('://') ? value.replace(/\/+$/u, '') : value;
}
