#!/usr/bin/env node

import {
  ACTIVE_CONCEPT_KEY,
  ACTIVE_SITE_KEY,
  DEPLOY_AUDIT_EXTRA_URLS,
  METRICS_WORKER_URL,
  SITE_URL,
} from '../apps/blog/src/site-config.ts';

async function main() {
  if (!METRICS_WORKER_URL) {
    throw new Error('No METRICS_WORKER_URL configured for the active site profile.');
  }

  const payload = {
    siteKey: ACTIVE_SITE_KEY,
    conceptKey: ACTIVE_CONCEPT_KEY,
    siteUrl: SITE_URL,
    urls: DEPLOY_AUDIT_EXTRA_URLS,
    formFactors: ['PHONE', 'DESKTOP', 'ALL_FORM_FACTORS'],
  };

  const response = await fetch(`${METRICS_WORKER_URL}/crux/ingest`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  const text = await response.text();
  if (!response.ok) {
    throw new Error(`CrUX ingest failed (${response.status}): ${text}`);
  }

  console.log(text);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack || error.message : String(error));
  process.exit(1);
});
