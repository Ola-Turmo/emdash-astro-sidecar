#!/usr/bin/env node

import path from 'node:path';
import { readUtf8, walkFiles, failIfFindings } from './lib/repo-utils.mjs';

const repoRoot = process.cwd();
const municipalityRoot = path.join(repoRoot, 'apps', 'blog', 'src', 'content', 'municipalPages');
const findings = [];
// Kommune pages intentionally share a strong legal-service skeleton, so only near-clones
// should fail the similarity gate.
const MAX_CONTENT_SIMILARITY = 0.98;
const stopWords = new Set([
  'denne',
  'kommunen',
  'kommune',
  'videre',
  'guide',
  'kursing',
  'kurs',
  'siden',
  'bruk',
  'hovedsiden',
  'skjema',
  'innsyn',
  'servering',
  'skjenking',
  'lenker',
  'dette',
  'lokale',
  'salg',
]);

const files = await walkFiles(municipalityRoot, (filePath) => filePath.endsWith('.mdx'));
const entries = [];
let publishedCount = 0;

for (const filePath of files) {
  const relative = path.relative(repoRoot, filePath);
  const source = await readUtf8(filePath);
  const normalizedSource = source.replace(/^\uFEFF/, '');
  const frontmatterMatch = normalizedSource.match(/^---\s*\r?\n([\s\S]*?)\r?\n---\s*\r?\n?([\s\S]*)$/);
  const frontmatter = frontmatterMatch?.[1] ?? '';
  const body = frontmatterMatch?.[2] ?? '';
  const municipality = capture(frontmatter, /^municipality:\s*"(.+)"$/m);
  const title = capture(frontmatter, /^title:\s*"(.+)"$/m);
  const description = capture(frontmatter, /^description:\s*"(.+)"$/m);
  const officialSourceCount = countYamlArrayItems(frontmatter, 'officialSources');
  const editorialTakeawayCount = countYamlArrayItems(frontmatter, 'editorialTakeaways');
  const practicalStepCount = countYamlArrayItems(frontmatter, 'practicalSteps');
  const serviceLinkCount = countYamlArrayItems(frontmatter, 'serviceLinks');
  const regulationLinkCount = countYamlArrayItems(frontmatter, 'regulationsLinks');
  const bylawLinkCount = countYamlArrayItems(frontmatter, 'bylawLinks');
  const checklistCount = countYamlArrayItems(frontmatter, 'localChecklist');
  const relatedGuideCount = countYamlArrayItems(frontmatter, 'relatedGuideLinks');
  const servingRuleCount = countYamlArrayItems(frontmatter, 'alcoholServingRules');
  const openingRuleCount = countYamlArrayItems(frontmatter, 'openingHoursRules');
  const bodyWordCount = countWords(body);
  const draft = capture(frontmatter, /^draft:\s*(true|false)$/m) === 'true';
  const qualityScore = Number(capture(frontmatter, /^  score:\s*([0-9]+)$/m) || '0');
  const publishable = capture(frontmatter, /^  publishable:\s*(true|false)$/m) === 'true';
  const editorialLead = capture(frontmatter, /^editorialLead:\s*"(.+)"$/m) ?? '';

  entries.push({
    relative,
    draft,
    body: `${body}\n${frontmatter}`,
    municipality,
  });

  if (!draft) publishedCount += 1;

  if (!municipality) {
    findings.push(`${relative} is missing municipality frontmatter`);
  }
  if (!title || !title.includes(municipality ?? '')) {
    findings.push(`${relative} needs a title that includes the municipality name`);
  }
  if (!draft && /kommunale sider du faktisk trenger/i.test(title || '')) {
    findings.push(`${relative} uses an over-generic title pattern that should not be published`);
  }
  if (!description || description.length < 110) {
    findings.push(`${relative} needs a more informative description`);
  }
  if (!draft && /^se hva .+ faktisk oppgir /i.test(description || '')) {
    findings.push(`${relative} uses a generic description pattern and needs a more user-focused summary`);
  }
  if (!frontmatter.includes('municipalityQuality:')) {
    findings.push(`${relative} is missing municipalityQuality frontmatter`);
  }
  if (!draft && (!publishable || qualityScore < 8)) {
    findings.push(`${relative} is published without clearing the municipality quality threshold`);
  }
  if (!draft && officialSourceCount < 2) {
    findings.push(`${relative} must include at least 2 officialSources`);
  }
  if (!draft && editorialTakeawayCount < 3) {
    findings.push(`${relative} must include at least 3 editorialTakeaways when published`);
  }
  if (!draft && practicalStepCount < 4) {
    findings.push(`${relative} must include at least 4 practicalSteps when published`);
  }
  if (!draft && editorialLead.length < 90) {
    findings.push(`${relative} needs a stronger editorialLead for published municipality pages`);
  }
  if (!draft && /^her ser du hva /i.test(editorialLead)) {
    findings.push(`${relative} uses a generic editorialLead pattern and needs a stronger opening`);
  }
  if (!draft && openingRuleCount === 0 && /åpent til|åpningstid for serveringssted|serveringsstedet kan holde åpent|serveringssteder kan holde åpent/i.test(source)) {
    findings.push(`${relative} mentions unsupported opening-time claims without a confirmed openingHoursRules source`);
  }
  if (!draft && !frontmatter.includes('alcoholPolicyPlanUrl:') && /alkoholpolitisk|handlingsplan/i.test(source)) {
    findings.push(`${relative} mentions an alcohol policy plan or handlingsplan without a verified alcoholPolicyPlanUrl`);
  }
  if (!draft && serviceLinkCount + regulationLinkCount + bylawLinkCount < 2 && !frontmatter.includes('alcoholPolicyPlanUrl:')) {
    findings.push(`${relative} must include at least 2 municipality-specific links or a plan URL`);
  }
  if (!draft && checklistCount < 4) {
    findings.push(`${relative} must include at least 4 localChecklist items`);
  }
  if (!draft && relatedGuideCount < 3) {
    findings.push(`${relative} must include at least 3 relatedGuideLinks`);
  }
  if (!draft && servingRuleCount + openingRuleCount < 1) {
    findings.push(`${relative} must include at least 1 local time rule`);
  }
  if (!draft && bodyWordCount < 40) {
    findings.push(`${relative} body is too short for a kommune page (${bodyWordCount} words)`);
  }

  for (const banned of [
    'Cloudflare',
    'sidecar',
    'autonome',
    'autonomous',
    'Relevant kommuneside',
    'Forskrift 1',
    'Vedtekt 1',
    'Denne siden samler praktiske innganger for kommune',
    'Organisasjonsnummer:',
    'Bankkontonummer:',
    'Skriv til oss',
    'Faktura til kommunen',
    'Kommunen publiserer stoffet sitt på',
    'det lønner seg å følge temasidene direkte',
    'kommunale lenker',
    'praktiske innganger',
  ]) {
    if (!draft && source.toLowerCase().includes(banned.toLowerCase())) {
      findings.push(`${relative} contains internal or placeholder wording "${banned}"`);
    }
  }
}

