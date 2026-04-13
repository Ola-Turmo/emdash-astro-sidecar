import { defineConfig } from 'astro/config';
import tailwind from '@astrojs/tailwind';
import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';
import { getConceptOutputDir, resolveActiveSiteRuntime } from './site-profiles.mjs';

const { siteKey, conceptKey, concept } = resolveActiveSiteRuntime(process.env);

// https://astro.build/config
export default defineConfig({
  site: concept.siteUrl,
  base: concept.basePath,
  output: 'static',
  outDir: getConceptOutputDir(siteKey, conceptKey),
  integrations: [
    tailwind(),
    mdx(),
    sitemap(),
  ],
  markdown: {
    shikiConfig: {
      theme: 'github-dark',
      wrap: true,
    },
  },
});
