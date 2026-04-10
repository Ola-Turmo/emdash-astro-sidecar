export type EvalMethod = 'llm-judge' | 'command' | 'rule';

export interface BinaryEvalCriterion {
  id: string;
  label: string;
  method: EvalMethod;
  command?: string;
  description: string;
}

export interface BinaryEvalResult {
  criterionId: string;
  passed: boolean;
  reason?: string;
  flaky?: boolean;
}

export interface EvalSuiteResult {
  itemId: string;
  totalPassed: number;
  totalCriteria: number;
  results: BinaryEvalResult[];
}

export interface DraftArtifactForEval {
  title: string;
  description: string;
  excerpt: string;
  sections: Array<{
    heading: string;
    body: string;
  }>;
  sourceCount: number;
  siteUrl: string;
}

const INTERNAL_JARGON_PATTERN =
  /\b(?:seo|geo|sidecar|innholdsbølge|programmatic seo|ai crawler|serp|top funnel)\b/i;

export function scoreEvalSuite(results: BinaryEvalResult[]): EvalSuiteResult['totalPassed'] {
  return results.filter((result) => result.passed).length;
}

export const defaultContentCriteria: BinaryEvalCriterion[] = [
  {
    id: 'single-h1',
    label: 'Exactly one H1',
    method: 'rule',
    description: 'The generated page should contain a single clear page title.',
  },
  {
    id: 'reader-first-copy',
    label: 'Reader-first copy',
    method: 'rule',
    description: 'Visible copy should sound natural to the reader and avoid internal jargon.',
  },
  {
    id: 'minimum-depth',
    label: 'Minimum depth',
    method: 'rule',
    description: 'The page should have enough structure and word count to answer the question clearly.',
  },
  {
    id: 'internal-links',
    label: 'Internal linking present',
    method: 'rule',
    description: 'The page should contain relevant first-party internal links.',
  },
  {
    id: 'evidence-threshold',
    label: 'Evidence threshold met',
    method: 'rule',
    description: 'Externally-derived claims should be supported by stable source material.',
  },
  {
    id: 'metadata-quality',
    label: 'Metadata quality',
    method: 'rule',
    description: 'Title, description, and excerpt should be present and reader-friendly.',
  },
];

export function evaluateDraftArtifact(input: DraftArtifactForEval): BinaryEvalResult[] {
  const visibleText = [input.title, input.description, input.excerpt]
    .concat(input.sections.map((section) => `${section.heading} ${section.body}`))
    .join(' ');
  const totalWordCount = countWords(visibleText);
  const internalLinkCount = countInternalLinks(visibleText, input.siteUrl);
  const sectionsWithBody = input.sections.filter(
    (section) => countWords(`${section.heading} ${section.body}`) >= 35,
  ).length;

  return [
    {
      criterionId: 'single-h1',
      passed: input.title.trim().length >= 20,
      reason:
        input.title.trim().length >= 20
          ? 'Draft has one clear page title.'
          : 'Draft title is too short to serve as a stable page heading.',
    },
    {
      criterionId: 'reader-first-copy',
      passed: !INTERNAL_JARGON_PATTERN.test(visibleText),
      reason: !INTERNAL_JARGON_PATTERN.test(visibleText)
        ? 'Visible copy avoids internal operator language.'
        : 'Visible copy still contains internal SEO or operator terminology.',
    },
    {
      criterionId: 'minimum-depth',
      passed: input.sections.length >= 3 && sectionsWithBody >= 3 && totalWordCount >= 320,
      reason:
        input.sections.length >= 3 && sectionsWithBody >= 3 && totalWordCount >= 320
          ? 'Draft has enough structure and detail to help the reader.'
          : 'Draft is still too thin or too short to answer the question well.',
    },
    {
      criterionId: 'internal-links',
      passed: internalLinkCount >= 2,
      reason:
        internalLinkCount >= 2
          ? 'Draft contains at least two relevant first-party links.'
          : 'Draft needs at least two relevant first-party links.',
    },
    {
      criterionId: 'evidence-threshold',
      passed: input.sourceCount >= 1,
      reason:
        input.sourceCount >= 1
          ? 'At least one source artifact exists for this host.'
          : 'No source artifact exists for this host yet.',
    },
    {
      criterionId: 'metadata-quality',
      passed:
        input.title.trim().length >= 20 &&
        input.description.trim().length >= 90 &&
        input.description.trim().length <= 170 &&
        input.excerpt.trim().length >= 120 &&
        input.excerpt.trim().length <= 230,
      reason:
        input.title.trim().length >= 20 &&
        input.description.trim().length >= 90 &&
        input.description.trim().length <= 170 &&
        input.excerpt.trim().length >= 120 &&
        input.excerpt.trim().length <= 230
          ? 'Title, description, and excerpt meet reader-facing quality thresholds.'
          : 'Metadata is missing or too weak for a safe publish path.',
    },
  ];
}

function countWords(value: string): number {
  return value
    .trim()
    .split(/\s+/)
    .filter(Boolean).length;
}

function countInternalLinks(value: string, siteUrl: string): number {
  const host = new URL(siteUrl).hostname.replace(/^www\./, '');
  const markdownLinks = [...value.matchAll(/\[[^\]]+\]\(([^)]+)\)/g)];
  return markdownLinks.filter((match) => {
    const target = match[1] ?? '';
    if (target.startsWith('/')) return true;
    try {
      const url = new URL(target);
      return url.hostname.replace(/^www\./, '') === host;
    } catch {
      return false;
    }
  }).length;
}
