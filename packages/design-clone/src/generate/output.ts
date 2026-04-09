import { writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import type { ExtractedDesign } from '../types.ts';
import { convertColors, convertTypography, convertSpacing, convertBorders, convertShadows, convertComponents } from './theme-builder.ts';

export interface ThemeOutput {
  tokens: {
    colors: string;
    typography: string;
    spacing: string;
    borders: string;
    shadows: string;
  };
  components: string;
  layouts: {
    base: string;
    article: string;
  };
  tailwind: string;
  manifest: {
    name: string;
    sourceUrl: string;
    generatedAt: string;
    version: string;
  };
}

/**
 * Write theme tokens to output directory
 */
export async function writeThemeTokens(outputDir: string, design: ExtractedDesign): Promise<void> {
  await mkdir(`${outputDir}/tokens`, { recursive: true });
  
  await writeFile(`${outputDir}/tokens/colors.css`, convertColors(design));
  await writeFile(`${outputDir}/tokens/typography.css`, convertTypography(design));
  await writeFile(`${outputDir}/tokens/spacing.css`, convertSpacing(design));
  await writeFile(`${outputDir}/tokens/borders.css`, convertBorders(design));
  await writeFile(`${outputDir}/tokens/shadows.css`, convertShadows(design));
}

/**
 * Write component styles to output directory
 */
export async function writeComponentTemplates(outputDir: string, design: ExtractedDesign): Promise<void> {
  await mkdir(`${outputDir}/components`, { recursive: true });
  
  const componentStyles = convertComponents(design);
  await writeFile(`${outputDir}/components/buttons.css`, componentStyles);
  await writeFile(`${outputDir}/components/cards.css`, componentStyles);
}

/**
 * Generate Tailwind config override
 */
export function generateTailwindConfig(design: ExtractedDesign): string {
  const containerMax = design.layout.containerMaxWidth || '1200px';
  
  return `/** @type {import('tailwindcss').Config} */
export default {
  theme: {
    extend: {
      container: {
        center: true,
        padding: '1rem',
        screens: {
          DEFAULT: '100%',
          md: '${containerMax}',
        },
      },
      colors: {
        primary: {
          DEFAULT: '${design.colors.primary[0] || '#3b82f6'}',
        },
      },
      fontFamily: {
        sans: ['${design.typography.fontFamilies[0] || 'Inter'}', 'system-ui', 'sans-serif'],
      },
    },
  },
};
`;
}

/**
 * Write Tailwind config to output directory
 */
export async function writeTailwindConfig(outputDir: string, design: ExtractedDesign): Promise<void> {
  await writeFile(`${outputDir}/tailwind.config.js`, generateTailwindConfig(design));
}

/**
 * Write theme manifest
 */
export async function writeThemeManifest(outputDir: string, design: ExtractedDesign): Promise<void> {
  const manifest = {
    name: 'Generated Theme',
    sourceUrl: design.url,
    generatedAt: new Date().toISOString(),
    version: '1.0.0',
    tokens: ['colors', 'typography', 'spacing', 'borders', 'shadows'],
  };
  
  await writeFile(`${outputDir}/theme-manifest.json`, JSON.stringify(manifest, null, 2));
}

/**
 * Build layout templates
 */
export function generateBaseLayout(): string {
  return `---
interface Props {
  title: string;
  description?: string;
}

const { title, description = 'Blog post' } = Astro.props;
---
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="description" content={description} />
    <title>{title}</title>
  </head>
  <body>
    <slot />
  </body>
</html>
`;
}

export function generateArticleLayout(): string {
  return `---
import BaseLayout from './BaseLayout.astro';
import type { CollectionEntry } from 'astro:content';

interface Props {
  post: CollectionEntry<'blog'>;
}

const { post } = Astro.props;
---
<BaseLayout title={post.data.title} description={post.data.excerpt}>
  <article>
    <h1>{post.data.title}</h1>
    <slot />
  </article>
</BaseLayout>
`;
}

/**
 * Write layout files to output directory
 */
export async function writeLayouts(outputDir: string): Promise<void> {
  await mkdir(`${outputDir}/layouts`, { recursive: true });
  
  await writeFile(`${outputDir}/layouts/BaseLayout.astro`, generateBaseLayout());
  await writeFile(`${outputDir}/layouts/ArticleLayout.astro`, generateArticleLayout());
}

/**
 * Main theme generation function
 */
export async function generateTheme(design: ExtractedDesign, outputDir: string): Promise<ThemeOutput> {
  await writeThemeTokens(outputDir, design);
  await writeComponentTemplates(outputDir, design);
  await writeTailwindConfig(outputDir, design);
  await writeLayouts(outputDir);
  await writeThemeManifest(outputDir, design);
  
  return {
    tokens: {
      colors: convertColors(design),
      typography: convertTypography(design),
      spacing: convertSpacing(design),
      borders: convertBorders(design),
      shadows: convertShadows(design),
    },
    components: convertComponents(design),
    layouts: {
      base: generateBaseLayout(),
      article: generateArticleLayout(),
    },
    tailwind: generateTailwindConfig(design),
    manifest: {
      name: 'Generated Theme',
      sourceUrl: design.url,
      generatedAt: new Date().toISOString(),
      version: '1.0.0',
    },
  };
}
