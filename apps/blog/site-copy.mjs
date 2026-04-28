const bannedShellPhrases = [
  'same design',
  'local content model',
  'content model',
  'innholdsmodell',
  'guidebloggen',
  'same shell',
  'kommunale lenker',
  'structured dataset',
  'structured data source',
  'content wave',
  'sidecar',
];

const mojibakePatterns = [
  /Ãƒ./u,
  /ÃÂ/u,
  /Ã¢â/u,
  /Ã[0-9A-Za-zæøåÆØÅ]/u,
];

const riskyFactPatterns = [
  /\b\d{1,2}[:.]\d{2}\b/u,
  /\b\d+\s?%/u,
  /\b\d{4}\b/u,
  /\ball(e)? kommuner\b/iu,
  /\bgaranti\b/iu,
  /\balltid\b/iu,
];

const shellStopwords = new Set([
  'and',
  'are',
  'before',
  'det',
  'den',
  'der',
  'din',
  'eller',
  'for',
  'fra',
  'før',
  'guide',
  'how',
  'hva',
  'hvor',
  'hvis',
  'i',
  'in',
  'is',
  'it',
  'jobber',
  'kommune',
  'kommunen',
  'kommuner',
  'kurs',
  'kurset',
  'more',
  'mot',
  'norway',
  'norge',
  'og',
  'på',
  'read',
  'right',
  'site',
  'som',
  'that',
  'the',
  'this',
  'til',
  'to',
  'use',
  'vil',
]);

