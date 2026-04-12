import { buildSemanticSlug, normalizeSearchText, normalizeSemanticTag } from '../../model-runtime/src/index.js';

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
  slug: string;
  title: string;
  description: string;
  mdx: string;
  html: string;
  excerpt: string;
  category: string;
  tags: string[];
}

export interface PublicationArtifactValidation {
  valid: boolean;
  reasons: string[];
}

export function buildPublicationArtifact(
  host: PublicationHostContext,
  draft: PublicationDraftContext,
): PublicationArtifact {
  const title = normalizeSearchText(draft.title?.trim() || toTitle(draft.topic));
  const sections = draft.sections.map((section) => ({
    heading: normalizeSearchText(section.heading),
    body: normalizeSearchText(section.body),
  }));
  const description = normalizeSearchText(draft.description?.trim() || summarizeDescription(sections));
  const excerpt = normalizeSearchText(draft.excerpt?.trim() || summarizeExcerpt(sections));
  const slug = buildSemanticSlug(draft.slug || draft.title || draft.topic, {
    fallback: title || draft.topic,
  });
  const url = new URL(`${normalizeBasePath(host.basePath)}/blog/${slug}/`, host.siteUrl).toString();
  const category = inferCategory(draft);
  const tags = inferTags(draft, sections);
  const brand = buildBrandContext(host);

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

  const body = sections.map((section) => `## ${section.heading}\n\n${section.body}`).join('\n\n');

  return {
    url,
    slug,
    title,
    description,
    html: buildEdgeHtml({
      canonicalUrl: url,
      category,
      brand,
      description,
      excerpt,
      sections,
      tags,
      title,
    }),
    excerpt,
    category,
    tags,
    mdx: `${frontmatterLines.join('\n')}\n\n${body}\n`,
  };
}

export function validatePublicationArtifact(artifact: PublicationArtifact): PublicationArtifactValidation {
  const reasons: string[] = [];
  const bodyWordCount = countWords(artifact.mdx);
  const bannedPhrases = [
    'Cloudflare edge-artikkel',
    'Publisert fra Cloudflare',
    'autonome innholdsløypen',
    'Edge-publisert innhold',
    'SEO / GEO sidecar',
    'GEO sidecar',
    'Kurs.ing sidecar',
  ];

  if (!artifact.title || artifact.title.trim().length < 20) {
    reasons.push('Publication artifact title is too weak.');
  }
  if (!artifact.description || artifact.description.trim().length < 90 || artifact.description.trim().length > 170) {
    reasons.push('Publication artifact description is outside the safe range.');
  }
  if (!artifact.excerpt || artifact.excerpt.trim().length < 120 || artifact.excerpt.trim().length > 230) {
    reasons.push('Publication artifact excerpt is outside the safe range.');
  }
  if (artifact.tags.length < 3) {
    reasons.push('Publication artifact needs at least three semantic tags.');
  }
  if (bodyWordCount < 320) {
    reasons.push('Publication artifact body is too short.');
  }
  if (!artifact.html.includes('brand-mark') || !artifact.html.includes('footer-display')) {
    reasons.push('Publication artifact HTML is missing the shared design shell.');
  }
  for (const phrase of bannedPhrases) {
    if (artifact.html.includes(phrase) || artifact.mdx.includes(phrase)) {
      reasons.push(`Publication artifact contains banned reader-facing phrase "${phrase}".`);
    }
  }

  return {
    valid: reasons.length === 0,
    reasons,
  };
}

function inferCategory(draft: PublicationDraftContext): string {
  const haystack = normalizeSearchText(`${draft.slug} ${draft.topic} ${draft.title ?? ''}`).toLowerCase();
  if (haystack.includes('skjenk')) return 'skjenkebevilling';
  if (haystack.includes('etablerer')) return 'etablererproven';
  if (haystack.includes('kommune')) return 'kommune';
  return 'salgsbevilling';
}

