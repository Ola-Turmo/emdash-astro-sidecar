/**
 * Edit this file first when onboarding the sidecar to a new host site.
 *
 * Keep the Astro `site` and `base` settings in `apps/blog/astro.config.mjs`
 * aligned with `siteUrl` and `basePath` below.
 */
export const siteConfig = {
  brand: {
    mainSiteName: 'Kurs.ing',
    blogName: 'Kurs.ing Blogg',
    mainSiteUrl: 'https://www.kurs.ing',
    siteUrl: 'https://www.kurs.ing/guide',
    basePath: '/guide',
    locale: 'nb-NO',
    supportEmail: 'ola@kurs.ing',
    description:
      'Norske guider om etablererprøven, skjenkebevilling og salgsbevilling, skrevet for folk som vil bestå kommunens prøve og komme raskt i gang.',
  },
  cloudflare: {
    pagesProject: 'emdash-astro-sidecar',
    pagesPreviewAlias: 'master.emdash-astro-sidecar.pages.dev',
    routeWorkerName: 'kurs-ing-guide-proxy',
  },
  audit: {
    sitemapUrls: ['https://www.kurs.ing/guide/sitemap.xml'],
    extraUrls: ['https://www.kurs.ing/blog/salgsbevilling-pensum-og-vanlige-feil/'],
  },
  nav: [
    { path: '/', label: 'Artikler' },
    { path: '/category/etablererproven', label: 'Etablererprøven' },
    { path: '/category/skjenkebevilling', label: 'Skjenkebevilling' },
    { path: '/category/salgsbevilling', label: 'Salgsbevilling' },
  ],
  courseLinks: [
    {
      path: '/etablererproven',
      label: 'Kurs for etablererprøven',
      description: 'Pensum, oppgaver og råd før prøven i kommunen.',
    },
    {
      path: '/skjenkebevilling',
      label: 'Kurs for skjenkebevilling',
      description: 'For styrer og stedfortreder som må dokumentere kunnskap om alkoholloven.',
    },
    {
      path: '/salgsbevilling',
      label: 'Kurs for salgsbevilling',
      description: 'For butikker og utsalgssteder som skal søke eller drifte salgsbevilling.',
    },
  ],
} as const;

export const BLOG_BASE_PATH = siteConfig.brand.basePath;
export const SITE_URL = siteConfig.brand.siteUrl;
export const MAIN_SITE_URL = siteConfig.brand.mainSiteUrl;
export const SITE_NAME = siteConfig.brand.blogName;
export const SITE_DESCRIPTION = siteConfig.brand.description;
export const SITE_LOCALE = siteConfig.brand.locale;
export const SUPPORT_EMAIL = siteConfig.brand.supportEmail;

export const CLOUDFLARE_PAGES_PROJECT = siteConfig.cloudflare.pagesProject;
export const CLOUDFLARE_PAGES_PREVIEW_ALIAS = siteConfig.cloudflare.pagesPreviewAlias;
export const CLOUDFLARE_ROUTE_WORKER = siteConfig.cloudflare.routeWorkerName;
export const DEPLOY_AUDIT_SITEMAPS = siteConfig.audit.sitemapUrls;
export const DEPLOY_AUDIT_EXTRA_URLS = siteConfig.audit.extraUrls;

export function blogPath(path = ''): string {
  if (!path || path === '/') return BLOG_BASE_PATH;
  const normalized = path.startsWith('/') ? path : `/${path}`;
  const [pathname, suffix = ''] = normalized.split(/(?=[?#])/);
  const needsTrailingSlash = pathname !== '/' && !pathname.endsWith('/') && !/\.[a-z0-9]+$/i.test(pathname);
  const routePath = needsTrailingSlash ? `${pathname}/` : pathname;
  return `${BLOG_BASE_PATH}${routePath}${suffix}`;
}

export const MAIN_NAV = siteConfig.nav.map((item) => ({
  href: blogPath(item.path),
  label: item.label,
}));

export const COURSE_LINKS = siteConfig.courseLinks.map((item) => ({
  href: `${MAIN_SITE_URL}${item.path}`,
  label: item.label,
  description: item.description,
}));