const siteCopyRegistry = {
  'kurs-ing': {
    courseLinks: [
      {
        path: '/etablererproven',
        label: 'Kurs for etablererprøven',
        description: 'Pensum, forklaringer og oppgaver for deg som skal bestå prøven.',
        quality: {
          mode: 'keyword',
          expectedHost: 'www.kurs.ing',
          requiredKeywords: ['etablererprøven', 'pensum', 'kurs'],
        },
      },
      {
        path: '/skjenkebevilling',
        label: 'Kurs for skjenkebevilling',
        description: 'Forklaringer og trening for styrer og stedfortreder i serveringsbransjen.',
        quality: {
          mode: 'keyword',
          expectedHost: 'www.kurs.ing',
          requiredKeywords: ['skjenkebevilling', 'styrer', 'stedfortreder'],
        },
      },
      {
        path: '/salgsbevilling',
        label: 'Kurs for salgsbevilling',
        description: 'For butikker og utsalgssteder som skal søke eller drive med salg av alkohol.',
        quality: {
          mode: 'keyword',
          expectedHost: 'www.kurs.ing',
          requiredKeywords: ['salgsbevilling', 'salg', 'alkohol'],
        },
      },
    ],
    concepts: {
      guide: {
        description:
          'Forklaringer om etablererprøven, skjenkebevilling og salgsbevilling for deg som vil forstå kravene og velge riktig kurs.',
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
            quality: {
              mode: 'destination',
              expectedHost: 'www.kurs.ing',
              pathIncludes: '/kasse.html',
            },
          },
          secondary: {
            href: 'https://www.kurs.ing',
            label: 'Til hovedsiden',
            quality: {
              mode: 'destination',
              expectedHost: 'www.kurs.ing',
              pathIncludes: '/',
            },
          },
        },
        shell: {
          subLabel: 'Guide',
          homeEyebrow: 'For deg som jobber med mat, drikke og servering',
          homeTitle: 'Forstå kravene før du søker, åpner eller går opp til prøve.',
          homeDescription:
            'Her finner du forklaringer som gjør det lettere å skjønne hva du må kunne om etablererprøven, skjenkebevilling og salgsbevilling før du velger kurs.',
          homeStats: [],
          homeAsideEyebrow: 'Start riktig',
          homeAsideReasonTitle: 'Derfor finnes disse guidene',
          homeAsideReasonText:
            'Bruk guidene til å forstå kravene raskere, og gå videre til riktig kurs når du trenger pensum, oppgaver og mer trening.',
          listingEyebrow: 'Guider',
          listingTitle: 'Vanlige spørsmål før prøve, søknad og drift',
          listingDescription:
            'Velg en guide som forklarer pensum, ansvar og vanlige feil på en måte som er nyttig i praktisk drift.',
          listingEmptyText: 'Ingen guider er publisert ennå.',
          articleContextLabel: 'Guide',
          articleLanguageBadge: 'På norsk',
          articlePrimaryActionText: 'Les guiden',
          articleNextStepEyebrow: 'Neste steg',
          articleNextStepText:
            'Når du vet hva du trenger, kan du gå videre til kurset som passer situasjonen din best.',
          articleAboutPurpose: 'Hjelper deg å forstå kravene før du velger kurs eller går opp til prøve.',
          footerEyebrow: 'Kurs.ing Guide',
          footerTitle: 'Bruk guidene til å finne riktig vei før du bruker tid på feil kurs eller feil søknad.',
          footerDescription:
            'Alt her er skrevet for folk som skal jobbe med servering, mat eller alkoholsalg i Norge og trenger klare forklaringer før neste steg.',
          footerOffersLabel: 'Kurs',
          footerTechnicalLabel: 'Teknisk',
          footerContactLabel: 'Kontakt',
          footerCopyright: 'Innhold skrevet for bruk i Norge.',
          footerNote: 'Gå til hovedsiden når du vil kjøpe kurs eller se hele tilbudet.',
          contentMeta: {
            authorEyebrow: 'Forfatter',
            articleListingTitle: 'Artikler',
            authorEmptyText: 'Ingen artikler fra denne forfatteren ennå.',
            categoryEyebrow: 'Kategori',
            categoryEmptyText: 'Ingen artikler i denne kategorien ennå.',
            articleMetaEyebrow: 'Om artikkelen',
            articleMetaCategoryLabel: 'Kategori',
            articleMetaAuthorLabel: 'Forfatter',
            articleMetaPurposeLabel: 'Formål',
          },
        },
      },
      kommune: {
        description:
          'Kommunesider for deg som skal søke, drive eller endre servering, salg eller arrangement med alkohol i Norge.',
        nav: [{ path: '/', label: 'Kommuner' }],
        callsToAction: {
          primary: {
            href: 'https://www.kurs.ing/kasse.html',
            label: 'Se kurspakken',
            quality: {
              mode: 'destination',
              expectedHost: 'www.kurs.ing',
              pathIncludes: '/kasse.html',
            },
          },
          secondary: {
            href: 'https://www.kurs.ing',
            label: 'Til kurs.ing',
            quality: {
              mode: 'destination',
              expectedHost: 'www.kurs.ing',
              pathIncludes: '/',
            },
          },
        },
        shell: {
          subLabel: 'Kommune',
          homeEyebrow: 'For salg, servering og skjenking i Norge',
          homeTitle: 'Finn kommunen din og se hva som faktisk gjelder før du søker eller endrer drift.',
          homeDescription:
            'Her finner du bare kommuner der vi har nok kvalitetssikret informasjon til å vise lokale tider, relevante kilder og praktiske kontrollpunkter for arbeid med alkohol og servering.',
          directorySearchEyebrow: 'Søk kommune',
          directorySearchTitle: 'Skriv kommunen du jobber mot',
          directorySearchDescription:
            'Søket foreslår bare kommuner som faktisk har en publisert side akkurat nå.',
          directorySearchPlaceholder: 'Begynn å skrive, for eksempel Arendal eller Bjerkreim',
          directorySearchEmpty: 'Ingen publisert kommune matcher søket ennå.',
          directorySearchAriaLabel: 'Søk etter publisert kommune',
          directorySearchActionLabel: 'Åpne',
          directorySearchMetaFallback: 'Kommune',
          homeStats: [],
          homeAsideEyebrow: 'Utvalgte kommuner',
          homeAsideReasonTitle: 'Dette får du på hver side',
          homeAsideReasonText:
            'Hver kommuneside viser lokale tider, nyttige kommunale kilder og hva du bør kontrollere før du søker, åpner eller gjør endringer i driften.',
          listingEyebrow: 'Kommuner',
          listingTitle: 'Kommuner som er klare til bruk',
          listingDescription:
            'Velg kommunen du jobber mot. Hver side er laget for å hjelpe deg fram til riktige lokale regler og riktige kommunale sider.',
          listingEmptyText: 'Ingen kommunesider er publisert ennå.',
          articleContextLabel: 'Kommune',
          articleLanguageBadge: 'På norsk',
          articlePrimaryActionText: 'Les kommunesiden',
          articleNextStepEyebrow: 'Neste steg',
          articleNextStepText:
            'Bruk kommunesiden til lokal avklaring, og gå videre til guide eller kurs når du trenger mer forklaring og trening.',
          articleAboutPurpose: 'Hjelper deg å finne riktige lokale kilder før du søker eller endrer drift.',
          footerEyebrow: 'Kurs.ing Kommune',
          footerTitle: 'Finn riktige kommunesider før du søker, åpner eller endrer drift.',
          footerDescription:
            'Målet er å gjøre det lettere å finne fram til riktige kommunale kilder før du bruker tid på søknad, opplæring eller planlegging av drift.',
          footerOffersLabel: 'Kurs',
          footerTechnicalLabel: 'Teknisk',
          footerContactLabel: 'Kontakt',
          footerCopyright: 'Kommunespesifikt innhold for Norge.',
          footerNote: 'Bruk hovedsiden og guidene når du trenger mer forklaring, trening eller kurs.',
          contentMeta: {
            authorEyebrow: 'Forfatter',
            articleListingTitle: 'Artikler',
            authorEmptyText: 'Ingen artikler fra denne forfatteren ennå.',
            categoryEyebrow: 'Kategori',
            categoryEmptyText: 'Ingen artikler i denne kategorien ennå.',
            articleMetaEyebrow: 'Om artikkelen',
            articleMetaCategoryLabel: 'Kategori',
            articleMetaAuthorLabel: 'Forfatter',
            articleMetaPurposeLabel: 'Formål',
          },
          directoryCard: {
            metaFallback: 'Kommune',
            municipalityNumberLabel: 'Kommunenummer',
            publicRecordsLabel: 'Innsyn',
            websiteLabel: 'Nettside',
          },
          municipalityPage: {
            timelineEyebrow: 'Tidslinje for lokale alkoholregler',
            salesEyebrow: 'Salg av alkohol',
            highlightsEyebrowTemplate: 'Dette skiller {municipality} fra andre kommuner',
            curatedLinksEyebrow: 'Kommunale sider du bør åpne først',
            curatedLinksActionLabel: 'Åpne kommunesiden',
            checklistEyebrow: 'Dette bør du gjøre før du søker eller åpner',
            usefulSourcesEyebrow: 'Offisielle kilder med nyttig lokal forklaring',
            usefulSourcesActionLabel: 'Åpne kilden',
            summaryEyebrow: 'Kort oppsummert',
            summaryMunicipalityLabel: 'Kommune',
            summaryCountyLabel: 'Fylke',
            summarySiteUpdatedLabel: 'Sist oppdatert nettsted',
            relatedGuidesEyebrow: 'Les mer på kurs.ing',
            sourcesEyebrow: 'Kilder og kontrollpunkter',
            sourceRepoLabel: 'Kilde',
            sourceLastCheckedLabel: 'Sist kontrollert',
            sourceSiteLabel: 'Kommunenettsted',
            sourceFormsLabel: 'Skjema',
            sourcePublicRecordsLabel: 'Innsyn',
            sourcePolicyLabel: 'Plan eller tider',
            sourcePlatformLabel: 'Nettstedsplattform',
            sourceDomainLabel: 'Domene',
            sourceLanguageLabel: 'Målform',
          },
        },
      },
    },
  },
  'gatareba-ge': {
    courseLinks: [],
    concepts: {
      guide: {
        description:
          'Example profile for an unrelated domain. Replace all copy, navigation, links, and quality rules before launch.',
        nav: [{ path: '/', label: 'Articles' }],
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
          homeEyebrow: 'Scaffold only',
          homeTitle: 'Replace this profile with real copy before you publish a new site.',
          homeDescription:
            'This profile exists only to prove that the repo can separate unrelated sites cleanly. It should not be shipped as-is.',
          homeStats: [],
          homeAsideEyebrow: 'Important',
          homeAsideReasonTitle: 'This is only a scaffold',
          homeAsideReasonText:
            'Replace all text, links, and quality rules with real brand-specific content before launch.',
          listingEyebrow: 'Articles',
          listingTitle: 'Replace with real content',
          listingDescription: 'Use this concept only after all copy, links, and routing have been rewritten.',
          listingEmptyText: 'No content is published yet.',
          articleContextLabel: 'Guide',
          articleLanguageBadge: 'Localized',
          articlePrimaryActionText: 'Read article',
          articleNextStepEyebrow: 'Next step',
          articleNextStepText: 'Replace all content and actions before deploying the site.',
          articleAboutPurpose: 'Demonstrates clean site separation.',
          footerEyebrow: 'Guide',
          footerTitle: 'Replace this scaffold with real product copy.',
          footerDescription:
            'This profile shows how unrelated domains can share code without sharing user-facing content.',
          footerOffersLabel: 'Offers',
          footerTechnicalLabel: 'Technical',
          footerContactLabel: 'Contact',
          footerCopyright: 'Example profile only.',
          footerNote: 'Replace before launch.',
          contentMeta: {
            authorEyebrow: 'Author',
            articleListingTitle: 'Articles',
            authorEmptyText: 'No articles from this author yet.',
            categoryEyebrow: 'Category',
            categoryEmptyText: 'No articles in this category yet.',
            articleMetaEyebrow: 'About this article',
            articleMetaCategoryLabel: 'Category',
            articleMetaAuthorLabel: 'Author',
            articleMetaPurposeLabel: 'Purpose',
          },
        },
      },
    },
  },
  'emdash-no': {
    courseLinks: [],
    concepts: {
      sidecar: {
        description:
          'EmDash mounts a visibility and answer-engine growth layer on top of your existing converting site — no rebuild, no new CMS, no content migration.',
        nav: [
          { path: '/', label: 'Home' },
          { path: '/posts', label: 'How it works' },
          { path: '/contact', label: 'Contact' },
        ],
        callsToAction: {
          primary: {
            href: 'mailto:ola@emdash.no?subject=Demo%20request%20%E2%80%94%20EmDash%20Sidecar',
            label: 'Request a demo',
          },
          secondary: {
            href: '/posts',
            label: 'See how it works',
          },
        },
        shell: {
          subLabel: 'SaaS',
          homeEyebrow: 'For growing companies that want to be found',
          homeTitle: 'Launch a search-growth layer on top of your existing site — without rebuilding the pages that already make money.',
          homeDescription:
            'EmDash mounts structured guide pages, FAQ schema, and answer-engine markup directly on your domain. No new CMS. No content migration. No rebuild. Just a layer that compounds your visibility in AI search and Google.',
          homeStats: [
            {
              value: '€299',
              label: 'per month, per domain — no setup fee',
            },
            {
              value: '< 1 week',
              label: 'to first guide page live on your domain',
            },
            {
              value: '95+',
              label: 'Lighthouse score target on mounted pages',
            },
          ],
          homeAsideEyebrow: 'Start with one domain',
          homeAsideReasonTitle: 'Why this works for regulated SMBs',
          homeAsideReasonText:
            'Companies in alcohol, pharmacy, finance and healthcare have thin content layers on converting sites. EmDash fills that gap with structured pages that AI search engines and answer engines can read, cite, and surface.',
          listingEyebrow: 'What you get',
          listingTitle: 'From placeholder to proof-of-visibility in one mount.',
          listingDescription:
            'Every mounted guide page comes with Lighthouse reports, RUM telemetry, and a live dashboard so you can see exactly what your visibility looks like before and after.',
          listingEmptyText: 'Mount your first guide page to get started.',
          articleContextLabel: 'Guide',
          articleLanguageBadge: 'English',
          articlePrimaryActionText: 'Read the guide',
          articleNextStepEyebrow: 'Next step',
          articleNextStepText: 'Request a demo to see how EmDash mounts on your domain.',
          articleAboutPurpose: 'Explains how EmDash builds visibility without rebuilding your site.',
          footerEyebrow: 'EmDash',
          footerTitle: 'Grow your search visibility without rebuilding what already works.',
          footerDescription:
            'EmDash mounts a structured content layer on your converting domain. No new CMS, no content migration, no downtime. One domain at a time.',
          footerOffersLabel: 'Product',
          footerTechnicalLabel: 'Platform',
          footerContactLabel: 'Contact',
          footerCopyright: 'All rights reserved.',
          footerNote: 'Mount your first domain and see your Lighthouse score in days.',
          contentMeta: {
            authorEyebrow: 'Author',
            articleListingTitle: 'Guides',
            authorEmptyText: 'No articles from this author yet.',
            categoryEyebrow: 'Category',
            categoryEmptyText: 'No articles in this category yet.',
            articleMetaEyebrow: 'About this guide',
            articleMetaCategoryLabel: 'Category',
            articleMetaAuthorLabel: 'Author',
            articleMetaPurposeLabel: 'Purpose',
          },
        },
      },
    },
  },
};

