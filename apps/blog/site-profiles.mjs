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
    courseLinks: [
      {
        path: '/etablererproven',
        label: 'Kurs for etablererprÃ¸ven',
        description: 'Pensum, oppgaver og rÃ¥d fÃ¸r prÃ¸ven i kommunen.',
      },
      {
        path: '/skjenkebevilling',
        label: 'Kurs for skjenkebevilling',
        description: 'For styrer og stedfortreder som mÃ¥ dokumentere kunnskap om alkoholloven.',
      },
      {
        path: '/salgsbevilling',
        label: 'Kurs for salgsbevilling',
        description: 'For butikker og utsalgssteder som skal sÃ¸ke eller drifte salgsbevilling.',
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
          'Norske guider om etablererprÃ¸ven, skjenkebevilling og salgsbevilling, skrevet for folk som vil bestÃ¥ kommunens prÃ¸ve og komme raskt i gang.',
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
        nav: [
          { path: '/', label: 'Artikler' },
          { path: '/category/etablererproven', label: 'EtablererprÃ¸ven' },
          { path: '/category/skjenkebevilling', label: 'Skjenkebevilling' },
          { path: '/category/salgsbevilling', label: 'Salgsbevilling' },
        ],
        callsToAction: {
          primary: {
            href: 'https://www.kurs.ing/kasse.html',
            label: 'KjÃ¸p kurset',
          },
          secondary: {
            href: 'https://www.kurs.ing',
            label: 'Hovedside',
          },
        },
        shell: {
          subLabel: 'Blogg',
          homeEyebrow: 'Forklart enkelt',
          homeTitle: 'Det du mÃ¥ vite om etablererprÃ¸ven, skjenkebevilling og salgsbevilling.',
          homeDescription:
            'Her finner du enkle forklaringer pÃ¥ vanlige spÃ¸rsmÃ¥l om krav, pensum og ansvar. MÃ¥let er Ã¥ gjÃ¸re det lettere Ã¥ forstÃ¥ hva du mÃ¥ kunne fÃ¸r du kjÃ¸per kurs eller gÃ¥r opp til prÃ¸ve.',
          homeStats: [
            {
              value: '3',
              label: 'kurs i Ã©n pakke pÃ¥ hovedsiden',
            },
            {
              value: '8 uker',
              label: 'tilgang etter kjÃ¸p',
            },
            {
              value: 'Norsk',
              label: 'innhold skrevet for norske krav og kommunale prÃ¸ver',
            },
          ],
          homeAsideEyebrow: 'Velg riktig kurs',
          homeAsideReasonTitle: 'Derfor finnes disse artiklene',
          homeAsideReasonText:
            'Her fÃ¥r du raske og tydelige svar pÃ¥ det folk ofte lurer pÃ¥ fÃ¸r de velger kurs eller gÃ¥r opp til kommunens prÃ¸ve.',
          listingEyebrow: 'Artikler',
          listingTitle: 'Dette lurer mange pÃ¥ fÃ¸r de gÃ¥r opp til prÃ¸ve',
          listingDescription: 'Forklaringer av pensum, krav, ansvar og hvordan du forbereder deg best mulig.',
          articleContextLabel: 'Guide',
          articleLanguageBadge: 'PÃ¥ norsk',
          articlePrimaryActionText: 'Les artikkel',
          articleNextStepEyebrow: 'Neste steg',
          articleNextStepText:
            'NÃ¥r du er klar for pensum, oppgaver og eksamentrening, gÃ¥r du videre til kurspakken pÃ¥ hovedsiden.',
          articleAboutPurpose: 'Forklare krav tydelig og lede videre til riktig kurs.',
          footerEyebrow: 'Kurs.ing blogg',
          footerTitle: 'Artikler som hjelper deg Ã¥ forstÃ¥ kravene fÃ¸r du kjÃ¸per eller gÃ¥r opp til prÃ¸ve.',
          footerDescription:
            'Her finner du forklaringer og rÃ¥d som gjÃ¸r det lettere Ã¥ forstÃ¥ kravene rundt etablererprÃ¸ven, skjenkebevilling og salgsbevilling.',
          footerCopyright: 'Innhold for Norge, skrevet pÃ¥ norsk.',
          footerNote: 'BestÃ¥ttgaranti og produktinformasjon finner du pÃ¥ hovedsiden.',
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
          'Kommuneguider for deg som skal søke, drive eller overta serveringssted, butikk eller arrangement med alkohol i Norge.',
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
        nav: [
          { path: '/', label: 'Kommuner' },
          { path: '/arendal', label: 'Arendal' },
          { path: '/bergen', label: 'Bergen' },
          { path: '/lillehammer', label: 'Lillehammer' },
          { path: '/trysil', label: 'Trysil' },
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
          homeEyebrow: 'For salg og servering i Norge',
          homeTitle: 'Finn kommunen din og se hva som gjelder for skjenking, salg, søknad og innsyn.',
          homeDescription:
            'Her finner du kommuner der vi faktisk har kvalitetssikret lokale tider, søknadsspor, innsyn og relevante kommunale kilder for deg som skal jobbe med mat, drikke, servering eller alkoholsalg.',
          directorySearchEyebrow: 'Søk kommune',
          directorySearchTitle: 'Skriv kommunen du jobber mot',
          directorySearchDescription:
            'Søket foreslår bare kommuner som faktisk har en publisert side akkurat nå.',
          directorySearchPlaceholder: 'Begynn å skrive, for eksempel Arendal eller Bjerkreim',
          directorySearchEmpty: 'Ingen publisert kommune matcher søket ennå.',
          homeStats: [],
          homeAsideEyebrow: 'Utvalgte kommuner',
          homeAsideReasonTitle: 'Hva du får her',
          homeAsideReasonText:
            'Hver kommuneside viser lokale tider, nyttige kilder fra kommunen og hva som er viktig å kontrollere før du søker, åpner eller endrer driften.',
          listingEyebrow: 'Kommuner',
          listingTitle: 'Kommuner som er klare til bruk',
          listingDescription: 'Velg kommunen du jobber mot. Hver side er laget for å gi praktisk støtte før søknad, oppstart eller endring i drift.',
          articleContextLabel: 'Kommune',
          articleLanguageBadge: 'PÃ¥ norsk',
          articlePrimaryActionText: 'Les kommunesiden',
          articleNextStepEyebrow: 'Neste steg',
          articleNextStepText: 'Bruk kommunesiden for lokal oversikt, og gÃ¥ deretter videre til riktig guide eller kurs nÃ¥r du trenger forklaring og trening.',
          articleAboutPurpose: 'Gi deg raskere tilgang til riktige lokale kilder fÃ¸r du sÃ¸ker eller endrer drift.',
          footerEyebrow: 'Kurs.ing kommune',
          footerTitle: 'Finn riktige kommunesider fÃ¸r du sÃ¸ker, Ã¥pner eller endrer drift.',
          footerDescription: 'MÃ¥let er Ã¥ gjÃ¸re det lettere Ã¥ finne fram til riktige kommunale kilder fÃ¸r du bruker tid pÃ¥ sÃ¸knad, opplÃ¦ring eller planlegging av drift.',
          footerCopyright: 'Kommunespesifikt innhold for Norge.',
          footerNote: 'Bruk hovedsiden og guideseksjonen nÃ¥r du trenger mer forklaring, eksamentrening eller kurs.',
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
          lighthouse: {
            runs: 1,
            warmupRuns: 0,
          },
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
