import type { HookContext, RenderContext, PublishContext } from './types.js';

export function createHookContext(partial: Partial<HookContext>): HookContext {
  return {
    root: partial.root || process.cwd(),
    buildTempDir: partial.buildTempDir || '.astro',
    adapter: partial.adapter,
    integrations: partial.integrations || [],
    config: partial.config || {},
    logger: {
      info: (msg: string) => console.log(`[INFO] ${msg}`),
      warn: (msg: string) => console.warn(`[WARN] ${msg}`),
      error: (msg: string) => console.error(`[ERROR] ${msg}`),
    },
  };
}

export function createRenderContext(partial: Partial<RenderContext> & Required<Pick<RenderContext, 'url' | 'request'>>): RenderContext {
  return {
    ...createHookContext(partial),
    url: partial.url,
    request: partial.request,
  };
}

export function createPublishContext(partial: Partial<PublishContext> & Required<Pick<PublishContext, 'slug' | 'content' | 'frontmatter'>>): PublishContext {
  return {
    ...createHookContext(partial as HookContext),
    slug: partial.slug,
    content: partial.content,
    frontmatter: partial.frontmatter,
  };
}
