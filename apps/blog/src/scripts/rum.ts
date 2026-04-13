import {
  ACTIVE_CONCEPT_KEY,
  ACTIVE_SITE_KEY,
  BLOG_BASE_PATH,
  RUM_ENDPOINT,
} from '../consts';

type RumMetricPayload = {
  siteKey: string;
  conceptKey: string;
  pagePath: string;
  pageType: string;
  deviceClass: 'mobile' | 'desktop';
  viewportWidth: number;
  viewportHeight: number;
  userAgent: string;
  metrics: Array<{
    name: 'LCP' | 'INP' | 'CLS' | 'TTFB' | 'FCP';
    value: number;
    rating: 'good' | 'needs-improvement' | 'poor';
  }>;
};

const collected = new Map<string, { value: number; rating: 'good' | 'needs-improvement' | 'poor' }>();
let hasFlushed = false;

export function startRumCollection(): void {
  if (typeof window === 'undefined' || typeof PerformanceObserver === 'undefined' || !RUM_ENDPOINT) {
    return;
  }

  const pagePath = window.location.pathname;
  if (!pagePath.startsWith(BLOG_BASE_PATH)) {
    return;
  }

  observeFcp();
  observeLcp();
  observeCls();
  observeInp();
  observeTtfb();

  addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      flushRum(pagePath);
    }
  });

  addEventListener('pagehide', () => flushRum(pagePath));
}

startRumCollection();

function flushRum(pagePath: string): void {
  if (!collected.size || !RUM_ENDPOINT || hasFlushed) return;

  const payload: RumMetricPayload = {
    siteKey: ACTIVE_SITE_KEY,
    conceptKey: ACTIVE_CONCEPT_KEY,
    pagePath,
    pageType: classifyPageType(pagePath),
    deviceClass: window.innerWidth < 768 ? 'mobile' : 'desktop',
    viewportWidth: window.innerWidth,
    viewportHeight: window.innerHeight,
    userAgent: navigator.userAgent,
    metrics: [...collected.entries()].map(([name, metric]) => ({
      name: name as RumMetricPayload['metrics'][number]['name'],
      value: metric.value,
      rating: metric.rating,
    })),
  };

  const body = JSON.stringify(payload);
  hasFlushed = true;
  collected.clear();

  if (typeof fetch === 'function') {
    fetch(RUM_ENDPOINT, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body,
      keepalive: true,
      mode: 'cors',
    }).catch(() => {
      sendWithBeacon(body);
    });
    return;
  }

  sendWithBeacon(body);
}

function observeFcp(): void {
  new PerformanceObserver((entryList, observer) => {
    const entry = entryList.getEntriesByName('first-contentful-paint')[0];
    if (!entry) return;
    recordMetric('FCP', entry.startTime, rateMetric('FCP', entry.startTime));
    observer.disconnect();
  }).observe({ type: 'paint', buffered: true });
}

function observeLcp(): void {
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

function observeCls(): void {
  let cls = 0;
  new PerformanceObserver((entryList) => {
    for (const entry of entryList.getEntries() as Array<PerformanceEntry & { hadRecentInput?: boolean; value?: number }>) {
      if (!entry.hadRecentInput) {
        cls += entry.value ?? 0;
      }
    }
    recordMetric('CLS', Number(cls.toFixed(4)), rateMetric('CLS', cls));
  }).observe({ type: 'layout-shift', buffered: true });
}

function observeInp(): void {
  let longestInteraction = 0;
  let timer: number | undefined;
  const observer = new PerformanceObserver((entryList) => {
    for (const entry of entryList.getEntries() as Array<PerformanceEntry & { duration?: number; interactionId?: number }>) {
      if (!entry.interactionId) continue;
      longestInteraction = Math.max(longestInteraction, entry.duration ?? 0);
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
    observer.observe({ type: 'event', buffered: true, durationThreshold: 40 } as PerformanceObserverInit);
  } catch {
    // Browsers without Event Timing support will just skip INP.
  }
}

function observeTtfb(): void {
  const [entry] = performance.getEntriesByType('navigation') as PerformanceNavigationTiming[];
  if (!entry) return;
  const ttfb = entry.responseStart;
  recordMetric('TTFB', Math.round(ttfb), rateMetric('TTFB', ttfb));
}

function recordMetric(
  name: RumMetricPayload['metrics'][number]['name'],
  value: number,
  rating: RumMetricPayload['metrics'][number]['rating'],
): void {
  if (!Number.isFinite(value) || value <= 0) return;
  collected.set(name, { value, rating });
}

function sendWithBeacon(body: string): void {
  if (typeof navigator.sendBeacon !== 'function') return;
  navigator.sendBeacon(RUM_ENDPOINT, new Blob([body], { type: 'application/json' }));
}

function rateMetric(
  name: RumMetricPayload['metrics'][number]['name'],
  value: number,
): RumMetricPayload['metrics'][number]['rating'] {
  const thresholds = {
    LCP: [2500, 4000],
    INP: [200, 500],
    CLS: [0.1, 0.25],
    TTFB: [800, 1800],
    FCP: [1800, 3000],
  } as const;

  const [good, poor] = thresholds[name];
  if (value <= good) return 'good';
  if (value <= poor) return 'needs-improvement';
  return 'poor';
}

function classifyPageType(pathname: string): string {
  if (pathname === BLOG_BASE_PATH || pathname === `${BLOG_BASE_PATH}/`) return 'landing';
  if (pathname.includes('/blog/')) return 'article';
  if (pathname.includes('/category/')) return 'category';
  if (pathname.includes('/author/')) return 'author';
  if (pathname.startsWith('/kommune/')) return 'municipality';
  return 'concept';
}
