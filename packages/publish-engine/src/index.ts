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
  html: string;
  excerpt: string;
  category: string;
  tags: string[];
}

export function buildPublicationArtifact(
  host: PublicationHostContext,
  draft: PublicationDraftContext,
): PublicationArtifact {
  const title = draft.title?.trim() || toTitle(draft.topic);
  const description = draft.description?.trim() || summarizeDescription(draft.sections);
  const excerpt = draft.excerpt?.trim() || summarizeExcerpt(draft.sections);
  const url = new URL(`${normalizeBasePath(host.basePath)}/blog/${draft.slug}/`, host.siteUrl).toString();
  const category = inferCategory(draft);
  const tags = inferTags(draft);

  const frontmatterLines = [
    '---',
    `title: "${escapeYaml(title)}"`,
    `description: "${escapeYaml(description)}"`,
    `pubDate: ${new Date().toISOString().slice(0, 10)}`,
    'author: ola-turmo',
    `category: ${category}`,
    `tags: [${tags.map((tag) => `"${escapeYaml(tag)}"`).join(', ')}]`,
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
    html: buildEdgeHtml({
      title,
      description,
      excerpt,
      category,
      tags,
      sections: draft.sections,
      canonicalUrl: url,
    }),
    excerpt,
    category,
    tags,
    mdx: `${frontmatterLines.join('\n')}\n\n${body}\n`,
  };
}

function inferCategory(draft: PublicationDraftContext): string {
  const haystack = `${draft.slug} ${draft.topic} ${draft.title ?? ''}`.toLowerCase();
  if (haystack.includes('skjenk')) return 'skjenkebevilling';
  if (haystack.includes('etablerer')) return 'etablererproven';
  return 'salgsbevilling';
}

function inferTags(draft: PublicationDraftContext): string[] {
  const tags = new Set<string>();
  const haystack = `${draft.slug} ${draft.topic} ${draft.title ?? ''}`.toLowerCase();
  const category = inferCategory(draft);

  tags.add(category);
  for (const [needle, tag] of semanticTagMap) {
    if (haystack.includes(needle)) {
      tags.add(tag);
    }
  }

  for (const token of draft.slug.split('-').filter((entry) => entry && entry.length >= 4)) {
    if (tags.size >= 5) break;
    tags.add(token);
  }

  if (tags.size < 3) {
    tags.add('kurs');
    tags.add('prove');
  }
  return [...tags].slice(0, 6);
}

const semanticTagMap: Array<[needle: string, tag: string]> = [
  ['alkoholloven', 'alkoholloven'],
  ['serveringsloven', 'serveringsloven'],
  ['styrer', 'styrer'],
  ['stedfortreder', 'stedfortreder'],
  ['pensum', 'pensum'],
  ['vanlige feil', 'vanlige-feil'],
  ['forberede', 'forberedelse'],
  ['forbered', 'forberedelse'],
  ['ansvar', 'ansvar'],
  ['internkontroll', 'internkontroll'],
  ['kommune', 'kommunens-prove'],
  ['prøve', 'prove'],
  ['prove', 'prove'],
];

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

function buildEdgeHtml(input: {
  title: string;
  description: string;
  excerpt: string;
  category: string;
  tags: string[];
  sections: Array<{
    heading: string;
    body: string;
  }>;
  canonicalUrl: string;
}): string {
  const articleHtml = input.sections
    .map(
      (section) =>
        `<section><h2>${escapeHtml(section.heading)}</h2>${renderParagraphs(section.body)}</section>`,
    )
    .join('');

  const tags = input.tags
    .map((tag) => `<li>${escapeHtml(tag)}</li>`)
    .join('');

  return `<!DOCTYPE html>
<html lang="nb">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${escapeHtml(input.title)} | Kurs.ing Blogg</title>
    <meta name="description" content="${escapeHtml(input.description)}" />
    <link rel="canonical" href="${escapeHtml(input.canonicalUrl)}" />
    <meta name="robots" content="index,follow,max-image-preview:large" />
    <style>
      :root { color-scheme: light; }
      body { margin: 0; font-family: Manrope, system-ui, sans-serif; background: #f8fafc; color: #0f172a; }
      main { max-width: 880px; margin: 0 auto; padding: 48px 20px 72px; }
      article { background: white; border: 1px solid #e2e8f0; border-radius: 28px; padding: 32px; box-shadow: 0 20px 60px rgba(15, 23, 42, 0.08); }
      .eyebrow { font-size: 12px; font-weight: 800; letter-spacing: 0.16em; text-transform: uppercase; color: #0f766e; margin: 0 0 16px; }
      h1 { font-family: "Playfair Display", Georgia, serif; font-size: clamp(2.5rem, 5vw, 4rem); line-height: 1.05; margin: 0 0 20px; }
      h2 { font-size: 1.4rem; margin: 32px 0 12px; }
      p, li { font-size: 1.05rem; line-height: 1.8; color: #334155; }
      ul.tags { display: flex; flex-wrap: wrap; gap: 10px; list-style: none; padding: 0; margin: 28px 0 0; }
      ul.tags li { background: #f1f5f9; border: 1px solid #dbe4ee; border-radius: 999px; padding: 8px 12px; font-size: 0.92rem; line-height: 1; }
      a { color: #0f766e; }
      .lead { font-size: 1.15rem; color: #475569; margin-bottom: 20px; }
      .footer-note { margin-top: 32px; padding-top: 24px; border-top: 1px solid #e2e8f0; font-size: 0.95rem; color: #64748b; }
    </style>
  </head>
  <body>
    <main>
      <article>
        <p class="eyebrow">${escapeHtml(input.category)}</p>
        <h1>${escapeHtml(input.title)}</h1>
        <p class="lead">${escapeHtml(input.excerpt)}</p>
        ${articleHtml}
        <ul class="tags">${tags}</ul>
        <p class="footer-note">Denne artikkelen er publisert fra den autonome innholdsløypen og kan senere bli materialisert inn i den statiske Astro-siden.</p>
      </article>
    </main>
  </body>
</html>`;
}

function renderParagraphs(value: string): string {
  return value
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean)
    .map((paragraph) => {
      if (paragraph.startsWith('- ')) {
        const items = paragraph
          .split('\n')
          .map((line) => line.replace(/^- /, '').trim())
          .filter(Boolean)
          .map((line) => `<li>${linkifyAndEscape(line)}</li>`)
          .join('');
        return `<ul>${items}</ul>`;
      }
      return `<p>${linkifyAndEscape(paragraph)}</p>`;
    })
    .join('');
}

function linkifyAndEscape(value: string): string {
  return escapeHtml(value).replace(
    /\[([^\]]+)\]\(([^)]+)\)/g,
    (_match, label, href) => `<a href="${escapeHtml(href)}">${escapeHtml(label)}</a>`,
  );
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
