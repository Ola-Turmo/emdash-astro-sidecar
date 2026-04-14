export function applySecurityHeaders(headers: Headers, options?: { indexable?: boolean }): Headers {
  const next = new Headers(headers);
  next.set(
    'strict-transport-security',
    'max-age=31536000; includeSubDomains; preload',
  );
  next.set(
    'content-security-policy',
    [
      "default-src 'self' https: data: blob:",
      "img-src 'self' https: data: blob:",
      "style-src 'self' https: 'unsafe-inline'",
      "script-src 'self' https: 'unsafe-inline' 'unsafe-eval'",
      "font-src 'self' https: data:",
      "connect-src 'self' https: wss:",
      "frame-src 'self' https:",
      "object-src 'none'",
      "base-uri 'self'",
      "frame-ancestors 'self'",
      "form-action 'self' https:",
      'upgrade-insecure-requests',
    ].join('; '),
  );
  next.set('referrer-policy', 'strict-origin-when-cross-origin');
  next.set(
    'permissions-policy',
    [
      'camera=()',
      'microphone=()',
      'geolocation=()',
      'interest-cohort=()',
      'browsing-topics=()',
      'payment=()',
      'usb=()',
    ].join(', '),
  );
  next.set('x-content-type-options', 'nosniff');
  next.set('x-frame-options', 'SAMEORIGIN');
  next.set('x-robots-tag', options?.indexable === false ? 'noindex, nofollow' : 'index, follow');
  return next;
}