export function getResolvedSiteCopy(siteKey, conceptKey) {
  const siteCopy = siteCopyRegistry[siteKey];
  if (!siteCopy) {
    throw new Error(`Missing site copy for ${siteKey}`);
  }

  const conceptCopy = siteCopy.concepts?.[conceptKey];
  if (!conceptCopy) {
    throw new Error(`Missing concept copy for ${siteKey}/${conceptKey}`);
  }

  validateCourseLinks(siteKey, siteCopy.courseLinks);
  validateConceptCopy(siteKey, conceptKey, conceptCopy);

  return {
    courseLinks: siteCopy.courseLinks,
    description: conceptCopy.description,
    nav: conceptCopy.nav,
    callsToAction: conceptCopy.callsToAction,
    shell: conceptCopy.shell,
  };
}

export function getShellQualityFixtures() {
  return {
    bannedShellPhrases,
    mojibakePatterns,
    riskyFactPatterns,
    shellStopwords,
  };
}

function validateCourseLinks(siteKey, courseLinks) {
  if (!Array.isArray(courseLinks)) {
    throw new Error(`courseLinks must be an array for ${siteKey}`);
  }

  for (const link of courseLinks) {
    requireString(link.path, `${siteKey}.courseLinks[].path`);
    requireString(link.label, `${siteKey}.courseLinks[].label`);
    requireString(link.description, `${siteKey}.courseLinks[].description`);
    assertCopySafe(link.label, `${siteKey}.courseLinks[].label`, { allowFacts: true });
    assertCopySafe(link.description, `${siteKey}.courseLinks[].description`, { allowFacts: false });
    validateLinkQuality(link.quality, `${siteKey}.courseLinks[].quality`);
  }
}

