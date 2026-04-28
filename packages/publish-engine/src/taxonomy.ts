import { normalizeSearchText, normalizeSemanticTag } from '../../model-runtime/src/index.js';

export type ContentModel = 'norway-alcohol' | 'generic-structured';

/**
 * Resolve EMDASH_CONTENT_MODEL from environment.
 * Defaults to 'norway-alcohol' for backward compatibility.
 */
export function resolveContentModel(envValue?: string): ContentModel {
  if (envValue === 'generic-structured') return 'generic-structured';
  return 'norway-alcohol';
}

export type NorwayCategory =
  | 'etablererproven'
  | 'skjenkebevilling'
  | 'salgsbevilling'
  | 'kommune';

export type GenericCategory = 'guide' | 'how-to' | 'explain' | 'overview';

export type ControlledCategory = NorwayCategory | GenericCategory;

// ---------------------------------------------------------------------------
// Norway-alcohol content model
// ---------------------------------------------------------------------------

const NORWAY_TAGS = [
  'alkoholloven',
  'ansvar',
  'arbeidsflyt',
  'besta',
  'bevillingsprosess',
  'dokumentasjon',
  'etablererproven',
  'forberedelse',
  'internkontroll',
  'kommune',
  'kommunens-prove',
  'krav',
  'pensum',
  'praksis',
  'roller',
  'salgsbevilling',
  'serveringsloven',
  'skjenkebevilling',
  'stedfortreder',
  'styrer',
  'vanlige-feil',
] as const;

const NORWAY_SEMANTIC_TAG_MAP: Array<[needle: string, tag: (typeof NORWAY_TAGS)[number]]> = [
  ['alkoholloven', 'alkoholloven'],
  ['serveringsloven', 'serveringsloven'],
  ['etablererprøven', 'etablererproven'],
  ['etablererproven', 'etablererproven'],
  ['skjenkebevilling', 'skjenkebevilling'],
  ['salgsbevilling', 'salgsbevilling'],
  ['styrer', 'styrer'],
  ['stedfortreder', 'stedfortreder'],
  ['pensum', 'pensum'],
  ['vanlige feil', 'vanlige-feil'],
  ['forberede', 'forberedelse'],
  ['bestå', 'besta'],
  ['besta', 'besta'],
  ['ansvar', 'ansvar'],
  ['internkontroll', 'internkontroll'],
  ['kommune', 'kommune'],
  ['kommunens prøve', 'kommunens-prove'],
  ['kommunens prove', 'kommunens-prove'],
  ['søknad', 'bevillingsprosess'],
  ['soknad', 'bevillingsprosess'],
  ['dokumentasjon', 'dokumentasjon'],
  ['roller', 'roller'],
  ['praksis', 'praksis'],
  ['krav', 'krav'],
];

function inferNorwayCategory(input: {
  slug?: string | null;
  topic?: string | null;
  title?: string | null;
  sections?: Array<{ heading: string; body: string }>;
}): NorwayCategory {
  const haystack = normalizeSearchText(
    [
      input.slug ?? '',
      input.topic ?? '',
      input.title ?? '',
      ...(input.sections ?? []).map((section) => `${section.heading} ${section.body}`),
    ].join(' '),
  ).toLowerCase();

  if (haystack.includes('kommune')) return 'kommune';
  if (haystack.includes('skjenk')) return 'skjenkebevilling';
  if (haystack.includes('etablerer')) return 'etablererproven';
  return 'salgsbevilling';
}

function buildNorwayTags(input: {
  category: NorwayCategory;
  slug?: string | null;
  topic?: string | null;
  title?: string | null;
  sections?: Array<{ heading: string; body: string }>;
}): string[] {
  const haystack = normalizeSearchText(
    [
      input.slug ?? '',
      input.topic ?? '',
      input.title ?? '',
      ...(input.sections ?? []).map((section) => `${section.heading} ${section.body}`),
    ].join(' '),
  ).toLowerCase();

  const tags = new Set<string>([input.category]);
  for (const [needle, tag] of NORWAY_SEMANTIC_TAG_MAP) {
    if (haystack.includes(needle)) {
      tags.add(tag);
    }
  }

  for (const token of extractControlledTokens(haystack, new Set<string>(NORWAY_TAGS))) {
    tags.add(token);
    if (tags.size >= 6) break;
  }

  if (tags.size < 3) {
    tags.add('krav');
    tags.add('forberedelse');
  }

  return [...tags].slice(0, 6);
}

// ---------------------------------------------------------------------------
// Generic-structured content model
// ---------------------------------------------------------------------------

const GENERIC_TAGS = [
  'guide',
  'how-to',
  'explain',
  'overview',
  'tutorial',
  'reference',
  'faq',
  'tips',
  'beginner',
  'advanced',
] as const;

