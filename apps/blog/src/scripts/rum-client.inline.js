(function () {
  const config = globalThis.__EMDASH_RUM__;
  if (!config || typeof window === 'undefined' || typeof PerformanceObserver === 'undefined') {
    return;
  }

  const collected = new Map();
  let hasFlushed = false;
  const sessionId =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `session-${Date.now()}`;
  const AUTO_FLUSH_MS = 8000;

  const pagePath = window.location.pathname;
  if (!pagePath.startsWith(config.basePath)) {
    return;
  }

  observeFcp();
  observeLcp();
  observeCls();
  observeInp();
  observeTtfb();

  window.setTimeout(() => flushRum(pagePath), AUTO_FLUSH_MS);
  addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      flushRum(pagePath);
    }
  });
  addEventListener('pagehide', () => flushRum(pagePath));

  function flushRum(pathname) {
    if (!collected.size || !config.endpoint || hasFlushed) return;

    const payload = {
      siteKey: config.siteKey,
      conceptKey: config.conceptKey,
      pagePath: pathname,
      pageType: classifyPageType(pathname),
      sampleSource: 'browser_rum',
      sessionId,
      deviceClass: window.innerWidth < 768 ? 'mobile' : 'desktop',
      viewportWidth: window.innerWidth,
      viewportHeight: window.innerHeight,
      userAgent: navigator.userAgent,
      metrics: [...collected.entries()].map(([name, metric]) => ({
        name,
        value: metric.value,
        rating: metric.rating,
      })),
    };

    const body = JSON.stringify(payload);
    hasFlushed = true;
    collected.clear();

    if (sendWithBeacon(body)) {
      return;
    }

    if (typeof fetch === 'function') {
      fetch(config.endpoint, {
        method: 'POST',
        headers: {
          'content-type': 'text/plain;charset=UTF-8',
        },
        body,
        keepalive: true,
        mode: 'cors',
      }).catch(() => {});
    }
  }

  function observeFcp() {
    new PerformanceObserver((entryList, observer) => {
      const entry = entryList.getEntriesByName('first-contentful-paint')[0];
      if (!entry) return;
      recordMetric('FCP', entry.startTime, rateMetric('FCP', entry.startTime));
      observer.disconnect();
    }).observe({ type: 'paint', buffered: true });
  }

  function observeLcp() {
    let latest = 0;
    const observer = new PerformanceObserver((entryList) => {
      for (const entry of entryList.getEntries()) {
        latest = entry.startTime;
      }
    });
    observer.observe({ type: 'largest-contentful-paint', buffered: true });
    addEventListener(
      'visibilitychange',
      () => {
        if (document.visibilityState === 'hidden' && latest > 0) {
          recordMetric('LCP', latest, rateMetric('LCP', latest));
          observer.disconnect();
        }
      },
      { once: true },
    );
  }

  function observeCls() {
    let cls = 0;
    new PerformanceObserver((entryList) => {
      for (const entry of entryList.getEntries()) {
        if (!entry.hadRecentInput) {
          cls += entry.value || 0;
        }
      }
      recordMetric('CLS', Number(cls.toFixed(4)), rateMetric('CLS', cls));
    }).observe({ type: 'layout-shift', buffered: true });
  }

  function observeInp() {
    let longestInteraction = 0;
    let timer;
    const observer = new PerformanceObserver((entryList) => {
      for (const entry of entryList.getEntries()) {
        if (!entry.interactionId) continue;
        longestInteraction = Math.max(longestInteraction, entry.duration || 0);
      }
      if (timer) {
        window.clearTimeout(timer);
      }
      timer = window.setTimeout(() => {
        if (longestInteraction > 0) {
          recordMetric('INP', Math.round(longestInteraction), rateMetric('INP', longestInteraction));
        }
      }, 5000);
    });

    try {
      observer.observe({ type: 'event', buffered: true, durationThreshold: 40 });
    } catch {
      // Browser does not support Event Timing.
    }
  }

  function observeTtfb() {
    const entry = performance.getEntriesByType('navigation')[0];
    if (!entry) return;
    recordMetric('TTFB', Math.round(entry.responseStart), rateMetric('TTFB', entry.responseStart));
  }

  function recordMetric(name, value, rating) {
    if (!Number.isFinite(value) || value <= 0) return;
    collected.set(name, { value, rating });
  }

  function sendWithBeacon(body) {
    if (typeof navigator.sendBeacon !== 'function') return false;
    return navigator.sendBeacon(config.endpoint, new Blob([body], { type: 'application/json' }));
  }

  function rateMetric(name, value) {
    const thresholds = {
      LCP: [2500, 4000],
      INP: [200, 500],
      CLS: [0.1, 0.25],
      TTFB: [800, 1800],
      FCP: [1800, 3000],
    };
    const [good, poor] = thresholds[name];
    if (value <= good) return 'good';
    if (value <= poor) return 'needs-improvement';
    return 'poor';
  }

  function classifyPageType(pathname) {
    if (pathname === config.basePath || pathname === `${config.basePath}/`) return 'landing';
    if (pathname.includes('/blog/')) return 'article';
    if (pathname.includes('/category/')) return 'category';
    if (pathname.includes('/author/')) return 'author';
    if (pathname.startsWith('/kommune/')) return 'municipality';
    return 'concept';
  }
})();
