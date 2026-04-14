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
    },
    rootRouting: {
      rootOrigin: 'https://new.kurs.ing',
      requiredMarkers: ['<title>kurs.ing</title>'],
      forbiddenMarkers: ['Kurs.ing Kommune', 'Kommuneguide', 'Kommunespesifikke sider'],
      exactBypassPaths: ['/robots.txt', '/sitemap.xml', '/sitemap-index.xml'],
    },
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
    concepts: {
      guide: {
        key: 'guide',
        label: 'Blogg',
        pageStructure: 'blog',
        basePath: '/guide',
        siteUrl: 'https://www.kurs.ing/guide',
        siteName: 'Kurs.ing Blogg',
        description:
          'Norske guider om etablererprøven, skjenkebevilling og salgsbevilling, skrevet for folk som vil bestå kommunens prøve og komme raskt i gang.',
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
        },
        nav: [
          { path: '/', label: 'Artikler' },
          { path: '/category/etablererproven', label: 'Etablererprøven' },
          { path: '/category/skjenkebevilling', label: 'Skjenkebevilling' },
          { path: '/category/salgsbevilling', label: 'Salgsbevilling' },
        ],
        callsToAction: {
          primary: {
            href: 'https://www.kurs.ing/kasse.html',
            label: 'Kjøp kurset',
          },
          secondary: {
            href: 'https://www.kurs.ing',
            label: 'Hovedside',
          },
        },
        shell: {
          subLabel: 'Blogg',
          homeEyebrow: 'Forklart enkelt',
          homeTitle: 'Det du må vite om etablererprøven, skjenkebevilling og salgsbevilling.',
          homeDescription:
            'Her finner du enkle forklaringer på vanlige spørsmål om krav, pensum og ansvar. Målet er å gjøre det lettere å forstå hva du må kunne før du kjøper kurs eller går opp til prøve.',
          homeStats: [
            {
              value: '3',
              label: 'kurs i én pakke på hovedsiden',
            },
            {
              value: '8 uker',
              label: 'tilgang etter kjøp',
            },
            {
              value: 'Norsk',
              label: 'innhold skrevet for norske krav og kommunale prøver',
            },
          ],
          homeAsideEyebrow: 'Velg riktig kurs',
          homeAsideReasonTitle: 'Derfor finnes disse artiklene',
          homeAsideReasonText:
            'Her får du raske og tydelige svar på det folk ofte lurer på før de velger kurs eller går opp til kommunens prøve.',
          listingEyebrow: 'Artikler',
          listingTitle: 'Dette lurer mange på før de går opp til prøve',
          listingDescription: 'Forklaringer av pensum, krav, ansvar og hvordan du forbereder deg best mulig.',
          articleContextLabel: 'Guide',
          articleLanguageBadge: 'På norsk',
          articlePrimaryActionText: 'Les artikkel',
          articleNextStepEyebrow: 'Neste steg',
          articleNextStepText:
            'Når du er klar for pensum, oppgaver og eksamentrening, går du videre til kurspakken på hovedsiden.',
          articleAboutPurpose: 'Forklare krav tydelig og lede videre til riktig kurs.',
          footerEyebrow: 'Kurs.ing blogg',
          footerTitle: 'Artikler som hjelper deg å forstå kravene før du kjøper eller går opp til prøve.',
          footerDescription:
            'Her finner du forklaringer og råd som gjør det lettere å forstå kravene rundt etablererprøven, skjenkebevilling og salgsbevilling.',
          footerCopyright: 'Innhold for Norge, skrevet på norsk.',
          footerNote: 'Beståttgaranti og produktinformasjon finner du på hovedsiden.',
        },
      },
      kommune: {
        key: 'kommune',
        label: 'Kommune',
        pageStructure: 'directory',
        basePath: '/kommune',
        siteUrl: 'https://www.kurs.ing/kommune',
        siteName: 'Kurs.ing Kommune',
        description:
          'Kommunespesifikke sider for etablererprøven, skjenkebevilling og salgsbevilling, med samme design som resten av kurs.ing og en mer lokal informasjonsstruktur.',
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
            'https://www.kurs.ing/kommune/oslo/',
            'https://www.kurs.ing/kommune/bergen/',
            'https://www.kurs.ing/kommune/trondheim/',
            'https://www.kurs.ing/kommune/stavanger/',
          ],
        },
        nav: [
          { path: '/', label: 'Kommuner' },
          { path: '/oslo', label: 'Oslo' },
          { path: '/bergen', label: 'Bergen' },
          { path: '/sandefjord', label: 'Sandefjord' },
        ],
        callsToAction: {
          primary: {
            href: 'https://www.kurs.ing/kasse.html',
            label: 'Se kurspakken',
          },
          secondary: {
            href: 'https://www.kurs.ing',
            label: 'Til kurs.ing',
          },
        },
        shell: {
          subLabel: 'Kommune',
          homeEyebrow: 'Kommuneguide',
          homeTitle: 'Kommunesider som samler skjenking, innsyn, skjema og lokale lenker.',
          homeDescription:
            'Her kan du samle viktige lenker og praktiske forskjeller mellom kommuner, uten å blande dem sammen med den vanlige guidebloggen.',
          homeStats: [],
          homeAsideEyebrow: 'Utvalgte kommuner',
          homeAsideReasonTitle: 'Hva disse sidene skal gjøre',
          homeAsideReasonText:
            'Kommunesidene skal hjelpe leseren å finne lokale sider, forstå hvor innsyn og skjema ligger, og vite hvilke kommunale lenker som er mest relevante før de går videre til kurs eller guide.',
          listingEyebrow: 'Kommuner',
          listingTitle: 'Velg kommunen du vil se nærmere på',
          listingDescription: 'Start med kommunen du jobber mot. Hver side samler innsyn, skjema, skjenking og relevante lokale lenker på ett sted.',
          articleContextLabel: 'Kommune',
          articleLanguageBadge: 'På norsk',
          articlePrimaryActionText: 'Les kommunesiden',
          articleNextStepEyebrow: 'Neste steg',
          articleNextStepText: 'Bruk kommunesiden for lokal oversikt, og gå deretter videre til riktig guide eller kurs når du trenger forklaring og trening.',
          articleAboutPurpose: 'Gi lokale sider en egen informasjonsstruktur uten å blande dem med guide-bloggen.',
          footerEyebrow: 'Kurs.ing kommune',
          footerTitle: 'Kommunespesifikk informasjon med samme design og en egen lokal innholdsmodell.',
          footerDescription: 'Kommunesidene samler de viktigste lokale lenkene og gjør det enklere å orientere seg før du går videre til riktig kurs eller guide.',
          footerCopyright: 'Kommunespesifikt innhold for Norge.',
          footerNote: 'Bruk hovedsiden og guideseksjonen når du trenger mer forklaring eller vil videre til kurs.',
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
    },
    rootRouting: {
      rootOrigin: 'https://www.gatareba.ge',
      requiredMarkers: [],
      forbiddenMarkers: [],
      exactBypassPaths: ['/robots.txt', '/sitemap.xml', '/sitemap-index.xml'],
    },
    courseLinks: [],
    concepts: {
      guide: {
        key: 'guide',
        label: 'Guide',
        pageStructure: 'blog',
        basePath: '/guide',
        siteUrl: 'https://www.gatareba.ge/guide',
        siteName: 'Gatareba.ge Guide',
        description: 'Example profile for a completely unrelated domain. Replace with real brand copy before deployment.',
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
        },
        nav: [
          { path: '/', label: 'Articles' },
        ],
        callsToAction: {
          primary: {
            href: 'https://www.gatareba.ge',
            label: 'Go to site',
          },
          secondary: {
            href: 'mailto:hello@gatareba.ge',
            label: 'Contact',
          },
        },
        shell: {
          subLabel: 'Guide',
          homeEyebrow: 'Replace this profile',
          homeTitle: 'This unrelated-domain example is here to prove the repo can separate sites cleanly.',
          homeDescription:
            'Before using this profile, replace all copy, CTA links, taxonomy, audit targets, and concept routing with real site data.',
          homeStats: [],
          homeAsideEyebrow: 'Important',
          homeAsideReasonTitle: 'Example only',
          homeAsideReasonText: 'Do not ship this profile as-is. It is only a scaffold for a completely different domain.',
          listingEyebrow: 'Articles',
          listingTitle: 'Guide content',
          listingDescription: 'Replace with real content for the new site.',
          articleContextLabel: 'Guide',
          articleLanguageBadge: 'Localized',
          articlePrimaryActionText: 'Read article',
          articleNextStepEyebrow: 'Next step',
          articleNextStepText: 'Replace all content and actions before publishing.',
          articleAboutPurpose: 'Demonstrate site separation.',
          footerEyebrow: 'Guide',
          footerTitle: 'Replace this scaffold with real brand copy.',
          footerDescription: 'This profile exists to show how unrelated sites can live in the same repo without sharing config.',
          footerCopyright: 'Example profile only.',
          footerNote: 'Replace before launch.',
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