function inferTags(
  draft: PublicationDraftContext,
  sections: Array<{ heading: string; body: string }>,
): string[] {
  const normalizedTopic = normalizeSearchText(`${draft.slug} ${draft.topic} ${draft.title ?? ''}`).toLowerCase();
  const normalizedSections = sections
    .map((section) => `${section.heading} ${section.body}`)
    .join(' ')
    .toLowerCase();
  const haystack = `${normalizedTopic} ${normalizedSections}`;

  const tags = new Set<string>();
  const category = inferCategory(draft);
  tags.add(category);

  for (const [needle, tag] of semanticTagMap) {
    if (haystack.includes(needle)) {
      tags.add(tag);
    }
  }

  for (const candidate of extractSemanticTokens(haystack)) {
    tags.add(candidate);
    if (tags.size >= 6) break;
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
  ['etablererprøven', 'etablererproven'],
  ['etablererproven', 'etablererproven'],
  ['skjenkebevilling', 'skjenkebevilling'],
  ['salgsbevilling', 'salgsbevilling'],
  ['styrer', 'styrer'],
  ['stedfortreder', 'stedfortreder'],
  ['pensum', 'pensum'],
  ['vanlige feil', 'vanlige-feil'],
  ['forberede', 'forberedelse'],
  ['ansvar', 'ansvar'],
  ['internkontroll', 'internkontroll'],
  ['kommune', 'kommune'],
  ['kommunens prøve', 'kommunens-prove'],
  ['kommunens prove', 'kommunens-prove'],
  ['bestå', 'besta'],
  ['besta', 'besta'],
];

function extractSemanticTokens(haystack: string): string[] {
  const stopWords = new Set([
    'dette',
    'denne',
    'hva',
    'hvor',
    'hvordan',
    'hvilke',
    'hvilken',
    'for',
    'med',
    'til',
    'hos',
    'som',
    'det',
    'der',
    'leser',
    'klart',
    'guide',
    'kurs',
    'prove',
    'prøve',
  ]);

  const seen = new Set<string>();
  const tokens: string[] = [];

  for (const rawToken of haystack.split(/[^a-z0-9æøå]+/i)) {
    const token = normalizeSemanticTag(rawToken);
    if (!token || token.length < 4 || stopWords.has(token) || seen.has(token)) {
      continue;
    }
    seen.add(token);
    tokens.push(token);
  }

  return tokens;
}

function normalizeBasePath(basePath: string): string {
  if (!basePath.startsWith('/')) return `/${basePath}`;
  return basePath.endsWith('/') ? basePath.slice(0, -1) : basePath;
}

function toTitle(topic: string): string {
  const trimmed = normalizeSearchText(topic);
  if (!trimmed) return 'Ny guide';
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
}

function summarizeDescription(sections: Array<{ heading: string; body: string }>): string {
  const summary = sections
    .map((section) => section.body.trim())
    .join(' ')
    .replace(/\s+/g, ' ')
    .slice(0, 155)
    .trim();

  return summary || 'Kort forklaring og neste steg for leseren.';
}

function summarizeExcerpt(sections: Array<{ heading: string; body: string }>): string {
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

function buildBrandContext(host: PublicationHostContext): {
  brandName: string;
  wordmark: string;
  supportEmail: string;
  primaryCtaLabel: string;
  secondaryCtaLabel: string;
  primaryCtaUrl: string;
  secondaryCtaUrl: string;
} {
  const site = new URL(host.siteUrl);
  const hostname = site.hostname.replace(/^www\./, '');
  const titleCase = host.hostName?.trim() || hostname;
  const supportEmail = `hello@${hostname}`;

  return {
    brandName: titleCase,
    wordmark: hostname,
    supportEmail,
    primaryCtaLabel: 'Gå til hovedsiden',
    secondaryCtaLabel: 'Flere artikler',
    primaryCtaUrl: new URL('/', host.siteUrl).toString(),
    secondaryCtaUrl: new URL(`${normalizeBasePath(host.basePath)}/`, host.siteUrl).toString(),
  };
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
  brand: {
    brandName: string;
    wordmark: string;
    supportEmail: string;
    primaryCtaLabel: string;
    secondaryCtaLabel: string;
    primaryCtaUrl: string;
    secondaryCtaUrl: string;
  };
}): string {
  const articleHtml = input.sections
    .map(
      (section) =>
        `<section><h2>${escapeHtml(section.heading)}</h2>${renderParagraphs(section.body)}</section>`,
    )
    .join('');

  const tags = input.tags.map((tag) => `<li>${escapeHtml(tag)}</li>`).join('');

  return `<!DOCTYPE html>
<html lang="nb">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${escapeHtml(input.title)} | ${escapeHtml(input.brand.brandName)}</title>
    <meta name="description" content="${escapeHtml(input.description)}" />
    <link rel="canonical" href="${escapeHtml(input.canonicalUrl)}" />
    <meta name="robots" content="index,follow,max-image-preview:large" />
    <meta name="theme-color" content="#115E59" />
    <meta property="og:title" content="${escapeHtml(input.title)} | ${escapeHtml(input.brand.brandName)}" />
    <meta property="og:description" content="${escapeHtml(input.description)}" />
    <meta property="og:type" content="article" />
    <meta property="og:url" content="${escapeHtml(input.canonicalUrl)}" />
    <meta property="og:site_name" content="${escapeHtml(input.brand.brandName)}" />
    <meta property="og:locale" content="nb_NO" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${escapeHtml(input.title)} | ${escapeHtml(input.brand.brandName)}" />
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
        <a href="${escapeHtml(input.brand.secondaryCtaUrl)}" class="brand">
          <span class="brand-mark">${escapeHtml(input.brand.wordmark.charAt(0) || 'g')}</span>
          <span>
            <span class="brand-name">${escapeHtml(input.brand.wordmark)}</span>
            <span class="brand-sub">Guide</span>
          </span>
        </a>
        <nav class="nav">
          <a href="${escapeHtml(input.brand.secondaryCtaUrl)}">Artikler</a>
          <a href="${escapeHtml(input.brand.primaryCtaUrl)}">Hovedside</a>
        </nav>
        <div class="header-links">
          <a href="${escapeHtml(input.brand.primaryCtaUrl)}">${escapeHtml(input.brand.primaryCtaLabel)}</a>
          <a href="${escapeHtml(input.brand.secondaryCtaUrl)}" class="cta-primary">${escapeHtml(input.brand.secondaryCtaLabel)}</a>
        </div>
      </div>
    </header>
    <div class="mobile-wrap">
      <div class="mobile-nav">
        <a href="${escapeHtml(input.brand.secondaryCtaUrl)}">Artikler</a>
        <a href="${escapeHtml(input.brand.primaryCtaUrl)}">Hovedside</a>
      </div>
    </div>
    <main>
      <div class="hero">
        <p class="eyebrow">${escapeHtml(input.category)}</p>
        <h1>${escapeHtml(input.title)}</h1>
        <p class="lead">${escapeHtml(input.excerpt)}</p>
        <div class="meta">
          <span>${new Date().toLocaleDateString('nb-NO', { year: 'numeric', month: 'long', day: 'numeric' })}</span>
          <span>Publisert i guideseksjonen</span>
        </div>
      </div>
      <div class="main-grid">
        <article class="shell-card article-card">
          ${articleHtml}
          <ul class="tags">${tags}</ul>
          <p class="footer-note">Denne artikkelen følger samme URL-struktur og uttrykk som resten av guideseksjonen, og kan senere flyttes inn i den statiske siden uten å endre adressen.</p>
        </article>
        <aside class="aside">
          <div class="shell-card aside-card">
            <p class="eyebrow">Neste steg</p>
            <p>Hvis du vil ha mer kontekst eller gå videre til riktig tilbud, fortsetter du på hovedsiden eller i guideseksjonen.</p>
            <div class="aside-actions">
              <a href="${escapeHtml(input.brand.primaryCtaUrl)}" class="cta-primary">${escapeHtml(input.brand.primaryCtaLabel)}</a>
              <a href="${escapeHtml(input.brand.secondaryCtaUrl)}" class="cta-secondary">${escapeHtml(input.brand.secondaryCtaLabel)}</a>
            </div>
          </div>
          <div class="shell-card aside-card">
            <p class="eyebrow">Om artikkelen</p>
            <dl>
              <dt>Kategori</dt>
              <dd>${escapeHtml(input.category)}</dd>
              <dt>Formål</dt>
              <dd>Forklare spørsmålet tydelig og lede leseren videre til et trygt neste steg.</dd>
              <dt>Format</dt>
              <dd>Guideartikkel</dd>
            </dl>
          </div>
        </aside>
      </div>
    </main>
    <footer class="footer">
      <div class="footer-grid">
        <div>
          <p class="eyebrow" style="color:#6ee7b7">${escapeHtml(input.brand.brandName)}</p>
          <p class="footer-display">Forklaringer og artikler som hjelper leseren videre uten å bryte med vertssidens opplevelse.</p>
          <p class="footer-copy">Denne siden følger samme designretning og URL-struktur som resten av guideseksjonen, slik at leseren møter en stabil opplevelse også når nytt innhold publiseres raskt.</p>
          <div class="footer-cta">
            <a href="${escapeHtml(input.brand.primaryCtaUrl)}" class="cta-primary">${escapeHtml(input.brand.primaryCtaLabel)}</a>
            <a href="mailto:${escapeHtml(input.brand.supportEmail)}" class="cta-secondary" style="background:#0f172a;color:white;border-color:#334155">Kontakt</a>
          </div>
        </div>
        <div class="footer-links">
          <div>
            <p class="footer-title">Videre</p>
            <a href="${escapeHtml(input.brand.primaryCtaUrl)}">Gå til hovedsiden</a><br />
            <span class="muted">Bruk hovedsiden når leseren trenger tilbud, checkout eller neste kommersielle steg.</span><br /><br />
            <a href="${escapeHtml(input.brand.secondaryCtaUrl)}">Flere artikler</a><br />
            <span class="muted">Guideseksjonen kan utvides uten å endre hoveddomenets grunnstruktur.</span>
          </div>
          <div>
            <p class="footer-title">Teknisk</p>
            <a href="${escapeHtml(new URL('rss.xml', input.brand.secondaryCtaUrl).toString())}">RSS-feed</a><br />
            <a href="${escapeHtml(new URL('sitemap.xml', input.brand.secondaryCtaUrl).toString())}">Sitemap</a><br />
            <a href="${escapeHtml(input.brand.primaryCtaUrl)}">${escapeHtml(input.brand.wordmark)}</a><br />
            <a href="mailto:${escapeHtml(input.brand.supportEmail)}">${escapeHtml(input.brand.supportEmail)}</a>
          </div>
        </div>
      </div>
      <div class="footer-bar">
        <span>&copy; ${new Date().getFullYear()} ${escapeHtml(input.brand.brandName)}.</span>
        <span>Innholdet følger samme URL-struktur som resten av guideseksjonen.</span>
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

function countWords(value: string): number {
  return value.trim().split(/\s+/).filter(Boolean).length;
}