function validateConceptCopy(siteKey, conceptKey, conceptCopy) {
  requireString(conceptCopy.description, `${siteKey}/${conceptKey}.description`);
  assertCopySafe(conceptCopy.description, `${siteKey}/${conceptKey}.description`, { allowFacts: false });

  if (!Array.isArray(conceptCopy.nav)) {
    throw new Error(`${siteKey}/${conceptKey}.nav must be an array`);
  }
  for (const item of conceptCopy.nav) {
    requireString(item.path, `${siteKey}/${conceptKey}.nav[].path`);
    requireString(item.label, `${siteKey}/${conceptKey}.nav[].label`);
    assertCopySafe(item.label, `${siteKey}/${conceptKey}.nav[].label`, { allowFacts: true });
  }

  for (const [ctaName, cta] of Object.entries(conceptCopy.callsToAction || {})) {
    requireString(cta?.href, `${siteKey}/${conceptKey}.callsToAction.${ctaName}.href`);
    requireString(cta?.label, `${siteKey}/${conceptKey}.callsToAction.${ctaName}.label`);
    assertCopySafe(cta.label, `${siteKey}/${conceptKey}.callsToAction.${ctaName}.label`, { allowFacts: true });
    validateLinkQuality(cta.quality, `${siteKey}/${conceptKey}.callsToAction.${ctaName}.quality`);
  }

  validateShell(siteKey, conceptKey, conceptCopy.shell);
}

