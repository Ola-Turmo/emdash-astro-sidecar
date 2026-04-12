import { normalizeSearchText, normalizeSemanticTag } from '../../model-runtime/src/index.js';

export type ControlledCategory =
  | 'etablererproven'
  | 'skjenkebevilling'
  | 'salgsbevilling'
  | 'kommune';

export const CONTROLLED_TAG_VOCABULARY = [
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

const semanticTagMap: Array<[needle: string, tag: (typeof CONTROLLED_TAG_VOCABULARY)[number]]> = [
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

export function inferControlledCategory(input: {
  slug?: string | null;
  topic?: string | null;
  title?: string | null;
  sections?: Array<{ heading: string; body: string }>;
}): ControlledCategory {
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

export function buildControlledTags(input: {
  category: ControlledCategory;
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
  for (const [needle, tag] of semanticTagMap) {
    if (haystack.includes(needle)) {
      tags.add(tag);
    }
  }

  for (const token of extractControlledTokens(haystack)) {
    tags.add(token);
    if (tags.size >= 6) break;
  }

  if (tags.size < 3) {
    tags.add('krav');
    tags.add('forberedelse');
  }

  return [...tags].slice(0, 6);
}

function extractControlledTokens(haystack: string): string[] {
  const allowed = new Set<string>(CONTROLLED_TAG_VOCABULARY);
  const tokens = haystack
    .split(/[^a-z0-9æøå-]+/i)
    .map((token) => normalizeSemanticTag(token))
    .filter((token) => token.length >= 4 && allowed.has(token));

  return [...new Set(tokens)];
}
