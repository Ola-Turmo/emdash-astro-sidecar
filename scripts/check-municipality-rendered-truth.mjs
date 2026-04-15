#!/usr/bin/env node

import path from 'node:path';
import { readUtf8, walkFiles, failIfFindings } from './lib/repo-utils.mjs';
import { inspectMunicipalityUrl, normalizeText } from './lib/municipality-evidence.mjs';

const repoRoot = process.cwd();
const municipalityRoot = path.join(repoRoot, 'apps', 'blog', 'src', 'content', 'municipalPages');
const distRoot = path.join(repoRoot, 'apps', 'blog', 'dist', 'kurs-ing', 'kommune');
const findings = [];

const files = await walkFiles(municipalityRoot, (filePath) => filePath.endsWith('.mdx'));

for (const filePath of files) {
  const source = await readUtf8(filePath);
  const normalizedSource = source.replace(/^\uFEFF/, '');
  const frontmatterMatch = normalizedSource.match(/^---\s*\r?\n([\s\S]*?)\r?\n---\s*\r?\n?([\s\S]*)$/);
  const frontmatter = frontmatterMatch?.[1] ?? '';
  const draft = capture(frontmatter, /^draft:\s*(true|false)$/m) === 'true';
  if (draft) continue;

  const slug = path.basename(filePath, '.mdx');
  const htmlPath = path.join(distRoot, slug, 'index.html');
  const html = await readUtf8(htmlPath);
  const plain = normalizeText(stripHtml(html));

  const openingRuleCount = countYamlArrayItems(frontmatter, 'openingHoursRules');
  const alcoholPolicyPlanUrl = capture(frontmatter, /^alcoholPolicyPlanUrl:\s*"(.+)"$/m);
  const summaryRows = extractDefinitionTerms(html);
  const hasRenderedOpeningTimeline =
    /<p[^>]*>\s*Åpning\s*<\/p>/i.test(html) ||
    /åpningstid:\s|utvidet åpningstid/i.test(plain);

  if (openingRuleCount === 0 && hasRenderedOpeningTimeline) {
    findings.push(`${path.relative(repoRoot, htmlPath)} renders opening-time claims without confirmed openingHoursRules`);
  }

  if (!alcoholPolicyPlanUrl && /alkoholpolitisk|handlingsplan/i.test(plain)) {
    findings.push(`${path.relative(repoRoot, htmlPath)} still renders a plan or handlingsplan reference without a verified plan URL`);
  }

  if (summaryRows.includes('Åpningstid') && openingRuleCount === 0) {
    findings.push(`${path.relative(repoRoot, htmlPath)} shows Åpningstid in Kort oppsummert without a confirmed opening rule`);
  }

  const anchors = [...html.matchAll(/<a[^>]+href="([^"]+)"/g)].map((match) => match[1]);
  const municipalAnchors = anchors.filter(
    (href) =>
      /^https:\/\/(www\.)?[^"]+/.test(href) &&
      !href.includes('kurs.ing') &&
      !isGenericMunicipalityHomepage(href),
  );
  for (const href of municipalAnchors) {
    const kind = inferKindFromHref(href, plain);
    const inspection = await inspectMunicipalityUrl(href, kind);
    if (!inspection.ok) {
      findings.push(`${path.relative(repoRoot, htmlPath)} renders broken or semantically wrong municipality link ${href} (${inspection.reason})`);
    }
  }
}

failIfFindings(findings, 'Municipality rendered-truth gate failed');
console.log('Municipality rendered-truth gate passed');

function capture(source, regex) {
  return source.match(regex)?.[1]?.trim() ?? '';
}

function countYamlArrayItems(source, fieldName) {
  const match = source.match(new RegExp(`${fieldName}:\\r?\\n([\\s\\S]*?)(?:\\r?\\n[a-zA-Z]|$)`));
  if (!match) return 0;
  return (match[1].match(/^\s*-\s/mg) || []).length;
}

function stripHtml(value) {
  return String(value ?? '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractDefinitionTerms(html) {
  return [...html.matchAll(/<dt[^>]*>(.*?)<\/dt>/g)].map((match) => normalizeText(stripHtml(match[1] || '')));
}

function inferKindFromHref(href, pageText) {
  const lowerHref = href.toLowerCase();
  if (/einnsyn|innsyn|postliste|journal/.test(lowerHref)) return 'publicRecords';
  if (/skjema/.test(lowerHref)) return 'forms';
  if (/salgsbevilling/.test(lowerHref)) return 'sales';
  if (/skjenkebevilling/.test(lowerHref)) return 'serving';
  if (/serveringsbevilling/.test(lowerHref)) return 'servering';
  if (/arrangement|enkelt/.test(lowerHref)) return 'singleEvent';
  if (/kontroll|regelbrudd|prikktildeling|omsetningsoppgave/.test(lowerHref)) return 'controls';
  if (/prove|prøve|etablerer|kunnskap/.test(lowerHref)) return 'exam';
  if (/regel|vilkår/.test(lowerHref)) return 'rules';
  if (/alkohol|skjenk|salg|servering/.test(lowerHref)) return 'serviceHub';
  if (/plan|retningslinje/.test(pageText.toLowerCase())) return 'plan';
  return 'general';
}

function isGenericMunicipalityHomepage(href) {
  try {
    const url = new URL(href);
    const pathname = url.pathname.replace(/\/+$/, '') || '/';
    return pathname === '/';
  } catch {
    return false;
  }
}