for (let index = 0; index < entries.length; index += 1) {
  for (let compareIndex = index + 1; compareIndex < entries.length; compareIndex += 1) {
    const a = entries[index];
    const b = entries[compareIndex];
    if (a.draft || b.draft) {
      continue;
    }
    const similarity = jaccardSimilarity(
      normalizeForSimilarity(a.body),
      normalizeForSimilarity(b.body),
    );
    if (similarity > MAX_CONTENT_SIMILARITY) {
      findings.push(
        `${a.relative} and ${b.relative} are too similar (${similarity.toFixed(2)}); kommune pages need more municipality-specific content`,
      );
    }
  }
}

failIfFindings(findings, 'Municipality content gate failed');
console.log('Municipality content gate passed');

function capture(source, regex) {
  return source.match(regex)?.[1]?.trim() ?? null;
}

function countYamlArrayItems(source, fieldName) {
  const match = source.match(new RegExp(`${fieldName}:\\r?\\n([\\s\\S]*?)(?:\\r?\\n[a-zA-Z]|$)`));
  if (!match) return 0;
  return (match[1].match(/^\s*-\s/mg) || []).length;
}

function countWords(value) {
  return value.trim().split(/\s+/).filter(Boolean).length;
}

function normalizeForSimilarity(value) {
  return new Set(
    value
      .toLowerCase()
      .replace(/[^a-z0-9æøå\s]/gi, ' ')
      .split(/\s+/)
      .filter((token) => token.length >= 5)
      .filter((token) => !stopWords.has(token)),
  );
}

function jaccardSimilarity(a, b) {
  const intersection = [...a].filter((token) => b.has(token)).length;
  const union = new Set([...a, ...b]).size;
  return union === 0 ? 0 : intersection / union;
}
