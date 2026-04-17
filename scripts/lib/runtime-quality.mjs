import { resolveActiveSiteRuntime } from '../../apps/blog/site-profiles.mjs';

const DEFAULT_FIELD_TARGETS = {
  release: {
    LCP: 2500,
    INP: 200,
    CLS: 0.1,
    TTFB: 800,
    FCP: 1800,
  },
  flagship: {
    LCP: 1500,
    INP: 200,
    CLS: 0.1,
    TTFB: 800,
    FCP: 1500,
  },
};

const DEFAULT_LIGHTHOUSE_TARGETS = {
  release: {
    performance: 90,
    accessibility: 90,
    seo: 90,
    bestPractices: 90,
    tbt: 200,
  },
  flagship: {
    performance: 95,
    accessibility: 90,
    seo: 90,
    bestPractices: 90,
    tbt: 200,
  },
};

export function loadRuntimeQualityConfig(env = process.env) {
  const runtime = resolveActiveSiteRuntime(env);
  const quality = runtime.concept.quality || {};
  const auditUrls = [...new Set([runtime.concept.siteUrl, ...(runtime.concept.audit?.extraUrls || [])].filter(Boolean))];
  const flagshipUrls = [...new Set((quality.flagshipUrls || auditUrls).filter(Boolean))];

  return {
    runtime,
    dashboardLabel: quality.dashboardLabel || `${runtime.siteKey}/${runtime.conceptKey}`,
    auditUrls,
    flagshipUrls,
    fieldTargets: {
      release: { ...DEFAULT_FIELD_TARGETS.release, ...(quality.fieldTargets?.release || {}) },
      flagship: { ...DEFAULT_FIELD_TARGETS.flagship, ...(quality.fieldTargets?.flagship || {}) },
    },
    lighthouseTargets: {
      release: { ...DEFAULT_LIGHTHOUSE_TARGETS.release, ...(quality.lighthouseTargets?.release || {}) },
      flagship: { ...DEFAULT_LIGHTHOUSE_TARGETS.flagship, ...(quality.lighthouseTargets?.flagship || {}) },
    },
    publishPolicy: quality.publishPolicy || [],
    outputScope: [runtime.siteKey, runtime.conceptKey],
  };
}

export function isFlagshipUrl(url, config) {
  return config.flagshipUrls.includes(url);
}

export function toConceptRelativePath(url, siteUrl) {
  const conceptUrl = new URL(siteUrl);
  const targetUrl = new URL(url, conceptUrl);
  let pathname = targetUrl.pathname;
  if (pathname.startsWith(conceptUrl.pathname)) {
    pathname = pathname.slice(conceptUrl.pathname.length) || '/';
  }
  if (!pathname.startsWith('/')) {
    pathname = `/${pathname}`;
  }
  return pathname === '' ? '/' : pathname;
}

export function getApplicableFieldTargets(url, config) {
  return isFlagshipUrl(url, config) ? config.fieldTargets.flagship : config.fieldTargets.release;
}

export function getApplicableLighthouseTargets(url, config) {
  return isFlagshipUrl(url, config) ? config.lighthouseTargets.flagship : config.lighthouseTargets.release;
}
