export interface CourseLinkConfig {
  path: string;
  label: string;
  description: string;
}

export interface ConceptShellConfig {
  subLabel: string;
  homeEyebrow: string;
  homeTitle: string;
  homeDescription: string;
  homeStats: Array<{ value: string; label: string }>;
  homeAsideEyebrow: string;
  homeAsideReasonTitle: string;
  homeAsideReasonText: string;
  listingEyebrow: string;
  listingTitle: string;
  listingDescription: string;
  listingEmptyText: string;
  articleContextLabel: string;
  articleLanguageBadge: string;
  articlePrimaryActionText: string;
  articleNextStepEyebrow: string;
  articleNextStepText: string;
  articleAboutPurpose: string;
  footerEyebrow: string;
  footerTitle: string;
  footerDescription: string;
  footerOffersLabel: string;
  footerTechnicalLabel: string;
  footerContactLabel: string;
  footerCopyright: string;
  footerNote: string;
  directorySearchEyebrow?: string;
  directorySearchTitle?: string;
  directorySearchDescription?: string;
  directorySearchPlaceholder?: string;
  directorySearchEmpty?: string;
  directorySearchAriaLabel?: string;
  directorySearchActionLabel?: string;
  directorySearchMetaFallback?: string;
}

export interface SiteConceptConfig {
  key: string;
  label: string;
  pageStructure: 'blog' | 'directory';
  basePath: string;
  siteUrl: string;
  siteName: string;
  shellKey?: string;
  routes: {
    articlePrefix: string;
    categoryPrefix: string;
    authorPrefix: string;
  };
  audit: {
    sitemapUrls: string[];
    extraUrls: string[];
  };
}

export interface SiteProfileConfig {
  key: string;
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
    routeWorkerName: string;
  };
  courseLinkSetKey?: string;
  concepts: Record<string, SiteConceptConfig>;
}

export interface ActiveSiteRuntime {
  siteKey: string;
  conceptKey: string;
  site: SiteProfileConfig;
  concept: SiteConceptConfig;
}

export const siteProfiles: Record<string, SiteProfileConfig>;
export function resolveActiveSiteRuntime(env?: Record<string, string | undefined>): ActiveSiteRuntime;
