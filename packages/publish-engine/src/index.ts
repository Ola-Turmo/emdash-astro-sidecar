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
    <meta name="theme-color" content="#115E59" />
    <meta property="og:title" content="${escapeHtml(input.title)} | Kurs.ing Blogg" />
    <meta property="og:description" content="${escapeHtml(input.description)}" />
    <meta property="og:type" content="article" />
    <meta property="og:url" content="${escapeHtml(input.canonicalUrl)}" />
    <meta property="og:site_name" content="Kurs.ing Blogg" />
    <meta property="og:locale" content="nb_NO" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${escapeHtml(input.title)} | Kurs.ing Blogg" />
    <meta name="twitter:description" content="${escapeHtml(input.description)}" />
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link href="https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800&family=Playfair+Display:wght@600;700;800&display=swap" rel="stylesheet" />
    <style>
      :root { color-scheme: light; }
      * { box-sizing: border-box; }
      body { margin: 0; font-family: Manrope, system-ui, sans-serif; background: linear-gradient(180deg, #f8fafc 0%, #eef2ff 100%); color: #0f172a; }
      a { color: #0f766e; text-decoration: none; }
      a:hover { color: #0f172a; }
      .header { position: sticky; top: 0; z-index: 20; border-bottom: 1px solid rgba(226,232,240,.8); background: rgba(255,255,255,.86); backdrop-filter: blur(18px); }
      .header-inner, .mobile-nav, .main-grid, .footer-grid, .footer-bar { width: min(1120px, calc(100% - 32px)); margin: 0 auto; }
      .header-inner { display: flex; align-items: center; justify-content: space-between; gap: 24px; padding: 16px 0; }
      .brand { display: inline-flex; align-items: center; gap: 12px; }
      .brand-mark { display: inline-flex; align-items: center; justify-content: center; width: 44px; height: 44px; border-radius: 18px; background: #115E59; color: white; font-size: 20px; font-weight: 900; box-shadow: 0 16px 32px rgba(15, 118, 110, .18); }
      .brand-name { display: block; font-size: 18px; font-weight: 800; letter-spacing: -0.02em; color: #0f172a; }
      .brand-sub { display: block; font-size: 12px; font-weight: 700; letter-spacing: .18em; text-transform: uppercase; color: #64748b; }
      .nav { display: flex; align-items: center; gap: 24px; }
      .nav a, .header-links a { font-size: 14px; font-weight: 700; color: #475569; }
      .header-links { display: flex; align-items: center; gap: 12px; }
      .cta-primary, .cta-secondary { display: inline-flex; align-items: center; justify-content: center; border-radius: 999px; padding: 12px 20px; font-size: 14px; font-weight: 800; transition: transform .18s ease, background-color .18s ease, color .18s ease, border-color .18s ease; }
      .cta-primary { background: #115E59; color: white; box-shadow: 0 18px 30px rgba(15, 118, 110, .18); }
      .cta-secondary { background: white; border: 1px solid #dbe4ee; color: #0f172a; }
      .cta-primary:hover, .cta-secondary:hover { transform: translateY(-1px); }
      .mobile-wrap { border-bottom: 1px solid rgba(226,232,240,.8); background: rgba(255,255,255,.55); }
      .mobile-nav { display: none; gap: 16px; overflow-x: auto; padding: 12px 0; font-size: 14px; font-weight: 700; color: #475569; }
      main { padding: 40px 0 80px; }
      .main-grid { display: grid; gap: 32px; grid-template-columns: minmax(0, 1fr) 288px; }
      .hero { max-width: 720px; margin: 0 auto 12px; }
      .eyebrow { font-size: 12px; font-weight: 800; letter-spacing: 0.16em; text-transform: uppercase; color: #0f766e; margin: 0 0 16px; }
      h1 { font-family: "Playfair Display", Georgia, serif; font-size: clamp(2.8rem, 6vw, 4.4rem); line-height: 1.02; margin: 0 0 18px; letter-spacing: -0.03em; color: #020617; }
      .lead { margin: 0; font-size: 1.15rem; line-height: 1.8; color: #475569; }
      .meta { display: flex; flex-wrap: wrap; gap: 16px; margin-top: 20px; font-size: 14px; font-weight: 700; color: #64748b; }
      .shell-card { background: rgba(255,255,255,.92); border: 1px solid rgba(226,232,240,.92); border-radius: 28px; box-shadow: 0 28px 70px rgba(15, 23, 42, .08); }
      .article-card { padding: 32px; }
      h2 { font-size: 1.45rem; line-height: 1.2; margin: 32px 0 12px; letter-spacing: -0.02em; color: #0f172a; }
      p, li { font-size: 1.02rem; line-height: 1.85; color: #334155; }
      ul { padding-left: 24px; }
      ul.tags { display: flex; flex-wrap: wrap; gap: 10px; list-style: none; padding: 0; margin: 28px 0 0; }
      ul.tags li { background: #f1f5f9; border: 1px solid #dbe4ee; border-radius: 999px; padding: 8px 12px; font-size: 0.92rem; line-height: 1; }
      .aside { display: flex; flex-direction: column; gap: 20px; }
      .aside-card { padding: 20px; }
      .aside-card p, .aside-card dd { font-size: 14px; line-height: 1.8; color: #475569; }
      .aside-card dt { font-size: 14px; font-weight: 800; color: #0f172a; }
      .aside-actions { display: flex; flex-direction: column; gap: 12px; margin-top: 16px; }
      .footer { margin-top: 96px; background: #020617; color: #cbd5e1; }
      .footer-grid { display: grid; gap: 48px; grid-template-columns: 1.1fr 1fr; padding: 56px 0; }
      .footer-bar { display: flex; flex-wrap: wrap; justify-content: space-between; gap: 12px; padding: 20px 0; border-top: 1px solid rgba(51,65,85,.8); font-size: 14px; color: #64748b; }
      .footer-links { display: grid; gap: 36px; grid-template-columns: repeat(2, minmax(0,1fr)); }
      .footer-links p, .footer-links a { font-size: 14px; line-height: 1.8; color: #cbd5e1; }
      .footer-links .muted { color: #64748b; }
      .footer-title { font-size: 14px; font-weight: 800; letter-spacing: .18em; text-transform: uppercase; color: white; margin: 0 0 16px; }
      .footer-display { font-family: "Playfair Display", Georgia, serif; font-size: clamp(2rem, 4vw, 3rem); line-height: 1.05; color: white; margin: 0; }
      .footer-copy { margin: 16px 0 0; max-width: 42rem; font-size: 14px; line-height: 1.9; color: #94a3b8; }
      .footer-cta { display: flex; flex-wrap: wrap; gap: 12px; margin-top: 20px; }
      .footer-note { margin-top: 32px; padding-top: 24px; border-top: 1px solid #e2e8f0; font-size: 0.95rem; color: #64748b; }
      @media (max-width: 1024px) {
        .nav { display: none; }
        .mobile-nav { display: flex; }
        .main-grid, .footer-grid { grid-template-columns: 1fr; }
      }
      @media (max-width: 720px) {
        .header-links a:first-child { display: none; }
        .article-card { padding: 24px; }
      }
    </style>
  </head>
  <body>
    <header class="header">
      <div class="header-inner">
        <a href="/guide/" class="brand">
          <span class="brand-mark">k</span>
          <span>
            <span class="brand-name">kurs.ing</span>
            <span class="brand-sub">Blogg</span>
          </span>
        </a>
        <nav class="nav">
          <a href="/guide/">Artikler</a>
          <a href="/guide/category/etablererproven/">Etablererprøven</a>
          <a href="/guide/category/skjenkebevilling/">Skjenkebevilling</a>
          <a href="/guide/category/salgsbevilling/">Salgsbevilling</a>
        </nav>
        <div class="header-links">
          <a href="https://www.kurs.ing">Hovedside</a>
          <a href="https://www.kurs.ing/kasse.html" class="cta-primary">Kjøp kurset</a>
        </div>
      </div>
    </header>
    <div class="mobile-wrap">
      <div class="mobile-nav">
        <a href="/guide/">Artikler</a>
        <a href="/guide/category/etablererproven/">Etablererprøven</a>
        <a href="/guide/category/skjenkebevilling/">Skjenkebevilling</a>
        <a href="/guide/category/salgsbevilling/">Salgsbevilling</a>
      </div>
    </div>
    <main>
      <div class="hero">
        <p class="eyebrow">${escapeHtml(input.category)}</p>
        <h1>${escapeHtml(input.title)}</h1>
        <p class="lead">${escapeHtml(input.excerpt)}</p>
        <div class="meta">
          <span>${new Date().toLocaleDateString('nb-NO', { year: 'numeric', month: 'long', day: 'numeric' })}</span>
          <span>Ola Turmo</span>
          <span>Publisert fra Cloudflare</span>
        </div>
      </div>
      <div class="main-grid">
        <article class="shell-card article-card">
          ${articleHtml}
          <ul class="tags">${tags}</ul>
          <p class="footer-note">Denne artikkelen er publisert direkte fra den autonome innholdsløypen i Cloudflare. Den kan senere bli materialisert inn i den statiske Astro-siden uten å endre URL.</p>
        </article>
        <aside class="aside">
          <div class="shell-card aside-card">
            <p class="eyebrow">Neste steg</p>
            <p>Når du er klar for pensum, oppgaver og eksamenstrening, går du videre til kurspakken på hovedsiden.</p>
            <div class="aside-actions">
              <a href="https://www.kurs.ing/kasse.html" class="cta-primary">Kjøp kurset</a>
              <a href="https://www.kurs.ing" class="cta-secondary">Til kurs.ing</a>
            </div>
          </div>
          <div class="shell-card aside-card">
            <p class="eyebrow">Om artikkelen</p>
            <dl>
              <dt>Kategori</dt>
              <dd>${escapeHtml(input.category)}</dd>
              <dt>Formål</dt>
              <dd>Forklare krav tydelig og lede videre til riktig kurs.</dd>
              <dt>Publisering</dt>
              <dd>Cloudflare edge-artikkel</dd>
            </dl>
          </div>
        </aside>
      </div>
    </main>
    <footer class="footer">
      <div class="footer-grid">
        <div>
          <p class="eyebrow" style="color:#6ee7b7">Kurs.ing blogg</p>
          <p class="footer-display">Artikler som hjelper deg å forstå kravene før du kjøper eller går opp til prøve.</p>
          <p class="footer-copy">Her finner du forklaringer og råd som gjør det lettere å forstå kravene rundt etablererprøven, skjenkebevilling og salgsbevilling.</p>
          <div class="footer-cta">
            <a href="https://www.kurs.ing/kasse.html" class="cta-primary">Start kurset</a>
            <a href="mailto:ola@kurs.ing" class="cta-secondary" style="background:#0f172a;color:white;border-color:#334155">Kontakt Ola</a>
          </div>
        </div>
        <div class="footer-links">
          <div>
            <p class="footer-title">Kurs</p>
            <a href="https://www.kurs.ing/etablererproven">Kurs for etablererprøven</a><br />
            <span class="muted">Pensum, oppgaver og råd før prøven i kommunen.</span><br /><br />
            <a href="https://www.kurs.ing/skjenkebevilling">Kurs for skjenkebevilling</a><br />
            <span class="muted">For styrer og stedfortreder som må dokumentere kunnskap om alkoholloven.</span><br /><br />
            <a href="https://www.kurs.ing/salgsbevilling">Kurs for salgsbevilling</a><br />
            <span class="muted">For butikker og utsalgssteder som skal søke eller drifte salgsbevilling.</span>
          </div>
          <div>
            <p class="footer-title">Teknisk</p>
            <a href="/guide/rss.xml">RSS-feed</a><br />
            <a href="/guide/sitemap.xml">Sitemap</a><br />
            <a href="https://www.kurs.ing">kurs.ing</a><br />
            <a href="mailto:ola@kurs.ing">ola@kurs.ing</a>
          </div>
        </div>
      </div>
      <div class="footer-bar">
        <span>&copy; 2026 Kurs.ing. Innhold for Norge, skrevet på norsk.</span>
        <span>Beståttgaranti og produktinformasjon finner du på hovedsiden.</span>
      </div>
    </footer>
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