function validateShell(siteKey, conceptKey, shell) {
  if (!shell || typeof shell !== 'object') {
    throw new Error(`${siteKey}/${conceptKey}.shell must be an object`);
  }

  const requiredStringFields = [
    'subLabel',
    'homeEyebrow',
    'homeTitle',
    'homeDescription',
    'homeAsideEyebrow',
    'homeAsideReasonTitle',
    'homeAsideReasonText',
    'listingEyebrow',
    'listingTitle',
    'listingDescription',
    'listingEmptyText',
    'articleContextLabel',
    'articleLanguageBadge',
    'articlePrimaryActionText',
    'articleNextStepEyebrow',
    'articleNextStepText',
    'articleAboutPurpose',
    'footerEyebrow',
    'footerTitle',
    'footerDescription',
    'footerOffersLabel',
    'footerTechnicalLabel',
    'footerContactLabel',
    'footerCopyright',
    'footerNote',
  ];

  for (const field of requiredStringFields) {
    requireString(shell[field], `${siteKey}/${conceptKey}.shell.${field}`);
    assertCopySafe(shell[field], `${siteKey}/${conceptKey}.shell.${field}`, { allowFacts: false });
  }

  const optionalFields = [
    'directorySearchEyebrow',
    'directorySearchTitle',
    'directorySearchDescription',
    'directorySearchPlaceholder',
    'directorySearchEmpty',
    'directorySearchAriaLabel',
    'directorySearchActionLabel',
    'directorySearchMetaFallback',
  ];
  for (const field of optionalFields) {
    if (shell[field] == null) continue;
    requireString(shell[field], `${siteKey}/${conceptKey}.shell.${field}`);
    assertCopySafe(shell[field], `${siteKey}/${conceptKey}.shell.${field}`, { allowFacts: false });
  }

  if (!Array.isArray(shell.homeStats)) {
    throw new Error(`${siteKey}/${conceptKey}.shell.homeStats must be an array`);
  }

  for (const stat of shell.homeStats) {
    requireString(stat.value, `${siteKey}/${conceptKey}.shell.homeStats[].value`);
    requireString(stat.label, `${siteKey}/${conceptKey}.shell.homeStats[].label`);
    assertCopySafe(stat.label, `${siteKey}/${conceptKey}.shell.homeStats[].label`, { allowFacts: true });
  }

  validateNestedShellSection(shell.contentMeta, [
    'authorEyebrow',
    'articleListingTitle',
    'authorEmptyText',
    'categoryEyebrow',
    'categoryEmptyText',
    'articleMetaEyebrow',
    'articleMetaCategoryLabel',
    'articleMetaAuthorLabel',
    'articleMetaPurposeLabel',
  ], `${siteKey}/${conceptKey}.shell.contentMeta`);

  if (shell.directoryCard != null) {
    validateNestedShellSection(shell.directoryCard, [
      'metaFallback',
      'municipalityNumberLabel',
      'publicRecordsLabel',
      'websiteLabel',
    ], `${siteKey}/${conceptKey}.shell.directoryCard`);
  }

  if (shell.municipalityPage != null) {
    validateNestedShellSection(shell.municipalityPage, [
      'timelineEyebrow',
      'salesEyebrow',
      'highlightsEyebrowTemplate',
      'curatedLinksEyebrow',
      'curatedLinksActionLabel',
      'checklistEyebrow',
      'usefulSourcesEyebrow',
      'usefulSourcesActionLabel',
      'summaryEyebrow',
      'summaryMunicipalityLabel',
      'summaryCountyLabel',
      'summarySiteUpdatedLabel',
      'relatedGuidesEyebrow',
      'sourcesEyebrow',
      'sourceRepoLabel',
      'sourceLastCheckedLabel',
      'sourceSiteLabel',
      'sourceFormsLabel',
      'sourcePublicRecordsLabel',
      'sourcePolicyLabel',
      'sourcePlatformLabel',
      'sourceDomainLabel',
      'sourceLanguageLabel',
    ], `${siteKey}/${conceptKey}.shell.municipalityPage`);
  }
}