const GENERIC_SEMANTIC_TAG_MAP: Array<[needle: string, tag: (typeof GENERIC_TAGS)[number]]> = [
  ['how to', 'how-to'],
  ['howto', 'how-to'],
  ['tutorial', 'tutorial'],
  ['guide', 'guide'],
  ['explain', 'explain'],
  ['overview', 'overview'],
  ['faq', 'faq'],
  ['tips', 'tips'],
  ['beginner', 'beginner'],
  ['advanced', 'advanced'],
  ['reference', 'reference'],
  ['step by step', 'how-to'],
  ['getting started', 'beginner'],
];

function inferGenericCategory(input: {
  slug?: string | null;
  topic?: string | null;
  title?: string | null;
  sections?: Array<{ heading: string; body: string }>;
}): GenericCategory {
  const haystack = normalizeSearchText(
    [
      input.slug ?? '',
      input.topic ?? '',
      input.title ?? '',
      ...(input.sections ?? []).map((section) => `${section.heading} ${section.body}`),
    ].join(' '),
  ).toLowerCase();

  if (haystack.includes('how to') || haystack.includes('howto') || haystack.includes('step by step')) return 'how-to';
  if (haystack.includes('explain') || haystack.includes('what is') || haystack.includes('forstå')) return 'explain';
  if (haystack.includes('overview') || haystack.includes('summary') || haystack.includes('oversikt')) return 'overview';
  if (haystack.includes('tutorial') || haystack.includes('guide')) return 'guide';
  return 'guide';
}

function buildGenericTags(input: {
  category: GenericCategory;
  slug?: string | null;
  topic?: string | null;
  title?: string | null;
  sections?: Array<{ heading: string; body: string }>;
}): string[] {
  const haystack = normalizeSearchText(
    [
      input.slug ?? '',
      input.topic ?? '',
      input.title ?? '',
      ...(input.sections ?? []).map((section) => `${section.heading} ${section.body}`),
    ].join(' '),
  ).toLowerCase();

  const tags = new Set<string>([input.category]);
  for (const [needle, tag] of GENERIC_SEMANTIC_TAG_MAP) {
    if (haystack.includes(needle)) {
      tags.add(tag);
    }
  }

  for (const token of extractControlledTokens(haystack, new Set<string>(GENERIC_TAGS))) {
    tags.add(token);
    if (tags.size >= 6) break;
  }

  if (tags.size < 2) {
    tags.add('guide');
  }

  return [...tags].slice(0, 5);
}

// ---------------------------------------------------------------------------
// Generic token extractor (shared)
// ---------------------------------------------------------------------------

function extractControlledTokens(haystack: string, allowed: Set<string>): string[] {
  const tokens = haystack
    .split(/[^a-z0-9æøå-]+/i)
    .map((token) => normalizeSemanticTag(token))
    .filter((token) => token.length >= 4 && allowed.has(token));

  return [...new Set(tokens)];
}

// ---------------------------------------------------------------------------
// Public API — dispatches based on content model
// ---------------------------------------------------------------------------

/**
 * Controlled tag vocabulary. Returns Norway-specific tags by default,
 * or generic tags when contentModel is 'generic-structured'.
 */
export function resolveControlledVocabulary(contentModel: ContentModel = 'norway-alcohol'): readonly string[] {
  if (contentModel === 'generic-structured') return GENERIC_TAGS;
  return NORWAY_TAGS;
}

/**
 * @deprecated Use resolveControlledVocabulary() directly when contentModel is known.
 *             Kept for backward compatibility — returns NORWAY_TAGS.
 */
export const CONTROLLED_TAG_VOCABULARY = NORWAY_TAGS;

/**
 * Infer the content-category from the input fields.
 * Dispatches to Norway or generic logic based on contentModel.
 */
export function inferControlledCategory(
  input: {
    slug?: string | null;
    topic?: string | null;
    title?: string | null;
    sections?: Array<{ heading: string; body: string }>;
  },
  contentModel: ContentModel = 'norway-alcohol',
): ControlledCategory {
  if (contentModel === 'generic-structured') {
    return inferGenericCategory(input);
  }
  return inferNorwayCategory(input);
}

/**
 * Build controlled semantic tags from the input fields.
 * Dispatches to Norway or generic logic based on contentModel.
 */
export function buildControlledTags(
  input: {
    category: ControlledCategory;
    slug?: string | null;
    topic?: string | null;
    title?: string | null;
    sections?: Array<{ heading: string; body: string }>;
  },
  contentModel: ContentModel = 'norway-alcohol',
): string[] {
  if (contentModel === 'generic-structured') {
    return buildGenericTags(input as Parameters<typeof buildGenericTags>[0]);
  }
  return buildNorwayTags(input as Parameters<typeof buildNorwayTags>[0]);
}
