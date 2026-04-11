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
      routeWorkerName: 'kurs-ing-guide-proxy',
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
          'Kommunespesifikke sider for etablererprøven, skjenkebevilling og salgsbevilling, med samme design som resten av kurs.ing.',
        routes: {
          articlePrefix: '/',
          categoryPrefix: '/tema',
          authorPrefix: '/redaksjon',
        },
        audit: {
          sitemapUrls: ['https://www.kurs.ing/kommune/sitemap.xml'],
          extraUrls: [],
        },
        nav: [
          { path: '/', label: 'Kommuner' },
          { path: '/tema/etablererproven', label: 'Etablererprøven' },
          { path: '/tema/skjenkebevilling', label: 'Skjenkebevilling' },
          { path: '/tema/salgsbevilling', label: 'Salgsbevilling' },
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
          homeEyebrow: 'Planlagt konsept',
          homeTitle: 'Kommunesider med samme design, men egen struktur.',
          homeDescription:
            'Dette konseptet er klargjort for kommunespesifikke sider som kurs.ing/kommune/oslo. Innhold og templates kommer senere.',
          homeStats: [],
          homeAsideEyebrow: 'Neste steg',
          homeAsideReasonTitle: 'Hva som mangler',
          homeAsideReasonText:
            'Konseptet trenger eget innhold, egne routes og en kommuneorientert pagemal før det kan publiseres.',
          listingEyebrow: 'Kommuner',
          listingTitle: 'Kommunesider kommer her',
          listingDescription: 'Dette konseptet er skilt ut i config, men er ikke publisert ennå.',
          articleContextLabel: 'Kommune',
          articleLanguageBadge: 'På norsk',
          articlePrimaryActionText: 'Les side',
          articleNextStepEyebrow: 'Neste steg',
          articleNextStepText: 'Legg inn kommunespesifikt innhold og aktiver egne routes for dette konseptet.',
          articleAboutPurpose: 'Gi lokale sider en egen informasjonsstruktur uten å blande dem med guide-bloggen.',
          footerEyebrow: 'Kurs.ing kommune',
          footerTitle: 'Kommunespesifikk informasjon med samme design og egen innholdsmodell.',
          footerDescription: 'Dette konseptet er forberedt, men trenger eget innhold før det tas i bruk.',
          footerCopyright: 'Planlagt kommuneinnhold for Norge.',
          footerNote: 'Publiseres når kommunesidene er klare.',
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
      routeWorkerName: 'gatareba-guide-proxy',
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
