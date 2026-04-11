const RESERVED_SLUGS = new Set([
  'admin',
  'api',
  'author',
  'blog',
  'category',
  'css',
  'feed',
  'guides',
  'index',
  'json',
  'preview',
  'robots',
  'rss',
  'sitemap',
  'tag',
]);

const MOJIBAKE_PATTERN = /Ã.|Â.|â./;

const COMMON_MOJIBAKE_REPLACEMENTS: Array<[pattern: RegExp, replacement: string]> = [
  [/Ã¦/g, 'æ'],
  [/Ã†/g, 'Æ'],
  [/Ã¸/g, 'ø'],
  [/Ã˜/g, 'Ø'],
  [/Ã¥/g, 'å'],
  [/Ã…/g, 'Å'],
  [/â€“/g, '–'],
  [/â€”/g, '—'],
  [/â€˜/g, '‘'],
  [/â€™/g, '’'],
  [/â€œ/g, '“'],
  [/â€/g, '”'],
  [/Â/g, ''],
];

export function repairCommonMojibake(value: string): string {
  if (!value) return '';

  let next = value;
  for (const [pattern, replacement] of COMMON_MOJIBAKE_REPLACEMENTS) {
    next = next.replace(pattern, replacement);
  }

  if (MOJIBAKE_PATTERN.test(next)) {
    try {
      const repaired = decodeLatin1AsUtf8(next);
      if (looksLessBroken(repaired, next)) {
        next = repaired;
      }
    } catch {
      // Leave original text intact if conversion fails.
    }
  }

  return next;
}

export function normalizeSearchText(value: string): string {
  return repairCommonMojibake(value)
    .replace(/\r\n/g, '\n')
    .replace(/\s+/g, ' ')
    .trim();
}

export function transliterateForSlug(value: string): string {
  return normalizeSearchText(value)
    .replace(/[æÆ]/g, 'ae')
    .replace(/[øØ]/g, 'o')
    .replace(/[åÅ]/g, 'a')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

export function buildSemanticSlug(
  value: string,
  options: {
    fallback?: string;
    maxLength?: number;
  } = {},
): string {
  const fallback = options.fallback ?? 'article';
  const maxLength = options.maxLength ?? 72;

  const normalized = transliterateForSlug(value)
    .toLowerCase()
    .replace(/https?:\/\/\S+/g, ' ')
    .replace(/&/g, ' og ')
    .replace(/['"“”‘’`´]+/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^-+|-+$/g, '');

  const cleaned = normalized
    .split('-')
    .filter((token) => token && token.length > 1)
    .filter((token, index, tokens) => index === 0 || token !== tokens[index - 1])
    .join('-')
    .slice(0, maxLength)
    .replace(/-+$/g, '');

  const usable = cleaned && !RESERVED_SLUGS.has(cleaned) ? cleaned : buildFallbackSlug(fallback);
  if (usable.length >= 3) {
    return usable;
  }

  return buildFallbackSlug(fallback);
}

export function normalizeSemanticTag(value: string): string {
  return buildSemanticSlug(value, {
    fallback: 'tag',
    maxLength: 40,
  });
}

function buildFallbackSlug(value: string): string {
  const fallback = transliterateForSlug(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
    .replace(/-+$/g, '');

  if (fallback && fallback.length >= 3 && !RESERVED_SLUGS.has(fallback)) {
    return fallback;
  }

  return 'article';
}

function looksLessBroken(candidate: string, baseline: string): boolean {
  const suspiciousChars = (input: string) => (input.match(/[ÃÂâ]/g) ?? []).length;
  return suspiciousChars(candidate) < suspiciousChars(baseline);
}

function decodeLatin1AsUtf8(value: string): string {
  const bytes = new Uint8Array([...value].map((char) => char.charCodeAt(0) & 0xff));
  return new TextDecoder('utf-8', { fatal: false }).decode(bytes);
}
