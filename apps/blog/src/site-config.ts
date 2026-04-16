import { getResolvedSiteCopy } from '../site-copy.mjs';
import { resolveActiveSiteRuntime, siteProfiles } from '../site-profiles.mjs';

type RuntimeShape = {
  siteKey: string;
  conceptKey: string;
  site: {
    brand: {
      mainSiteName: string;
      wordmark: string;
      mainSiteUrl: string;
      locale: string;
      supportEmail: string;
      defaultOgImagePath: string;
      logoMark: string;
    };
    cloudflare: {
      pagesProject: string;
      pagesPreviewAlias: string;
    };
    telemetry?: {
      rumEndpoint?: string;
      metricsWorkerUrl?: string;
    };
    courseLinkSetKey?: string;
  };
  concept: {
    key: string;
    label: string;
    pageStructure: string;
    basePath: string;
    siteUrl: string;
    siteName: string;
    description?: string;
    routes: {
      articlePrefix: string;
      categoryPrefix: string;
      authorPrefix: string;
    };
    cloudflare: {
      pagesProject: string;
      pagesPreviewAlias: string;
      routeWorkerName: string;
      routeWorkerDirectory: string;
    };
    audit: {
      sitemapUrls: string[];
      extraUrls: string[];
      lighthouse?: {
        runs?: number;
        warmupRuns?: number;
      };
    };
    nav?: Array<{
      path: string;
      label: string;
    }>;
    callsToAction?: {
      primary: { href: string; label: string };
      secondary: { href: string; label: string };
    };
    shellKey?: string;
  };
};

const activeRuntime = resolveActiveSiteRuntime(process.env) as RuntimeShape;
const resolvedCopy = getResolvedSiteCopy(activeRuntime.siteKey, activeRuntime.conceptKey);

export const siteRegistry = siteProfiles;
export const siteConfig = activeRuntime;

export const ACTIVE_SITE_KEY = activeRuntime.siteKey;
export const ACTIVE_CONCEPT_KEY = activeRuntime.conceptKey;

export const ACTIVE_SITE = activeRuntime.site;
export const ACTIVE_CONCEPT = activeRuntime.concept;

export const MAIN_SITE_NAME = ACTIVE_SITE.brand.mainSiteName;
export const MAIN_SITE_URL = ACTIVE_SITE.brand.mainSiteUrl;
export const SITE_WORDMARK = ACTIVE_SITE.brand.wordmark;
export const SITE_LOGO_MARK = ACTIVE_SITE.brand.logoMark;
export const SITE_LOCALE = ACTIVE_SITE.brand.locale;
export const SITE_LANGUAGE = ACTIVE_SITE.brand.locale.split('-')[0] ?? 'en';
export const SUPPORT_EMAIL = ACTIVE_SITE.brand.supportEmail;
export const DEFAULT_OG_IMAGE = `${MAIN_SITE_URL}${ACTIVE_SITE.brand.defaultOgImagePath}`;

export const CONCEPT_NAME = ACTIVE_CONCEPT.siteName;
export const CONCEPT_LABEL = ACTIVE_CONCEPT.label;
export const CONCEPT_PAGE_STRUCTURE = ACTIVE_CONCEPT.pageStructure;
export const BLOG_BASE_PATH = ACTIVE_CONCEPT.basePath;
export const SITE_URL = ACTIVE_CONCEPT.siteUrl;
export const SITE_NAME = ACTIVE_CONCEPT.siteName;
export const SITE_DESCRIPTION = resolvedCopy.description;

export const CLOUDFLARE_PAGES_PROJECT = ACTIVE_CONCEPT.cloudflare.pagesProject;
export const CLOUDFLARE_PAGES_PREVIEW_ALIAS = ACTIVE_CONCEPT.cloudflare.pagesPreviewAlias;
export const CLOUDFLARE_ROUTE_WORKER = ACTIVE_CONCEPT.cloudflare.routeWorkerName;
export const CLOUDFLARE_ROUTE_WORKER_DIRECTORY = ACTIVE_CONCEPT.cloudflare.routeWorkerDirectory;
export const DEPLOY_AUDIT_SITEMAPS = ACTIVE_CONCEPT.audit.sitemapUrls;
export const DEPLOY_AUDIT_EXTRA_URLS = ACTIVE_CONCEPT.audit.extraUrls;
export const LIGHTHOUSE_AUDIT_RUNS = ACTIVE_CONCEPT.audit.lighthouse?.runs ?? 1;
export const LIGHTHOUSE_AUDIT_WARMUP_RUNS = ACTIVE_CONCEPT.audit.lighthouse?.warmupRuns ?? 0;
export const RUM_ENDPOINT = conceptPath('/__rum');
export const METRICS_WORKER_URL = ACTIVE_SITE.telemetry?.metricsWorkerUrl ?? '';

export const PRIMARY_CTA = resolvedCopy.callsToAction.primary;
export const SECONDARY_CTA = resolvedCopy.callsToAction.secondary;
export const SHELL_COPY = resolvedCopy.shell;

export const CONTENT_ROUTES = ACTIVE_CONCEPT.routes;

export function conceptPath(path = ''): string {
  if (!path || path === '/') return BLOG_BASE_PATH;
  const normalized = path.startsWith('/') ? path : `/${path}`;
  const [pathname, suffix = ''] = normalized.split(/(?=[?#])/);
  const needsTrailingSlash = pathname !== '/' && !pathname.endsWith('/') && !/\.[a-z0-9]+$/i.test(pathname);
  const routePath = needsTrailingSlash ? `${pathname}/` : pathname;
  return `${BLOG_BASE_PATH}${routePath}${suffix}`;
}

export function blogPath(path = ''): string {
  return conceptPath(path);
}

function conceptRoutePath(prefix: string, slug: string): string {
  const normalizedPrefix = prefix === '/' ? '' : prefix;
  return conceptPath(`${normalizedPrefix}/${slug}`);
}

export function articlePath(slug: string): string {
  return conceptRoutePath(CONTENT_ROUTES.articlePrefix, slug);
}

export function categoryPath(slug: string): string {
  return conceptRoutePath(CONTENT_ROUTES.categoryPrefix, slug);
}

export function authorPath(slug: string): string {
  return conceptRoutePath(CONTENT_ROUTES.authorPrefix, slug);
}

export const MAIN_NAV = resolvedCopy.nav.map((item: (typeof resolvedCopy.nav)[number]) => ({
  href: conceptPath(item.path),
  label: item.label,
}));

export const COURSE_LINKS = resolvedCopy.courseLinks.map((item: (typeof resolvedCopy.courseLinks)[number]) => ({
  href: `${MAIN_SITE_URL}${item.path}`,
  label: item.label,
  description: item.description,
}));
