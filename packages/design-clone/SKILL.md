---
name: design-clone
description: Analyze a website URL and generate Astro-native theme tokens and components that match the host site's design language. Use when setting up the EmDash blog sidecar for a new host site.
argument-hint: "<action> [url-or-preset]"
user-invocable: true
---

# Design Clone Skill

Clone a website's visual design and generate a matching Astro theme.

## Actions

### cloneDesign
Analyze a URL and generate theme tokens and components.

**Input:** A website URL
**Output:** Theme files ready to apply to the blog

**What it extracts:**
- Color palette (from CSS variables, inline styles, computed)
- Typography stack (fonts, sizes, weights, line heights)  
- Spacing scale
- Border radius values
- Shadow presets
- Button styles
- Card styles
- Grid/flex layout rules
- Container max-width

**What it generates:**
- CSS token files (colors, typography, spacing, borders, shadows)
- Astro component files (Header, Footer, ArticleCard, Button, Callout)
- Layout files (BaseLayout, ArticleLayout)
- Tailwind config overrides
- Theme manifest

### listPresets
Show available fallback preset themes when site analysis is unreliable.

**Presets:** minimal, corporate, editorial, startup

### applyPreset
Apply a preset theme without site analysis.

### reviewTheme
Show the generated theme for human review before applying.

### approveTheme
Approve and activate the generated theme.

### regenerateTheme
Re-run clone against the same URL with same settings.

## Usage

```
Use the design-clone skill to analyze https://example.com
```

## Output Location

Generated themes are written to `packages/theme-core/theme-output/` as:
- `tokens/colors.css`
- `tokens/typography.css`
- `components/Header.astro`
- etc.

After approval, copy these to the active theme directory.
