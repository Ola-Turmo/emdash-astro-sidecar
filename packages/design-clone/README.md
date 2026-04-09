# Design Clone Pipeline

A TypeScript library for cloning and importing designs from existing websites into the EmDash Astro Sidecar theme system.

## Overview

The design-clone pipeline analyzes a host website URL and generates Astro-native theme files. It works in three stages:

```
URL → [EXTRACT] → ExtractedDesign → [MAP] → ThemeTokens → [GENERATE] → Astro Files
```

1. **Extract** - Fetches HTML/CSS from target URL
2. **Map** - Transforms to normalized EmDash tokens  
3. **Generate** - Creates Astro theme files

## Installation

```bash
npm install @emdash-astro-sidecar/design-clone
```

Or use directly from the monorepo:

```typescript
import { extractFromUrl } from '@emdash-astro-sidecar/design-clone';
```

## Usage

### Full Pipeline

```typescript
import { 
  extractFromUrl, 
  mapToThemeTokens, 
  generateThemeFiles,
  generateDesignReport
} from '@emdash-astro-sidecar/design-clone';

async function importDesign(url: string) {
  // Stage 1: Extract design data
  const extracted = await extractFromUrl(url);
  
  // Stage 2: Map to theme tokens
  const tokens = mapToThemeTokens(extracted);
  
  // Stage 3: Generate Astro files
  const files = await generateThemeFiles(tokens);
  
  // Get report for review
  const report = generateDesignReport(extracted, tokens);
  console.log(report.warnings);
  console.log(report.suggestions);
  
  return files;
}

importDesign('https://example.com');
```

### With Fallback

```typescript
import { extractFromUrl, mapToThemeTokens, fallbackTheme } from '@emdash-astro-sidecar/design-clone';

async function importDesignSafe(url: string) {
  try {
    const extracted = await extractFromUrl(url);
    // Check if extraction succeeded
    if (!extracted.colors.length && !extracted.fonts.length) {
      console.log('Extraction failed, using fallback');
      return fallbackTheme();
    }
    return mapToThemeTokens(extracted);
  } catch {
    return fallbackTheme();
  }
}
```

### Programmatic Extraction Only

```typescript
import { extractFromUrl } from '@emdash-astro-sidecar/design-clone';

// Just extract without generating files
const extracted = await extractFromUrl('https://example.com');
console.log(extracted.colors);
console.log(extracted.fonts);
console.log(extracted.typography);
```

### Custom Output Directory

```typescript
import { generateThemeFiles } from '@emdash-astro-sidecar/design-clone';

const files = await generateThemeFiles(tokens, {
  outputDir: './custom/path',
  includeComponents: true,
  includeLayouts: true,
  includeContent: true,
});
```

## API Reference

### extractFromUrl(url: string): Promise<ExtractedDesign>

Fetches and parses HTML from the target URL to extract design tokens.

**Parameters:**
- `url` - The URL to extract from (must be valid HTTP/HTTPS)

**Returns:** `ExtractedDesign` object containing:
- `colors` - Array of color tokens extracted
- `fonts` - Google Fonts detected
- `typography` - Typography settings by selector
- `spacing` - Spacing token values
- `borderRadius` - Border radius values
- `shadows` - Box shadow values
- `components` - Nav, button, card, heading styles
- `rawCss` - Raw CSS text
- `rawHtml` - Raw HTML text

**Errors:** Never throws - returns fallback on error

### mapToThemeTokens(extracted: ExtractedDesign): ThemeTokens

Maps extracted design data to EmDash theme token format.

**Parameters:**
- `extracted` - Output from `extractFromUrl`

**Returns:** `ThemeTokens` object with:
- `colors` - HSL-based color tokens
- `typography` - Font family, size, weight tokens
- `spacing` - Normalized spacing scale
- `borderRadius` - Border radius tokens
- `shadows` - Shadow tokens
- `grid` - Grid configuration

### generateThemeFiles(tokens: ThemeTokens, outputDir?: string): Promise<GeneratedFiles>

Generates Astro theme files from tokens.

**Parameters:**
- `tokens` - Output from `mapToThemeTokens`
- `outputDir` - Base output directory (default: `packages/theme-core`)

**Returns:** `GeneratedFiles` containing file contents as strings

### generateDesignReport(extracted: ExtractedDesign, tokens: ThemeTokens): DesignReport

Generates a human-readable report of extraction and mapping.

**Returns:** `DesignReport` with:
- `extracted` - Original extracted data
- `tokens` - Mapped tokens
- `warnings` - Any issues encountered
- `suggestions` - Recommendations for improvement

### fallbackTheme(): ThemeTokens

Returns sensible default theme tokens for when extraction fails.

**Returns:** `ThemeTokens` with blue/gray color scheme

## Generated Files

The pipeline generates these files in your Astro project:

| File Path | Purpose |
|-----------|---------|
| `packages/theme-core/src/tokens/index.ts` | TypeScript token definitions |
| `apps/blog/src/styles/global.css` | CSS custom properties |
| `apps/blog/src/styles/prose.css` | Content typography |
| `apps/blog/src/layouts/BlogLayout.astro` | Main layout wrapper |
| `apps/blog/src/components/BlogHeader.astro` | Navigation header |
| `apps/blog/src/components/BlogFooter.astro` | Footer |

## Design Token Format

Tokens use HSL-based CSS custom properties:

```css
:root {
  --primary: hsl(217, 91%, 60%);
  --primary-foreground: hsl(215, 25%, 17%);
  --background: hsl(0, 0%, 100%);
  --foreground: hsl(215, 25%, 17%);
  /* ... */
}
```

## Limitations

- **No JavaScript rendering** - Only static HTML/CSS extracted
- **External stylesheets not fetched** - Only inline and `<style>` blocks parsed
- **Google Fonts only** - Self-hosted fonts not detected
- **Color conversion** - Named colors may not match exactly

## Error Handling

The pipeline is designed to never throw:

```typescript
// All of these are safe - returns fallback on error
await extractFromUrl('invalid-url');
await extractFromUrl('https://404-site.com');
await extractFromUrl('https://timeout-site.com');
```

## License

MIT
