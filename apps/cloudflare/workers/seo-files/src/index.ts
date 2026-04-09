interface Env {
  MAIN_SITE_URL: string;
  GUIDE_SITE_URL: string;
}

function xmlResponse(body: string): Response {
  return new Response(body, {
    headers: {
      'content-type': 'application/xml; charset=utf-8',
      'cache-control': 'public, max-age=600',
      'x-content-type-options': 'nosniff',
    },
  });
}

function textResponse(body: string): Response {
  return new Response(body, {
    headers: {
      'content-type': 'text/plain; charset=utf-8',
      'cache-control': 'public, max-age=600',
      'x-content-type-options': 'nosniff',
    },
  });
}

function renderRobots(mainSiteUrl: string, guideSiteUrl: string): string {
  return `User-agent: *
Allow: /

Sitemap: ${mainSiteUrl}/sitemap.xml
Sitemap: ${mainSiteUrl}/sitemap-index.xml
Sitemap: ${guideSiteUrl}/sitemap.xml
`;
}

function renderMainSitemap(mainSiteUrl: string, guideSiteUrl: string): string {
  const pages = [
    `${mainSiteUrl}/`,
    `${mainSiteUrl}/etablererproven`,
    `${mainSiteUrl}/skjenkebevilling`,
    `${mainSiteUrl}/salgsbevilling`,
    `${guideSiteUrl}/`,
  ];

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${pages
  .map(
    (url) => `  <url>
    <loc>${url}</loc>
  </url>`,
  )
  .join('\n')}
</urlset>`;
}

function renderSitemapIndex(mainSiteUrl: string, guideSiteUrl: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <sitemap>
    <loc>${mainSiteUrl}/sitemap.xml</loc>
  </sitemap>
  <sitemap>
    <loc>${guideSiteUrl}/sitemap.xml</loc>
  </sitemap>
</sitemapindex>`;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === '/robots.txt') {
      return textResponse(renderRobots(env.MAIN_SITE_URL, env.GUIDE_SITE_URL));
    }

    if (url.pathname === '/sitemap.xml') {
      return xmlResponse(renderMainSitemap(env.MAIN_SITE_URL, env.GUIDE_SITE_URL));
    }

    if (url.pathname === '/sitemap-index.xml') {
      return xmlResponse(renderSitemapIndex(env.MAIN_SITE_URL, env.GUIDE_SITE_URL));
    }

    return new Response('Not found', { status: 404 });
  },
};
