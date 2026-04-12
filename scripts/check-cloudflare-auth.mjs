#!/usr/bin/env node

import { detectCloudflareAuth } from './cloudflare-auth.mjs';

const requirePages = process.argv.includes('--require-pages');

try {
  const result = detectCloudflareAuth({ requirePages });
  console.log(JSON.stringify(result, null, 2));
} catch (error) {
  const details = {
    ok: false,
    error: error instanceof Error ? error.message : String(error),
  };
  console.log(JSON.stringify(details, null, 2));
  process.exitCode = 1;
}
