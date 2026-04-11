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
  articleContextLabel: string;
  articleLanguageBadge: string;
  articlePrimaryActionText: string;
  articleNextStepEyebrow: string;
  articleNextStepText: string;
  articleAboutPurpose: string;
  footerEyebrow: string;
  footerTitle: string;
  footerDescription: string;
  footerCopyright: string;
  footerNote: string;
}

export interface SiteConceptConfig {
  key: string;
  label: string;
  pageStructure: 'blog' | 'directory';
  basePath: string;
  siteUrl: string;
  siteName: string;
  description: string;
  routes: {
    articlePrefix: string;
    categoryPrefix: string;
    authorPrefix: string;
  };
  audit: {
    sitemapUrls: string[];
    extraUrls: string[];
  };
  nav: Array<{ path: string; label: string }>;
  callsToAction: {
    primary: { href: string; label: string };
    secondary: { href: string; label: string };
  };
  shell: ConceptShellConfig;
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
  courseLinks: CourseLinkConfig[];
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
