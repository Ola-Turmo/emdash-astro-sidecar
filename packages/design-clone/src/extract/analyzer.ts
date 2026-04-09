import * as cheerio from 'cheerio';
import { load } from 'cheerio';
import type {
  ExtractedColors,
  ExtractedTypography,
  ExtractedSpacing,
  ExtractedBorders,
  ExtractedShadows,
  ExtractedComponents,
  ExtractedLayout,
  ExtractedDesign,
  ButtonStyle,
  CardStyle,
  InputStyle,
  NavStyle,
} from '../types.ts';

const REQUEST_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (compatible; DesignCloneBot/1.0; +https://emdash.dev)',
};

async function fetchText(url: string): Promise<{ text: string; finalUrl: string }> {
  const response = await fetch(url, { headers: REQUEST_HEADERS });

  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${response.status} ${response.statusText}`);
  }

  return {
    text: await response.text(),
    finalUrl: response.url,
  };
}

/**
 * Fetch a URL and return its HTML content
 */
export async function fetchPage(url: string): Promise<{ html: string; finalUrl: string }> {
  const response = await fetchText(url);

  return {
    html: response.text,
    finalUrl: response.finalUrl,
  };
}

async function fetchLinkedStylesheets(html: string, baseUrl: string): Promise<string[]> {
  const $ = load(html);
  const hrefs = new Set<string>();

  $('link[rel="stylesheet"]').each((_, element) => {
    const href = $(element).attr('href');
    if (!href || href.startsWith('data:')) return;

    try {
      hrefs.add(new URL(href, baseUrl).href);
    } catch {
      // Ignore malformed URLs.
    }
  });

  const cssTexts = await Promise.all(
    [...hrefs].map(async (href) => {
      try {
        const response = await fetchText(href);
        return response.text;
      } catch {
        return '';
      }
    }),
  );

  return cssTexts.filter(Boolean);
}

function collectStylesheets(html: string, linkedStylesheets: string[]): string[] {
  const $ = load(html);
  const inlineStyles: string[] = [];

  $('style').each((_, element) => {
    const cssText = $(element).html()?.trim();
    if (cssText) inlineStyles.push(cssText);
  });

  return [...inlineStyles, ...linkedStylesheets];
}

/**
 * Parse CSS custom properties from a stylesheet
 */
function parseCssVariables(cssText: string): Record<string, string> {
  const vars: Record<string, string> = {};
  const regex = /--([a-zA-Z0-9-_]+)\s*:\s*([^;]+)/g;
  let match;
  while ((match = regex.exec(cssText)) !== null) {
    vars[`--${match[1]}`] = match[2].trim();
  }
  return vars;
}

function parseColorToRgb(color: string): { r: number; g: number; b: number } | null {
  const normalized = color.trim().toLowerCase();

  if (normalized.startsWith('#')) {
    const hex = normalized.slice(1);
    if (![3, 4, 6, 8].includes(hex.length)) return null;

    const expanded = hex.length <= 4
      ? hex
          .slice(0, hex.length === 4 ? 3 : hex.length)
          .split('')
          .map((char) => char + char)
          .join('')
      : hex.slice(0, 6);

    return {
      r: parseInt(expanded.slice(0, 2), 16),
      g: parseInt(expanded.slice(2, 4), 16),
      b: parseInt(expanded.slice(4, 6), 16),
    };
  }

  const rgbMatch = normalized.match(/rgba?\(([^)]+)\)/);
  if (!rgbMatch) return null;

  const channels = rgbMatch[1]
    .replace(/\//g, ',')
    .split(/[,\s]+/)
    .filter(Boolean)
    .slice(0, 3)
    .map((value) => Number.parseFloat(value));

  if (channels.length !== 3 || channels.some(Number.isNaN)) return null;
  return { r: channels[0], g: channels[1], b: channels[2] };
}

function normalizeColorToken(color: string): string | null {
  const rgb = parseColorToRgb(color);
  if (rgb) {
    return `rgb(${Math.round(rgb.r)}, ${Math.round(rgb.g)}, ${Math.round(rgb.b)})`;
  }

  const normalized = color.trim();
  if (/^#[0-9a-fA-F]{3,8}$/.test(normalized)) {
    return normalized;
  }

  return null;
}

function rgbToHsl({ r, g, b }: { r: number; g: number; b: number }) {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const lightness = (max + min) / 2;

  if (max === min) {
    return { hue: 0, saturation: 0, lightness };
  }

  const delta = max - min;
  const saturation =
    lightness > 0.5 ? delta / (2 - max - min) : delta / (max + min);

  let hue = 0;
  switch (max) {
    case rn:
      hue = (gn - bn) / delta + (gn < bn ? 6 : 0);
      break;
    case gn:
      hue = (bn - rn) / delta + 2;
      break;
    default:
      hue = (rn - gn) / delta + 4;
      break;
  }

  return { hue: hue * 60, saturation, lightness };
}

function dedupeColors(values: string[]): string[] {
  return [...new Set(values.map((value) => value.trim()))];
}

function classifyColors(colorEntries: Array<{ color: string; count: number }>) {
  const primary: string[] = [];
  const secondary: string[] = [];
  const neutral: string[] = [];
  const accent: string[] = [];

  for (const entry of colorEntries) {
    const rgb = parseColorToRgb(entry.color);
    if (!rgb) continue;

    const { hue, saturation, lightness } = rgbToHsl(rgb);

    if (saturation < 0.12 || Math.max(rgb.r, rgb.g, rgb.b) - Math.min(rgb.r, rgb.g, rgb.b) < 12) {
      neutral.push(entry.color);
      continue;
    }

    if (hue >= 20 && hue <= 70 && saturation > 0.45) {
      accent.push(entry.color);
      continue;
    }

    if (lightness > 0.12 && lightness < 0.9) {
      if (primary.length < 6) primary.push(entry.color);
      else secondary.push(entry.color);
    }
  }

  return {
    primary: dedupeColors(primary).slice(0, 8),
    secondary: dedupeColors(secondary).slice(0, 8),
    neutral: dedupeColors(neutral).slice(0, 8),
    accent: dedupeColors(accent).slice(0, 8),
  };
}

function collectAllCssText(stylesheetTexts: string[]): string {
  return stylesheetTexts.join('\n\n');
}

/**
 * Extract colors from HTML
 */
export function extractColors(html: string, baseUrl: string, stylesheetTexts: string[]): ExtractedColors {
  const $ = load(html);
  const cssVars: Record<string, string> = {};
  const inlineStyles: Record<string, string> = {};
  const allCssText = collectAllCssText(stylesheetTexts);

  // Extract inline styles
  $('[style]').each((_, el) => {
    const style = $(el).attr('style') || '';
    if (style) {
      const key = $(el).attr('class') || $(el).attr('id') || `el_${Math.random().toString(36).slice(2)}`;
      inlineStyles[key] = style;
    }
  });

  Object.assign(cssVars, parseCssVariables(allCssText));

  const colorRegex = /#[0-9a-fA-F]{3,8}\b|rgba?\([^)]+\)|hsla?\([^)]+\)/g;
  const colorCounts = new Map<string, number>();

  const pushColors = (input: string) => {
    const matches = input.match(colorRegex) || [];
    for (const match of matches) {
      const normalized = normalizeColorToken(match);
      if (!normalized) continue;
      colorCounts.set(normalized, (colorCounts.get(normalized) || 0) + 1);
    }
  };

  pushColors(allCssText);
  Object.values(inlineStyles).forEach(pushColors);

  for (const [name, value] of Object.entries(cssVars)) {
    const normalized = normalizeColorToken(value);
    if (!normalized) continue;

    if (/primary|brand|teal|emerald/i.test(name)) {
      colorCounts.set(normalized, (colorCounts.get(normalized) || 0) + 20);
    }
    if (/neutral|gray|slate|zinc|stone|foreground|background/i.test(name)) {
      colorCounts.set(normalized, (colorCounts.get(normalized) || 0) + 12);
    }
    if (/accent|warning|amber|orange|yellow/i.test(name)) {
      colorCounts.set(normalized, (colorCounts.get(normalized) || 0) + 15);
    }
  }

  const sortedColors = [...colorCounts.entries()]
    .map(([color, count]) => ({ color, count }))
    .sort((a, b) => b.count - a.count);

  const classified = classifyColors(sortedColors);

  return {
    primary: classified.primary,
    secondary: classified.secondary,
    neutral: classified.neutral,
    accent: classified.accent,
    semantic: {},
    cssVariables: cssVars,
    inlineStyles,
  };
}

/**
 * Extract typography from HTML
 */
export function extractTypography(html: string, stylesheetTexts: string[]): ExtractedTypography {
  const $ = load(html);
  const fontFamilies = new Set<string>();
  const fontSizes: { value: string; selector: string }[] = [];
  const fontWeights: { value: string; selector: string }[] = [];
  const lineHeights: { value: string; selector: string }[] = [];
  const letterSpacings: { value: string; selector: string }[] = [];

  $('link[href*="fonts.googleapis.com"]').each((_, element) => {
    const href = $(element).attr('href') || '';
    const familyMatches = href.match(/family=([^&]+)/g) || [];
    familyMatches.forEach((familyChunk) => {
      const family = decodeURIComponent(familyChunk.replace(/^family=/, '')).split(':')[0].replace(/\+/g, ' ');
      fontFamilies.add(family);
    });
  });

  const combinedCss = collectAllCssText(stylesheetTexts);

  // Extract font-family
  const fontFamilyRegex = /font-family\s*:\s*([^;\}]+)/gi;
  let match;
  while ((match = fontFamilyRegex.exec(combinedCss)) !== null) {
    fontFamilies.add(match[1].trim().replace(/['"]/g, ''));
  }

  // Extract font-size
  const fontSizeRegex = /font-size\s*:\s*([^;\}]+)/gi;
  while ((match = fontSizeRegex.exec(combinedCss)) !== null) {
    fontSizes.push({ value: match[1].trim(), selector: 'css' });
  }

  // Extract font-weight
  const fontWeightRegex = /font-weight\s*:\s*([^;\}]+)/gi;
  while ((match = fontWeightRegex.exec(combinedCss)) !== null) {
    fontWeights.push({ value: match[1].trim(), selector: 'css' });
  }
  
  // Deduplicate
  return {
    fontFamilies: [...fontFamilies].slice(0, 10),
    fontSizes: fontSizes.slice(0, 20),
    fontWeights: fontWeights.slice(0, 20),
    lineHeights: lineHeights.slice(0, 20),
    letterSpacings: letterSpacings.slice(0, 20),
  };
}

/**
 * Extract spacing from HTML
 */
export function extractSpacing(html: string, stylesheetTexts: string[]): ExtractedSpacing {
  const paddings: { value: string; selector: string }[] = [];
  const margins: { value: string; selector: string }[] = [];
  const gaps: { value: string; selector: string }[] = [];
  const cssText = collectAllCssText(stylesheetTexts);

  const paddingRegex = /padding(?:-[a-z]+)?\s*:\s*([^;\}]+)/gi;
  let match;
  while ((match = paddingRegex.exec(cssText)) !== null) {
    paddings.push({ value: match[1].trim(), selector: 'css' });
  }

  const marginRegex = /margin(?:-[a-z]+)?\s*:\s*([^;\}]+)/gi;
  while ((match = marginRegex.exec(cssText)) !== null) {
    margins.push({ value: match[1].trim(), selector: 'css' });
  }

  const gapRegex = /gap\s*:\s*([^;\}]+)/gi;
  while ((match = gapRegex.exec(cssText)) !== null) {
    gaps.push({ value: match[1].trim(), selector: 'css' });
  }
  
  return {
    paddings: paddings.slice(0, 30),
    margins: margins.slice(0, 30),
    gaps: gaps.slice(0, 20),
  };
}

/**
 * Extract border styles from HTML
 */
export function extractBorders(html: string, stylesheetTexts: string[]): ExtractedBorders {
  const borderRadii: { value: string; selector: string }[] = [];
  const borderWidths: { value: string; selector: string }[] = [];
  const borderColors: { value: string; selector: string }[] = [];
  const cssText = collectAllCssText(stylesheetTexts);

  const radiusRegex = /border-radius\s*:\s*([^;\}]+)/gi;
  let match;
  while ((match = radiusRegex.exec(cssText)) !== null) {
    borderRadii.push({ value: match[1].trim(), selector: 'css' });
  }

  const widthRegex = /border(?:-[a-z]+)?\s*:\s*([^;\}]+)/gi;
  while ((match = widthRegex.exec(cssText)) !== null) {
    borderWidths.push({ value: match[1].trim(), selector: 'css' });
  }

  const borderColorRegex = /border-color\s*:\s*([^;\}]+)/gi;
  while ((match = borderColorRegex.exec(cssText)) !== null) {
    borderColors.push({ value: match[1].trim(), selector: 'css' });
  }
  
  return {
    borderRadii: borderRadii.slice(0, 20),
    borderWidths: borderWidths.slice(0, 20),
    borderColors: borderColors.slice(0, 20),
  };
}

/**
 * Extract box shadows from HTML
 */
export function extractShadows(html: string, stylesheetTexts: string[]): ExtractedShadows {
  const boxShadows: { value: string; selector: string }[] = [];
  const cssText = collectAllCssText(stylesheetTexts);

  const shadowRegex = /box-shadow\s*:\s*([^;\}]+)/gi;
  let match;
  while ((match = shadowRegex.exec(cssText)) !== null) {
    boxShadows.push({ value: match[1].trim(), selector: 'css' });
  }
  
  return {
    boxShadows: boxShadows.slice(0, 20),
  };
}

/**
 * Extract component styles from HTML
 */
export function extractComponents(html: string): ExtractedComponents {
  const $ = load(html);
  
  const buttons: ButtonStyle[] = [];
  const cards: CardStyle[] = [];
  const inputs: InputStyle[] = [];
  const navItems: NavStyle[] = [];
  
  $('button, [role="button"], a.btn, a.button, .btn, .button').each((_, el) => {
    const $el = $(el);
    const style = $el.attr('style') || '';
    const className = $el.attr('class') || '';
    buttons.push({
      selector: className || style,
      padding: '0',
      borderRadius: '0',
      fontSize: '0',
      fontWeight: '0',
      backgroundColor: '0',
      color: '0',
    });
  });
  
  $('.card, [class*="card"], article, [class*="post"], [class*="article"]').each((_, el) => {
    const $el = $(el);
    const className = $el.attr('class') || '';
    cards.push({
      selector: className,
      padding: '0',
      borderRadius: '0',
      backgroundColor: '0',
    });
  });
  
  return { buttons, cards, inputs, navItems };
}

/**
 * Extract layout rules from HTML
 */
export function extractLayout(html: string, stylesheetTexts: string[]): ExtractedLayout {
  let containerMaxWidth: string | undefined;
  let gridColumns: number | undefined;
  let gridGaps: string | undefined;
  let flexDirection: string | undefined;
  const cssText = collectAllCssText(stylesheetTexts);

  // Extract max-width (container width)
  const maxWidthRegex = /max-width\s*:\s*([^;\}]+)/gi;
  let match;
  while ((match = maxWidthRegex.exec(cssText)) !== null) {
    const value = match[1].trim();
    if (!containerMaxWidth && /^-?\d*\.?\d+(px|rem|em|vw|vh|%)$/.test(value)) {
      containerMaxWidth = value;
    }
  }

  // Extract grid columns
  const gridColsRegex = /grid-template-columns\s*:\s*([^;\}]+)/gi;
  while ((match = gridColsRegex.exec(cssText)) !== null) {
    const cols = match[1].trim().split(/\s+/);
    if (cols.length > 1 && !gridColumns) {
      gridColumns = cols.length;
    }
  }

  // Extract gaps
  const gapRegex = /gap\s*:\s*([^;\}]+)/gi;
  while ((match = gapRegex.exec(cssText)) !== null) {
    if (!gridGaps) gridGaps = match[1].trim();
  }

  // Extract flex direction
  const flexDirRegex = /flex-direction\s*:\s*([^;\}]+)/gi;
  while ((match = flexDirRegex.exec(cssText)) !== null) {
    if (!flexDirection) flexDirection = match[1].trim();
  }
  
  return { containerMaxWidth, gridColumns, gridGaps, flexDirection };
}

/**
 * Analyze a URL and extract all design primitives
 */
export async function analyzePage(url: string): Promise<ExtractedDesign> {
  const { html, finalUrl } = await fetchPage(url);
  const linkedStylesheets = await fetchLinkedStylesheets(html, finalUrl);
  const stylesheetTexts = collectStylesheets(html, linkedStylesheets);
  
  return {
    url: finalUrl,
    extractedAt: new Date().toISOString(),
    colors: extractColors(html, finalUrl, stylesheetTexts),
    typography: extractTypography(html, stylesheetTexts),
    spacing: extractSpacing(html, stylesheetTexts),
    borders: extractBorders(html, stylesheetTexts),
    shadows: extractShadows(html, stylesheetTexts),
    components: extractComponents(html),
    layout: extractLayout(html, stylesheetTexts),
  };
}
