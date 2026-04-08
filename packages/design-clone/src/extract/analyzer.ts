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
} from '../types.js';

/**
 * Fetch a URL and return its HTML content
 */
export async function fetchPage(url: string): Promise<{ html: string; finalUrl: string }> {
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; DesignCloneBot/1.0; +https://emdash.dev)',
    },
  });
  
  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${response.status} ${response.statusText}`);
  }
  
  return {
    html: await response.text(),
    finalUrl: response.url,
  };
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

/**
 * Extract colors from HTML
 */
export function extractColors(html: string, baseUrl: string): ExtractedColors {
  const $ = load(html);
  const cssVars: Record<string, string> = {};
  const inlineStyles: Record<string, string> = {};
  
  // Extract inline styles
  $('[style]').each((_, el) => {
    const style = $(el).attr('style') || '';
    if (style) {
      const key = $(el).attr('class') || $(el).attr('id') || `el_${Math.random().toString(36).slice(2)}`;
      inlineStyles[key] = style;
    }
  });
  
  // Extract CSS variables from style tags
  $('style').each((_, el) => {
    const cssText = $(el).html() || '';
    Object.assign(cssVars, parseCssVariables(cssText));
  });
  
  // Extract colors from style tags
  const colorMap: Record<string, string[]> = {
    primary: [],
    secondary: [],
    neutral: [],
    accent: [],
  };
  
  $('style').each((_, el) => {
    const cssText = $(el).html() || '';
    const colorRegex = /#[0-9a-fA-F]{3,8}|rgb\([^)]+\)|rgba\([^)]+\)/g;
    const matches = cssText.match(colorRegex) || [];
    
    // Very basic categorization - categorize by lightness
    matches.forEach(color => {
      // Simple heuristic - categorize by hue
      if (color.startsWith('#')) {
        const hex = color.replace('#', '');
        if (hex.length === 3) {
          const r = parseInt(hex[0] + hex[0], 16);
          const g = parseInt(hex[1] + hex[1], 16);
          const b = parseInt(hex[2] + hex[2], 16);
          const brightness = (r * 299 + g * 587 + b * 114) / 1000;
          if (brightness > 200) colorMap.primary.push(color);
          else if (brightness > 100) colorMap.neutral.push(color);
          else colorMap.primary.push(color);
        } else {
          colorMap.primary.push(color);
        }
      }
    });
  });
  
  // Deduplicate
  Object.keys(colorMap).forEach(k => {
    colorMap[k] = [...new Set(colorMap[k])].slice(0, 10);
  });
  
  return {
    primary: colorMap.primary,
    secondary: colorMap.secondary,
    neutral: colorMap.neutral,
    accent: colorMap.accent,
    semantic: {},
    cssVariables: cssVars,
    inlineStyles,
  };
}

/**
 * Extract typography from HTML
 */
export function extractTypography(html: string): ExtractedTypography {
  const $ = load(html);
  const fontFamilies = new Set<string>();
  const fontSizes: { value: string; selector: string }[] = [];
  const fontWeights: { value: string; selector: string }[] = [];
  const lineHeights: { value: string; selector: string }[] = [];
  const letterSpacings: { value: string; selector: string }[] = [];
  
  $('style').each((_, el) => {
    const cssText = $(el).html() || '';
    
    // Extract font-family
    const fontFamilyRegex = /font-family\s*:\s*([^;]+)/gi;
    let match;
    while ((match = fontFamilyRegex.exec(cssText)) !== null) {
      fontFamilies.add(match[1].trim().replace(/['"]/g, ''));
    }
    
    // Extract font-size
    const fontSizeRegex = /font-size\s*:\s*([^;]+)/gi;
    while ((match = fontSizeRegex.exec(cssText)) !== null) {
      fontSizes.push({ value: match[1].trim(), selector: 'css' });
    }
    
    // Extract font-weight
    const fontWeightRegex = /font-weight\s*:\s*([^;]+)/gi;
    while ((match = fontWeightRegex.exec(cssText)) !== null) {
      fontWeights.push({ value: match[1].trim(), selector: 'css' });
    }
  });
  
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
export function extractSpacing(html: string): ExtractedSpacing {
  const $ = load(html);
  const paddings: { value: string; selector: string }[] = [];
  const margins: { value: string; selector: string }[] = [];
  const gaps: { value: string; selector: string }[] = [];
  
  $('style').each((_, el) => {
    const cssText = $(el).html() || '';
    
    const paddingRegex = /padding\s*:\s*([^;]+)/gi;
    let match;
    while ((match = paddingRegex.exec(cssText)) !== null) {
      paddings.push({ value: match[1].trim(), selector: 'css' });
    }
    
    const marginRegex = /margin\s*:\s*([^;]+)/gi;
    while ((match = marginRegex.exec(cssText)) !== null) {
      margins.push({ value: match[1].trim(), selector: 'css' });
    }
    
    const gapRegex = /gap\s*:\s*([^;]+)/gi;
    while ((match = gapRegex.exec(cssText)) !== null) {
      gaps.push({ value: match[1].trim(), selector: 'css' });
    }
  });
  
  return {
    paddings: paddings.slice(0, 30),
    margins: margins.slice(0, 30),
    gaps: gaps.slice(0, 20),
  };
}

/**
 * Extract border styles from HTML
 */
export function extractBorders(html: string): ExtractedBorders {
  const $ = load(html);
  const borderRadii: { value: string; selector: string }[] = [];
  const borderWidths: { value: string; selector: string }[] = [];
  const borderColors: { value: string; selector: string }[] = [];
  
  $('style').each((_, el) => {
    const cssText = $(el).html() || '';
    
    const radiusRegex = /border-radius\s*:\s*([^;]+)/gi;
    let match;
    while ((match = radiusRegex.exec(cssText)) !== null) {
      borderRadii.push({ value: match[1].trim(), selector: 'css' });
    }
    
    const widthRegex = /border\s*(?:width)?\s*:\s*([^;]+)/gi;
    while ((match = widthRegex.exec(cssText)) !== null) {
      borderWidths.push({ value: match[1].trim(), selector: 'css' });
    }
    
    const borderColorRegex = /border-color\s*:\s*([^;]+)/gi;
    while ((match = borderColorRegex.exec(cssText)) !== null) {
      borderColors.push({ value: match[1].trim(), selector: 'css' });
    }
  });
  
  return {
    borderRadii: borderRadii.slice(0, 20),
    borderWidths: borderWidths.slice(0, 20),
    borderColors: borderColors.slice(0, 20),
  };
}

/**
 * Extract box shadows from HTML
 */
export function extractShadows(html: string): ExtractedShadows {
  const $ = load(html);
  const boxShadows: { value: string; selector: string }[] = [];
  
  $('style').each((_, el) => {
    const cssText = $(el).html() || '';
    
    const shadowRegex = /box-shadow\s*:\s*([^;]+)/gi;
    let match;
    while ((match = shadowRegex.exec(cssText)) !== null) {
      boxShadows.push({ value: match[1].trim(), selector: 'css' });
    }
  });
  
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
export function extractLayout(html: string): ExtractedLayout {
  const $ = load(html);
  
  let containerMaxWidth: string | undefined;
  let gridColumns: number | undefined;
  let gridGaps: string | undefined;
  let flexDirection: string | undefined;
  
  $('style').each((_, el) => {
    const cssText = $(el).html() || '';
    
    // Extract max-width (container width)
    const maxWidthRegex = /max-width\s*:\s*([^;]+)/gi;
    let match;
    while ((match = maxWidthRegex.exec(cssText)) !== null) {
      const value = match[1].trim();
      if (!containerMaxWidth && (value.includes('px') || value.includes('rem') || value.includes('em'))) {
        containerMaxWidth = value;
      }
    }
    
    // Extract grid columns
    const gridColsRegex = /grid-template-columns\s*:\s*([^;]+)/gi;
    while ((match = gridColsRegex.exec(cssText)) !== null) {
      const cols = match[1].trim().split(/\s+/);
      if (cols.length > 1 && !gridColumns) {
        gridColumns = cols.length;
      }
    }
    
    // Extract gaps
    const gapRegex = /gap\s*:\s*([^;]+)/gi;
    while ((match = gapRegex.exec(cssText)) !== null) {
      if (!gridGaps) gridGaps = match[1].trim();
    }
    
    // Extract flex direction
    const flexDirRegex = /flex-direction\s*:\s*([^;]+)/gi;
    while ((match = flexDirRegex.exec(cssText)) !== null) {
      if (!flexDirection) flexDirection = match[1].trim();
    }
  });
  
  return { containerMaxWidth, gridColumns, gridGaps, flexDirection };
}

/**
 * Analyze a URL and extract all design primitives
 */
export async function analyzePage(url: string): Promise<ExtractedDesign> {
  const { html, finalUrl } = await fetchPage(url);
  
  return {
    url: finalUrl,
    extractedAt: new Date().toISOString(),
    colors: extractColors(html, finalUrl),
    typography: extractTypography(html),
    spacing: extractSpacing(html),
    borders: extractBorders(html),
    shadows: extractShadows(html),
    components: extractComponents(html),
    layout: extractLayout(html),
  };
}