import type { MiddlewareHandler } from 'astro';

export const onRequest: MiddlewareHandler = async (_context, next) => {
  const response = await next();
  
  // Add security headers
  
  // Only add headers for HTML responses
  if (response.headers.get('content-type')?.includes('text/html')) {
    const newHeaders = new Headers(response.headers);
    
    // Content Security Policy (basic)
    newHeaders.set('X-Content-Type-Options', 'nosniff');
    newHeaders.set('X-Frame-Options', 'SAMEORIGIN');
    newHeaders.set('Referrer-Policy', 'strict-origin-when-cross-origin');
    
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: newHeaders,
    });
  }
  
  return response;
};
