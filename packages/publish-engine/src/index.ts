export interface PublicationHostContext {
  hostId: string;
  hostName: string;
  siteUrl: string;
  basePath: string;
}

export interface PublicationDraftContext {
  draftId: string;
  slug: string;
  topic: string;
  title?: string | null;
  description?: string | null;
  excerpt?: string | null;
  sections: Array<{
    heading: string;
    body: string;
  }>;
}

export interface PublicationArtifact {
  url: string;
  title: string;
  description: string;
  mdx: string;
  excerpt: string;
}

export function buildPublicationArtifact(
  host: PublicationHostContext,
  draft: PublicationDraftContext,
): PublicationArtifact {
  const title = draft.title?.trim() || toTitle(draft.topic);
  const description = draft.description?.trim() || summarizeDescription(draft.sections);
  const excerpt = draft.excerpt?.trim() || summarizeExcerpt(draft.sections);
  const url = new URL(`${normalizeBasePath(host.basePath)}/blog/${draft.slug}/`, host.siteUrl).toString();
  const tags = draft.slug
    .split('-')
    .slice(0, 4)
    .map((tag) => `"${escapeYaml(tag)}"`);

  const frontmatterLines = [
    '---',
    `title: "${escapeYaml(title)}"`,
    `description: "${escapeYaml(description)}"`,
    `pubDate: ${new Date().toISOString().slice(0, 10)}`,
    'author: ola-turmo',
    'category: guide',
    `tags: [${tags.join(', ')}]`,
    `excerpt: "${escapeYaml(excerpt)}"`,
    'schemaType: Article',
    'draft: false',
    '---',
  ];

  const body = draft.sections
    .map((section) => `## ${section.heading}\n\n${section.body}`)
    .join('\n\n');

  return {
    url,
    title,
    description,
    excerpt,
    mdx: `${frontmatterLines.join('\n')}\n\n${body}\n`,
  };
}

function normalizeBasePath(basePath: string): string {
  if (!basePath.startsWith('/')) return `/${basePath}`;
  return basePath.endsWith('/') ? basePath.slice(0, -1) : basePath;
}

function toTitle(topic: string): string {
  const trimmed = topic.trim();
  if (!trimmed) return 'Ny guide';
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
}

function summarizeDescription(
  sections: Array<{
    heading: string;
    body: string;
  }>,
): string {
  const summary = sections
    .map((section) => section.body.trim())
    .join(' ')
    .replace(/\s+/g, ' ')
    .slice(0, 155)
    .trim();

  return summary || 'Kort forklaring og neste steg for leseren.';
}

function summarizeExcerpt(
  sections: Array<{
    heading: string;
    body: string;
  }>,
): string {
  const summary = sections
    .map((section) => section.body.trim())
    .join(' ')
    .replace(/\s+/g, ' ')
    .slice(0, 190)
    .trim();

  return summary || 'Praktisk forklaring som hjelper leseren videre.';
}

function escapeYaml(value: string): string {
  return value.replace(/"/g, '\\"');
}
