import type { ContentBlock } from './types.js';

const contentBlockRegistry: Map<string, ContentBlock> = new Map();

export function registerContentBlock(name: string, block: ContentBlock) {
  contentBlockRegistry.set(name, block);
}

export function getContentBlock(name: string): ContentBlock | undefined {
  return contentBlockRegistry.get(name);
}

export function listContentBlocks(): ContentBlock[] {
  return Array.from(contentBlockRegistry.values());
}

export function renderContentBlock(name: string, props?: Record<string, any>): string {
  const block = getContentBlock(name);
  if (!block) {
    return `<div class="content-block-error">Unknown content block: ${name}</div>`;
  }
  
  // Return placeholder for MDX integration
  // In a real implementation, this would render the Astro component
  return `<!-- content-block:${name} props="${JSON.stringify(props || block.props || {})}" -->`;
}
