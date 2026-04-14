#!/usr/bin/env node

import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { chromium } from 'playwright';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');

async function loadUrls() {
  const siteConfigModule = await import(pathToFileURL(path.join(repoRoot, 'apps/blog/src/site-config.ts')).href);
  return [...new Set([siteConfigModule.SITE_URL, ...(siteConfigModule.DEPLOY_AUDIT_EXTRA_URLS || [])].filter(Boolean))];
}

function parseArgs(argv) {
  const options = { urls: [] };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--url' && argv[index + 1]) {
      options.urls.push(argv[index + 1]);
      index += 1;
    }
  }
  return options;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const urls = options.urls.length ? options.urls : await loadUrls();
  if (!urls.length) {
    throw new Error('No URLs configured for accessibility checks.');
  }

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({
    viewport: { width: 390, height: 844 },
    locale: 'nb-NO',
  });

  const results = [];
  for (const url of urls) {
    await page.goto(url, { waitUntil: 'networkidle' });
    const analysis = await page.evaluate(() => {
      function isVisible(element) {
        const style = window.getComputedStyle(element);
        if (style.visibility === 'hidden' || style.display === 'none') return false;
        const rect = element.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0;
      }

      function parseColor(value) {
        const match = value.match(/rgba?\(([^)]+)\)/i);
        if (!match) return null;
        const parts = match[1].split(',').map((part) => Number.parseFloat(part.trim()));
        if (parts.length < 3 || parts.some((part) => Number.isNaN(part))) return null;
        return { r: parts[0], g: parts[1], b: parts[2], a: parts[3] ?? 1 };
      }

      function blend(foreground, background) {
        const alpha = foreground.a ?? 1;
        return {
          r: foreground.r * alpha + background.r * (1 - alpha),
          g: foreground.g * alpha + background.g * (1 - alpha),
          b: foreground.b * alpha + background.b * (1 - alpha),
          a: 1,
        };
      }

      function relativeLuminance(color) {
        const channels = [color.r, color.g, color.b].map((channel) => {
          const normalized = channel / 255;
          return normalized <= 0.03928 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4;
        });
        return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
      }

      function contrastRatio(foreground, background) {
        const lighter = Math.max(relativeLuminance(foreground), relativeLuminance(background));
        const darker = Math.min(relativeLuminance(foreground), relativeLuminance(background));
        return Number(((lighter + 0.05) / (darker + 0.05)).toFixed(2));
      }

      function effectiveBackgroundColor(element) {
        let current = element;
        let background = { r: 255, g: 255, b: 255, a: 1 };
        while (current) {
          const style = window.getComputedStyle(current);
          if (style.backgroundImage && style.backgroundImage !== 'none') return null;
          const color = parseColor(style.backgroundColor);
          if (color && color.a > 0) {
            background = blend(color, background);
            if (color.a >= 1) return background;
          }
          current = current.parentElement;
        }
        return background;
      }

      function accessibleNameForControl(control) {
        const ariaLabel = control.getAttribute('aria-label')?.trim();
        if (ariaLabel) return ariaLabel;
        const labelledBy = control.getAttribute('aria-labelledby');
        if (labelledBy) {
          const text = labelledBy
            .split(/\s+/)
            .map((id) => document.getElementById(id)?.textContent?.trim() || '')
            .join(' ')
            .trim();
          if (text) return text;
        }
        if (control.labels?.length) {
          const text = [...control.labels].map((label) => label.textContent?.trim() || '').join(' ').trim();
          if (text) return text;
        }
        const placeholder = control.getAttribute('placeholder')?.trim();
        if (placeholder) return placeholder;
        return '';
      }

      const htmlLang = document.documentElement.getAttribute('lang')?.trim() || '';
      const h1Count = document.querySelectorAll('h1').length;
      const imagesMissingAlt = [...document.images]
        .filter((image) => isVisible(image) && !image.hasAttribute('alt'))
        .map((image) => image.getAttribute('src') || '<unknown>');

      const labelableSelector = 'input:not([type="hidden"]):not([type="submit"]):not([type="button"]):not([type="reset"]),select,textarea';
      const unlabeledControls = [...document.querySelectorAll(labelableSelector)]
        .filter((control) => isVisible(control) && !accessibleNameForControl(control))
        .map((control) => ({
          tag: control.tagName.toLowerCase(),
          type: control.getAttribute('type') || '',
          name: control.getAttribute('name') || '',
          id: control.id || '',
        }));

      const textSelectors = 'p,li,a,button,label,span,h1,h2,h3,h4,h5,h6,input,textarea,select';
      const contrastIssues = [];
      for (const element of document.querySelectorAll(textSelectors)) {
        if (!isVisible(element)) continue;
        const text = (element.textContent || '').replace(/\s+/g, ' ').trim();
        if (!text || text.length < 2) continue;

        const style = window.getComputedStyle(element);
        const foreground = parseColor(style.color);
        const background = effectiveBackgroundColor(element);
        if (!foreground || !background) continue;

        const ratio = contrastRatio(foreground, background);
        const fontSize = Number.parseFloat(style.fontSize || '16');
        const fontWeight = Number.parseInt(style.fontWeight || '400', 10);
        const isLargeText = fontSize >= 24 || (fontSize >= 18.66 && fontWeight >= 700);
        const threshold = isLargeText ? 3 : 4.5;

        if (ratio < threshold) {
          contrastIssues.push({
            text: text.slice(0, 80),
            ratio,
            threshold,
            selector: element.tagName.toLowerCase(),
          });
        }
      }

      const focusableSelector = [
        'a[href]',
        'button:not([disabled])',
        'input:not([disabled]):not([type="hidden"])',
        'select:not([disabled])',
        'textarea:not([disabled])',
        '[tabindex]:not([tabindex="-1"])',
      ].join(',');
      const focusableCount = [...document.querySelectorAll(focusableSelector)].filter((element) => isVisible(element)).length;

      return {
        htmlLang,
        h1Count,
        imagesMissingAlt,
        unlabeledControls,
        contrastIssues: contrastIssues.slice(0, 20),
        focusableCount,
      };
    });

    const keyboardTrace = [];
    for (let index = 0; index < Math.min(6, Math.max(analysis.focusableCount, 1)); index += 1) {
      await page.keyboard.press('Tab');
      await page.waitForTimeout(60);
      const focusState = await page.evaluate(() => {
        const active = document.activeElement;
        if (!active) return '';
        const role = active.getAttribute('role') || active.tagName.toLowerCase();
        const text =
          active.getAttribute('aria-label') ||
          active.textContent?.replace(/\s+/g, ' ').trim() ||
          active.getAttribute('href') ||
          active.id ||
          '';
        return `${role}:${text.slice(0, 60)}`;
      });
      if (focusState) keyboardTrace.push(focusState);
    }

    const uniqueFocusStates = [...new Set(keyboardTrace)];
    const findings = [];
    if (!analysis.htmlLang) findings.push('Missing html[lang]');
    if (analysis.h1Count !== 1) findings.push(`Expected exactly 1 h1, found ${analysis.h1Count}`);
    if (analysis.imagesMissingAlt.length) findings.push(`Images missing alt: ${analysis.imagesMissingAlt.length}`);
    if (analysis.unlabeledControls.length) findings.push(`Unlabeled form controls: ${analysis.unlabeledControls.length}`);
    if (analysis.contrastIssues.length) findings.push(`Contrast issues: ${analysis.contrastIssues.length}`);
    if (analysis.focusableCount > 0 && uniqueFocusStates.length < Math.min(2, analysis.focusableCount)) {
      findings.push('Keyboard tab reachability looks broken or too shallow');
    }

    results.push({
      url,
      lang: analysis.htmlLang || null,
      h1Count: analysis.h1Count,
      focusableCount: analysis.focusableCount,
      keyboardTrace: uniqueFocusStates,
      missingAlt: analysis.imagesMissingAlt,
      unlabeledControls: analysis.unlabeledControls,
      contrastIssues: analysis.contrastIssues,
      findings,
    });
  }

  await browser.close();

  const summary = {
    generatedAt: new Date().toISOString(),
    results,
  };

  console.log(JSON.stringify(summary, null, 2));

  const failures = results.flatMap((result) => result.findings.map((finding) => `${result.url}: ${finding}`));
  if (failures.length) {
    throw new Error(`Accessibility regression gate failed:\n- ${failures.join('\n- ')}`);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack || error.message : String(error));
  process.exit(1);
});
