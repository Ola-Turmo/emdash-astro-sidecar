import { test, expect } from '@playwright/test';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { getResolvedSiteCopy } from '../site-copy.mjs';
import { getConceptOutputDir, resolveActiveSiteRuntime } from '../site-profiles.mjs';

const runtime = resolveActiveSiteRuntime(process.env);
const resolvedCopy = getResolvedSiteCopy(runtime.siteKey, runtime.conceptKey);
const distPath = join(process.cwd(), getConceptOutputDir(runtime.siteKey, runtime.conceptKey));
const indexPath = join(distPath, 'index.html');

test.describe('Blog Smoke Tests', () => {
  test('active concept dist directory exists and contains index.html', () => {
    expect(existsSync(distPath), `dist directory should exist for ${runtime.siteKey}/${runtime.conceptKey}`).toBe(true);
    expect(existsSync(indexPath), `${indexPath} should exist`).toBe(true);
  });

  test('index.html is valid and contains active site metadata', () => {
    const content = readFileSync(indexPath, 'utf-8');

    expect(content).toContain('<!DOCTYPE html>');
    expect(content).toContain(`<title>${runtime.concept.siteName}</title>`);
    expect(content).toContain(runtime.concept.siteUrl);
    expect(content).toContain(resolvedCopy.description);
  });

  test('index.html has proper meta tags', () => {
    const content = readFileSync(indexPath, 'utf-8');

    expect(content).toContain('<meta charset="UTF-8">');
    expect(content).toContain('<meta name="viewport"');
    expect(content).toContain('og:title');
    expect(content).toContain('og:description');
    expect(content).toContain(`content="${runtime.concept.siteName}"`);
  });

  test('index.html contains expected shell sections for the active concept', () => {
    const content = readFileSync(indexPath, 'utf-8');

    expect(content).toContain('<header');
    expect(content).toContain('<main');
    expect(content).toContain('<footer');
    expect(content).toContain(resolvedCopy.shell.homeTitle);
    expect(content).toContain(resolvedCopy.shell.listingTitle);
    expect(content).toContain(resolvedCopy.shell.footerTitle);
  });
});
