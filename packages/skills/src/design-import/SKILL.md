---
name: design-import
description: Clone and apply a design theme from any URL to match your host site aesthetics. Use when importing a new design or regenerating a theme.
argument-hint: "<action> [url-or-preset]"
user-invocable: true
---

# Design Import Skill

Clone a website's design and generate matching Astro theme tokens and components.

## Actions

### cloneDesign
Analyze a URL and generate a complete Astro theme with CSS tokens, components, and layouts.

### listPresets
Show available fallback preset themes.

### applyPreset
Apply a built-in preset theme (minimal, corporate, editorial, startup).

### reviewTheme
Review a generated theme before applying.

### approveTheme
Approve and activate a generated theme.

### regenerateTheme
Re-run the clone process with the same URL.

## Usage

```
design-import cloneDesign https://stripe.com
design-import listPresets
design-import applyPreset minimal
design-import reviewTheme draft-123
design-import approveTheme draft-123
design-import regenerateTheme draft-123
```

## Clone Process

1. **Fetch** — Retrieve HTML/CSS from target URL
2. **Extract** — Analyze colors, typography, spacing, borders, shadows, components, layout
3. **Convert** — Transform extracted primitives to CSS custom properties and Tailwind config
4. **Generate** — Output theme files (tokens, components, layouts, tailwind.config.js)
5. **Review** — Save to draft queue for review before activation

## Fallback Presets

When site analysis fails, these built-in themes are available:
- **minimal** — Clean, minimal design with neutral colors
- **corporate** — Professional, business-focused design
- **editorial** — Magazine-style with serif typography
- **startup** — Modern, tech startup aesthetic

## Output Structure

Generated themes include:
```
theme-output/
├── tokens/
│   ├── colors.css
│   ├── typography.css
│   ├── spacing.css
│   ├── borders.css
│   └── shadows.css
├── components/
│   ├── Header.astro
│   ├── Footer.astro
│   ├── ArticleCard.astro
│   └── Button.astro
├── layouts/
│   ├── BaseLayout.astro
│   └── ArticleLayout.astro
├── tailwind.config.js
└── theme-manifest.json
```
