import type { AstroIntegration } from 'astro';

export interface PluginConfig {
  name: string;
  version: string;
  enabled?: boolean;
  config?: Record<string, any>;
}

export interface ContentBlock {
  name: string;
  component: string;
  props?: Record<string, any>;
}

export interface PageType {
  name: string;
  route: string;
  component: string;
}

export interface HookContext {
  root: string;
  buildTempDir: string;
  adapter?: string;
  integrations: AstroIntegration[];
  config: Record<string, any>;
  logger: {
    info: (msg: string) => void;
    warn: (msg: string) => void;
    error: (msg: string) => void;
  };
}

export interface RenderContext extends HookContext {
  url: string;
  request: Request;
}

export interface PublishContext extends HookContext {
  slug: string;
  content: string;
  frontmatter: Record<string, any>;
}

export interface Plugin {
  name: string;
  version: string;
  enabled?: boolean;
  hooks?: {
    onInit?: (ctx: HookContext) => Promise<void>;
    onBuild?: (ctx: HookContext) => Promise<void>;
    onRender?: (ctx: RenderContext) => Promise<string>;
    onPublish?: (ctx: PublishContext) => Promise<void>;
  };
  contentBlocks?: Record<string, ContentBlock>;
  pageTypes?: Record<string, PageType>;
}

export interface PluginRegistry {
  register(plugin: Plugin): void;
  unregister(name: string): void;
  get(name: string): Plugin | undefined;
  list(): Plugin[];
  enabled(): Plugin[];
}
