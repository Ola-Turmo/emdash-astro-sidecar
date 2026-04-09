import { writeFile, readFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';

const DRAFTS_DIR = './drafts';
const PUBLISHED_DIR = './published';
const VERSIONS_DIR = './versions';

export interface PublishResult {
  success: boolean;
  slug: string;
  action: string;
  message?: string;
}

export async function saveDraft(content: string, slug: string): Promise<PublishResult> {
  await mkdir(DRAFTS_DIR, { recursive: true });
  await writeFile(`${DRAFTS_DIR}/${slug}.mdx`, content, 'utf-8');
  return { success: true, slug, action: 'save-draft', message: `Draft saved: ${slug}` };
}

export async function previewDraft(slug: string): Promise<PublishResult & { previewUrl?: string }> {
  const draftPath = `${DRAFTS_DIR}/${slug}.mdx`;
  if (!existsSync(draftPath)) {
    return { success: false, slug, action: 'preview', message: `Draft not found: ${slug}` };
  }
  const previewUrl = `/preview/${slug}`;
  return { success: true, slug, action: 'preview', previewUrl, message: `Preview available at ${previewUrl}` };
}

export async function publish(slug: string): Promise<PublishResult> {
  const draftPath = `${DRAFTS_DIR}/${slug}.mdx`;
  if (!existsSync(draftPath)) {
    return { success: false, slug, action: 'publish', message: `Draft not found: ${slug}` };
  }
  
  await mkdir(PUBLISHED_DIR, { recursive: true });
  const content = await readFile(draftPath, 'utf-8');
  await writeFile(`${PUBLISHED_DIR}/${slug}.mdx`, content, 'utf-8');
  
  return { success: true, slug, action: 'publish', message: `Published: ${slug}` };
}

export async function unpublish(slug: string): Promise<PublishResult> {
  const publishedPath = `${PUBLISHED_DIR}/${slug}.mdx`;
  if (!existsSync(publishedPath)) {
    return { success: false, slug, action: 'unpublish', message: `Published post not found: ${slug}` };
  }
  
  await mkdir(DRAFTS_DIR, { recursive: true });
  const content = await readFile(publishedPath, 'utf-8');
  await writeFile(`${DRAFTS_DIR}/${slug}.mdx`, content, 'utf-8');
  
  return { success: true, slug, action: 'unpublish', message: `Unpublished: ${slug}` };
}

export async function rollback(slug: string, version: string): Promise<PublishResult> {
  const versionPath = `${VERSIONS_DIR}/${slug}/v${version}.mdx`;
  if (!existsSync(versionPath)) {
    return { success: false, slug, action: 'rollback', message: `Version ${version} not found for ${slug}` };
  }
  
  await mkdir(DRAFTS_DIR, { recursive: true });
  const content = await readFile(versionPath, 'utf-8');
  await writeFile(`${DRAFTS_DIR}/${slug}.mdx`, content, 'utf-8');
  
  return { success: true, slug, action: 'rollback', message: `Rolled back ${slug} to version ${version}` };
}