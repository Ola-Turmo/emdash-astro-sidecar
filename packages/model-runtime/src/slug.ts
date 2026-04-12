const RESERVED_SLUGS = new Set([
  'admin',
  'api',
  'author',
  'blog',
  'category',
  'css',
  'feed',
  'index',
  'json',
  'kommune',
  'preview',
  'robots',
  'rss',
  'sitemap',
  'tag',
]);

const MOJIBAKE_PATTERN =
  /(?:\u00c3|\u00c2|\u00e2[\u0080-\u00bf]|\u00ef\u00bf\u00bd|Ã|Â|â)/;

const COMMON_MOJIBAKE_REPLACEMENTS: Array<[pattern: RegExp, replacement: string]> = [
  [/\u00c3\u00a6/g, '\u00e6'],
  [/\u00c3\u00b8/g, '\u00f8'],
  [/\u00c3\u00a5/g, '\u00e5'],
  [/\u00c3\u2020/g, '\u00c6'],
  [/\u00c3\u02dc/g, '\u00d8'],
  [/\u00c3\u2026/g, '\u00c5'],
  [/\u00e2\u20ac\u201c/g, '-'],
  [/\u00e2\u20ac\u201d/g, '-'],
  [/\u00e2\u20ac\u02dc/g, "'"],
  [/\u00e2\u20ac\u2122/g, "'"],
  [/\u00e2\u20ac\u0153/g, '"'],
  [/\u00e2\u20ac/g, '"'],
  [/\u00c2/g, ''],
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
      // Keep the safer baseline if decoding fails.
    }
  }

  return next;
}

export function normalizeSearchText(value: string): string {
  return repairCommonMojibake(value)
    .replace(/\r\n/g, '\n')
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function transliterateForSlug(value: string): string {
  return normalizeSearchText(value)
    .replace(/[\u00e6\u00c6]/g, 'ae')
    .replace(/[\u00f8\u00d8]/g, 'o')
    .replace(/[\u00e5\u00c5]/g, 'a')
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
    .replace(/['"`´]+/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^-+|-+$/g, '');

  const deduped = normalized
    .split('-')
    .filter((token) => token && token.length > 1)
    .filter((token, index, tokens) => index === 0 || token !== tokens[index - 1])
    .join('-')
    .slice(0, maxLength)
    .replace(/-+$/g, '');

  const usable = deduped && !RESERVED_SLUGS.has(deduped) ? deduped : buildFallbackSlug(fallback);
  return usable.length >= 3 ? usable : buildFallbackSlug(fallback);
}

export function normalizeSemanticTag(value: string): string {
  return buildSemanticSlug(value, {
    fallback: 'tag',
    maxLength: 40,
  });
}

export function isValidSemanticSlug(value: string): boolean {
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value) && value.length >= 3 && !RESERVED_SLUGS.has(value);
}

export function repairExistingSlug(value: string, fallback = 'article'): string {
  const normalized = normalizeSearchText(value)
    .replace(/\//g, ' ')
    .replace(/_/g, ' ')
    .replace(/-{2,}/g, '-');

  return buildSemanticSlug(normalized, { fallback });
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
  const suspiciousChars = (input: string) => (input.match(/[\u00c3\u00c2\u00e2ÃÂâ]/g) ?? []).length;
  return suspiciousChars(candidate) < suspiciousChars(baseline);
}

function decodeLatin1AsUtf8(value: string): string {
  const bytes = new Uint8Array([...value].map((char) => char.charCodeAt(0) & 0xff));
  return new TextDecoder('utf-8', { fatal: false }).decode(bytes);
}