function validateNestedShellSection(section, fields, labelPrefix) {
  if (!section || typeof section !== 'object') {
    throw new Error(`${labelPrefix} must be an object`);
  }

  for (const field of fields) {
    requireString(section[field], `${labelPrefix}.${field}`);
    assertCopySafe(section[field], `${labelPrefix}.${field}`, { allowFacts: false });
  }
}

function validateLinkQuality(quality, label) {
  if (quality == null) return;
  if (typeof quality !== 'object') {
    throw new Error(`${label} must be an object`);
  }

  const mode = quality.mode;
  if (!['keyword', 'destination'].includes(mode)) {
    throw new Error(`${label}.mode must be "keyword" or "destination"`);
  }

  if (quality.expectedHost != null) {
    requireString(quality.expectedHost, `${label}.expectedHost`);
  }
  if (quality.pathIncludes != null) {
    requireString(quality.pathIncludes, `${label}.pathIncludes`);
  }
  if (quality.requiredKeywords != null) {
    if (!Array.isArray(quality.requiredKeywords) || quality.requiredKeywords.length === 0) {
      throw new Error(`${label}.requiredKeywords must be a non-empty array when provided`);
    }
    for (const keyword of quality.requiredKeywords) {
      requireString(keyword, `${label}.requiredKeywords[]`);
      assertCopySafe(keyword, `${label}.requiredKeywords[]`, { allowFacts: true });
    }
  }
}

function requireString(value, label) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`${label} must be a non-empty string`);
  }
}

function assertCopySafe(value, label, { allowFacts }) {
  const text = String(value ?? '');

  for (const pattern of mojibakePatterns) {
    if (pattern.test(text)) {
      throw new Error(`${label} contains mojibake or broken encoding`);
    }
  }

  const lower = text.toLowerCase();
  for (const phrase of bannedShellPhrases) {
    if (lower.includes(phrase.toLowerCase())) {
      throw new Error(`${label} contains banned internal/system phrase "${phrase}"`);
    }
  }

  if (!allowFacts) {
    for (const pattern of riskyFactPatterns) {
      if (pattern.test(text)) {
        throw new Error(`${label} contains a factual claim pattern that should not live in generic shell copy`);
      }
    }
  }
}
