import path from 'node:path';
import { normalizeText } from './municipality-evidence.mjs';
import { readUtf8, walkFiles } from './repo-utils.mjs';

export function splitFrontmatter(source) {
  const normalizedSource = String(source ?? '').replace(/^\uFEFF/, '');
  const match = normalizedSource.match(/^---\s*\r?\n([\s\S]*?)\r?\n---\s*\r?\n?([\s\S]*)$/);
  return {
    source: normalizedSource,
    frontmatter: match?.[1] ?? '',
    body: match?.[2] ?? '',
  };
}

export function capture(source, regex, fallback = '') {
  return source.match(regex)?.[1]?.trim() ?? fallback;
}

export function extractBlock(frontmatter, fieldName) {
  const lines = String(frontmatter ?? '').split(/\r?\n/);
  const startIndex = lines.findIndex((line) => line.trim() === `${fieldName}:`);
  if (startIndex < 0) {
    return '';
  }

  const blockLines = [];
  for (let index = startIndex + 1; index < lines.length; index += 1) {
    const line = lines[index];
    if (line && !/^\s/.test(line)) {
      break;
    }
    blockLines.push(line);
  }

  return blockLines.join('\n');
}

export function countYamlArrayItems(frontmatter, fieldName) {
  return (extractBlock(frontmatter, fieldName).match(/^\s*-\s/mg) || []).length;
}

export function extractYamlStringList(frontmatter, fieldName) {
  return [...extractBlock(frontmatter, fieldName).matchAll(/^\s*-\s*"(.+)"$/gm)]
    .map((match) => normalizeText(match[1] || ''))
    .filter(Boolean);
}

export function extractFrontmatterLinks(frontmatter, fieldName) {
  return [...extractBlock(frontmatter, fieldName).matchAll(/label:\s*"([^"]+)"[\s\S]*?url:\s*"([^"]+)"/g)]
    .map((match) => ({
      label: normalizeText(match[1] || ''),
      url: match[2] || '',
    }))
    .filter((entry) => entry.url);
}

export async function loadMunicipalityPages(repoRoot) {
  const municipalityRoot = path.join(repoRoot, 'apps', 'blog', 'src', 'content', 'municipalPages');
  const files = await walkFiles(municipalityRoot, (filePath) => filePath.endsWith('.mdx'));
  const entries = [];

  for (const filePath of files) {
    const source = await readUtf8(filePath);
    const { source: normalizedSource, frontmatter, body } = splitFrontmatter(source);
    const slug = path.basename(filePath, '.mdx');
    const municipality = normalizeText(capture(frontmatter, /^municipality:\s*"(.+)"$/m, slug));
    const title = normalizeText(capture(frontmatter, /^title:\s*"(.+)"$/m, municipality));
    const draft = capture(frontmatter, /^draft:\s*(true|false)$/m) === 'true';
    const publishable = capture(frontmatter, /^  publishable:\s*(true|false)$/m) === 'true';
    const qualityScore = Number(capture(frontmatter, /^  score:\s*([0-9]+)$/m, '-1'));

    entries.push({
      filePath,
      relativePath: path.relative(repoRoot, filePath),
      slug,
      source: normalizedSource,
      frontmatter,
      body,
      municipality,
      title,
      draft,
      publishable,
      qualityScore,
      hasHero: /^heroImage:/m.test(frontmatter),
      officialSourceCount: countYamlArrayItems(frontmatter, 'officialSources'),
      editorialTakeawayCount: countYamlArrayItems(frontmatter, 'editorialTakeaways'),
      practicalStepCount: countYamlArrayItems(frontmatter, 'practicalSteps'),
      checklistCount: countYamlArrayItems(frontmatter, 'localChecklist'),
      serviceLinkCount: countYamlArrayItems(frontmatter, 'serviceLinks'),
      regulationLinkCount: countYamlArrayItems(frontmatter, 'regulationsLinks'),
      bylawLinkCount: countYamlArrayItems(frontmatter, 'bylawLinks'),
      openingRuleCount: countYamlArrayItems(frontmatter, 'openingHoursRules'),
      servingRuleCount: countYamlArrayItems(frontmatter, 'alcoholServingRules'),
      editorialTakeaways: extractYamlStringList(frontmatter, 'editorialTakeaways'),
      officialSources: extractFrontmatterLinks(frontmatter, 'officialSources'),
    });
  }

  return entries.sort(
    (a, b) => b.qualityScore - a.qualityScore || a.municipality.localeCompare(b.municipality, 'nb'),
  );
}
