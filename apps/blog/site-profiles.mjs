const siteProfiles = {
  'kurs-ing': {
    key: 'kurs-ing',
    brand: {
      mainSiteName: 'Kurs.ing',
      wordmark: 'kurs.ing',
      mainSiteUrl: 'https://www.kurs.ing',
      locale: 'nb-NO',
      supportEmail: 'ola@kurs.ing',
      defaultOgImagePath: '/images/etablerer_hero.png',
      logoMark: 'k',
    },
    cloudflare: {
      pagesProject: 'emdash-astro-sidecar',
      pagesPreviewAlias: 'master.emdash-astro-sidecar.pages.dev',
    },
    telemetry: {
      rumEndpoint: 'https://emdash-metrics-worker.ola-turmo.workers.dev/rum',
      metricsWorkerUrl: 'https://emdash-metrics-worker.ola-turmo.workers.dev',
    },
    rootRouting: {
      rootOrigin: 'https://new.kurs.ing',
      requiredMarkers: ['<title>kurs.ing</title>'],
      forbiddenMarkers: ['Kurs.ing Kommune', 'Kommuneguide', 'Kommunespesifikke sider'],
      exactBypassPaths: ['/robots.txt', '/sitemap.xml', '/sitemap-index.xml'],
    },
    courseLinkSetKey: 'kurs-ing',
    concepts: {
      guide: {
        key: 'guide',
        label: 'Blogg',
        pageStructure: 'blog',
        basePath: '/guide',
        siteUrl: 'https://www.kurs.ing/guide',
        siteName: 'Kurs.ing Blogg',
        shellKey: 'kurs-ing/guide',
        routes: {
          articlePrefix: '/blog',
          categoryPrefix: '/category',
          authorPrefix: '/author',
        },
        cloudflare: {
          pagesProject: 'emdash-astro-sidecar',
          pagesPreviewAlias: 'master.emdash-astro-sidecar.pages.dev',
          routeWorkerName: 'kurs-ing-guide-proxy',
          routeWorkerDirectory: 'guide-proxy',
        },
        audit: {
          sitemapUrls: ['https://www.kurs.ing/guide/sitemap.xml'],
          extraUrls: ['https://www.kurs.ing/guide/blog/salgsbevilling-pensum-og-vanlige-feil/'],
          lighthouse: {
            runs: 1,
            warmupRuns: 0,
          },
        },
      },
      kommune: {
        key: 'kommune',
        label: 'Kommune',
        pageStructure: 'directory',
        basePath: '/kommune',
        siteUrl: 'https://www.kurs.ing/kommune',
        siteName: 'Kurs.ing Kommune',
        shellKey: 'kurs-ing/kommune',
        routes: {
          articlePrefix: '/',
          categoryPrefix: '/tema',
          authorPrefix: '/redaksjon',
        },
        cloudflare: {
          pagesProject: 'kurs-ing-static',
          pagesPreviewAlias: 'kurs-ing-static.pages.dev',
          routeWorkerName: 'kurs-ing-kommune-proxy',
          routeWorkerDirectory: 'kommune-proxy',
        },
        audit: {
          sitemapUrls: ['https://www.kurs.ing/kommune/sitemap.xml'],
          extraUrls: [
            'https://www.kurs.ing/kommune/arendal/',
            'https://www.kurs.ing/kommune/bergen/',
            'https://www.kurs.ing/kommune/trysil/',
          ],
          lighthouse: {
            runs: 3,
            warmupRuns: 1,
          },
        },
      },
    },
  },
  'gatareba-ge': {
    key: 'gatareba-ge',
    brand: {
      mainSiteName: 'Gatareba.ge',
      wordmark: 'gatareba.ge',
      mainSiteUrl: 'https://www.gatareba.ge',
      locale: 'ka-GE',
      supportEmail: 'hello@gatareba.ge',
      defaultOgImagePath: '/images/og-default.png',
      logoMark: 'g',
    },
    cloudflare: {
      pagesProject: 'gatareba-sidecar',
      pagesPreviewAlias: 'main.gatareba-sidecar.pages.dev',
    },
    telemetry: {
      rumEndpoint: '',
      metricsWorkerUrl: 'https://emdash-metrics-worker.ola-turmo.workers.dev',
    },
    rootRouting: {
      rootOrigin: 'https://www.gatareba.ge',
      requiredMarkers: [],
      forbiddenMarkers: [],
      exactBypassPaths: ['/robots.txt', '/sitemap.xml', '/sitemap-index.xml'],
    },
    courseLinkSetKey: 'gatareba-ge',
    concepts: {
      guide: {
        key: 'guide',
        label: 'Guide',
        pageStructure: 'blog',
        basePath: '/guide',
        siteUrl: 'https://www.gatareba.ge/guide',
        siteName: 'Gatareba.ge Guide',
        shellKey: 'gatareba-ge/guide',
        routes: {
          articlePrefix: '/blog',
          categoryPrefix: '/category',
          authorPrefix: '/author',
        },
        cloudflare: {
          pagesProject: 'gatareba-sidecar',
          pagesPreviewAlias: 'main.gatareba-sidecar.pages.dev',
          routeWorkerName: 'gatareba-guide-proxy',
          routeWorkerDirectory: 'guide-proxy',
        },
        audit: {
          sitemapUrls: ['https://www.gatareba.ge/guide/sitemap.xml'],
          extraUrls: [],
          lighthouse: {
            runs: 1,
            warmupRuns: 0,
          },
        },
      },
    },
  },
};

function getConceptOutputDir(siteKey, conceptKey) {
  return `./dist/${siteKey}/${conceptKey}`;
}

function resolveActiveSiteRuntime(env = process.env) {
  const siteKey = env.EMDASH_SITE_KEY || 'kurs-ing';
  const site = siteProfiles[siteKey];
  if (!site) {
    throw new Error(`Unknown EMDASH_SITE_KEY "${siteKey}"`);
  }

  const conceptKey = env.EMDASH_CONCEPT_KEY || 'guide';
  const concept = site.concepts[conceptKey];
  if (!concept) {
    throw new Error(`Unknown EMDASH_CONCEPT_KEY "${conceptKey}" for site "${siteKey}"`);
  }

  return {
    siteKey,
    conceptKey,
    site,
    concept,
  };
}

export { siteProfiles, resolveActiveSiteRuntime };
export { getConceptOutputDir };
