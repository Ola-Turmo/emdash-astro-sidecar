#!/usr/bin/env node

import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');

function parseArgs(argv) {
  const options = {
    siteKey: '',
    domain: '',
    locale: 'en-US',
    conceptKey: 'guide',
    supportEmail: 'support@example.com',
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--site-key' && argv[index + 1]) options.siteKey = argv[++index];
    else if (arg === '--domain' && argv[index + 1]) options.domain = argv[++index];
    else if (arg === '--locale' && argv[index + 1]) options.locale = argv[++index];
    else if (arg === '--concept-key' && argv[index + 1]) options.conceptKey = argv[++index];
    else if (arg === '--support-email' && argv[index + 1]) options.supportEmail = argv[++index];
  }

  if (!options.siteKey || !options.domain) {
    throw new Error('Usage: pnpm onboard:site -- --site-key <key> --domain <https://example.com> [--locale nb-NO] [--concept-key guide] [--support-email support@example.com]');
  }

  return options;
}

function toWordmark(domain) {
  return new URL(domain).hostname.replace(/^www\./, '');
}

function capitalize(value) {
  return value
    .split(/[-_]/)
    .filter(Boolean)
    .map((part) => part[0].toUpperCase() + part.slice(1))
    .join(' ');
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  const outputDir = path.join(repoRoot, 'output', 'site-onboarding', options.siteKey);
  mkdirSync(outputDir, { recursive: true });

  const siteName = capitalize(options.siteKey);
  const wordmark = toWordmark(options.domain);
  const snippet = `// apps/blog/site-profiles.mjs\n'${options.siteKey}': {\n  key: '${options.siteKey}',\n  brand: {\n    mainSiteName: '${siteName}',\n    wordmark: '${wordmark}',\n    mainSiteUrl: '${options.domain}',\n    locale: '${options.locale}',\n    supportEmail: '${options.supportEmail}',\n    defaultOgImagePath: '/images/og-default.png',\n    logoMark: '${wordmark[0] || 's'}',\n  },\n  cloudflare: {\n    pagesProject: '${options.siteKey}-static',\n    pagesPreviewAlias: 'main.${options.siteKey}-static.pages.dev',\n  },\n  telemetry: {\n    rumEndpoint: '',\n    metricsWorkerUrl: 'https://emdash-metrics-worker.ola-turmo.workers.dev',\n  },\n  rootRouting: {\n    rootOrigin: '${options.domain}',\n    requiredMarkers: [],\n    forbiddenMarkers: [],\n    exactBypassPaths: ['/robots.txt', '/sitemap.xml', '/sitemap-index.xml'],\n  },\n  courseLinkSetKey: '${options.siteKey}',\n  concepts: {\n    ${options.conceptKey}: {\n      key: '${options.conceptKey}',\n      label: '${capitalize(options.conceptKey)}',\n      pageStructure: 'blog',\n      basePath: '/${options.conceptKey}',\n      siteUrl: '${options.domain}/${options.conceptKey}',\n      siteName: '${siteName} ${capitalize(options.conceptKey)}',\n      shellKey: '${options.siteKey}/${options.conceptKey}',\n      routes: {\n        articlePrefix: '/blog',\n        categoryPrefix: '/category',\n        authorPrefix: '/author',\n      },\n      cloudflare: {\n        pagesProject: '${options.siteKey}-static',\n        pagesPreviewAlias: 'main.${options.siteKey}-static.pages.dev',\n        routeWorkerName: '${options.siteKey}-${options.conceptKey}-proxy',\n        routeWorkerDirectory: 'guide-proxy',\n      },\n      audit: {\n        sitemapUrls: ['${options.domain}/${options.conceptKey}/sitemap.xml'],\n        extraUrls: [],\n        lighthouse: { runs: 1, warmupRuns: 0 },\n      },\n      quality: {\n        dashboardLabel: '${siteName} ${capitalize(options.conceptKey)}',\n        flagshipUrls: ['${options.domain}/${options.conceptKey}/'],\n      },\n    },\n  },\n},\n`;

  const copySnippet = `// apps/blog/site-copy.mjs\n'${options.siteKey}': {\n  courseLinks: [],\n  concepts: {\n    ${options.conceptKey}: {\n      description: 'Replace with real brand copy before launch.',\n      nav: [{ path: '/', label: 'Articles' }],\n      callsToAction: {\n        primary: { href: '${options.domain}', label: 'Go to site' },\n        secondary: { href: 'mailto:${options.supportEmail}', label: 'Contact' },\n      },\n      shell: {\n        subLabel: '${capitalize(options.conceptKey)}',\n        homeEyebrow: 'Replace before launch',\n        homeTitle: 'Add real copy for ${siteName}.',\n        homeDescription: 'Use this scaffold as a starting point only.',\n        homeStats: [],\n        homeAsideEyebrow: 'Scaffold',\n        homeAsideReasonTitle: 'Needs brand-specific content',\n        homeAsideReasonText: 'Replace every placeholder before publishing.',\n        listingEyebrow: 'Articles',\n        listingTitle: 'Replace with real information',\n        listingDescription: 'This scaffold is not production content.',\n        listingEmptyText: 'No content published yet.',\n        articleContextLabel: '${capitalize(options.conceptKey)}',\n        articleLanguageBadge: 'Localized',\n        articlePrimaryActionText: 'Read article',\n        articleNextStepEyebrow: 'Next step',\n        articleNextStepText: 'Replace the scaffold copy and CTA targets.',\n        articleAboutPurpose: 'Demonstrates onboarding structure only.',\n        footerEyebrow: '${siteName}',\n        footerTitle: 'Replace scaffold footer copy.',\n        footerDescription: 'Add real copy, links, and support details.',\n        footerOffersLabel: 'Offers',\n        footerTechnicalLabel: 'Technical',\n        footerContactLabel: 'Contact',\n        footerCopyright: 'Example scaffold only.',\n        footerNote: 'Do not publish without replacing placeholders.',\n        contentMeta: {\n          authorEyebrow: 'Author',\n          articleListingTitle: 'Articles',\n          authorEmptyText: 'No articles yet.',\n          categoryEyebrow: 'Category',\n          categoryEmptyText: 'No category content yet.',\n          articleMetaEyebrow: 'About this article',\n          articleMetaCategoryLabel: 'Category',\n          articleMetaAuthorLabel: 'Author',\n          articleMetaPurposeLabel: 'Purpose',\n        },\n      },\n    },\n  },\n},\n`;

  const checklist = `# ${siteName} onboarding checklist\n\n- [ ] Add the site-profile snippet to \`apps/blog/site-profiles.mjs\`\n- [ ] Add the site-copy snippet to \`apps/blog/site-copy.mjs\`\n- [ ] Update CTA targets, categories, and support email\n- [ ] Create Cloudflare Pages project and route worker bindings\n- [ ] Configure telemetry endpoints and flagship URLs\n- [ ] Run \`EMDASH_SITE_KEY=${options.siteKey} EMDASH_CONCEPT_KEY=${options.conceptKey} pnpm --filter @emdash/blog build\`\n- [ ] Run \`pnpm report:release -- --refresh\` for the new site scope\n`;

  writeFileSync(path.join(outputDir, 'site-profile.snippet.mjs'), snippet);
  writeFileSync(path.join(outputDir, 'site-copy.snippet.mjs'), copySnippet);
  writeFileSync(path.join(outputDir, 'CHECKLIST.md'), checklist);

  console.log(`Site-onboarding scaffold written to ${outputDir}`);
}

main();
