/**
 * Edge Middleware for EmDash Blog Worker
 * 
 * Implements:
 * - CORS headers for cross-origin blog embedding
 * - Authentication for preview routes
 * - Rate limiting
 * - Request logging
 */

import type { Env } from './index';

export async function withMiddleware(
  request: Request,
  env: Env,
  ctx: ExecutionContext
): Promise<Response | Request> {
  const url = new URL(request.url);
  
  // Skip middleware for static assets
  if (isStaticAsset(url.pathname)) {
    return request;
  }
  
  // Apply CORS headers for cross-origin embedding
  const corsResponse = applyCorsHeaders(request);
  if (corsResponse) {
    return corsResponse;
  }
  
  // Handle preflight requests
  if (request.method === 'OPTIONS') {
    return handlePreflight(request);
  }
  
  // Add request ID for tracing
  const requestId = crypto.randomUUID();
  const modifiedRequest = new Request(request, {
    headers: {
      ...Object.fromEntries(request.headers),
      'X-Request-ID': requestId
    }
  });
  
  // Log request (can be enhanced with tail workers)
  logRequest(modifiedRequest, requestId);
  
  return modifiedRequest;
}

function isStaticAsset(pathname: string): boolean {
  const staticExtensions = ['.css', '.js', '.svg', '.png', '.jpg', '.jpeg', '.gif', '.webp', '.ico', '.woff', '.woff2', '.ttf'];
  return staticExtensions.some(ext => pathname.endsWith(ext)) ||
         pathname.startsWith('/_assets') ||
         pathname.startsWith('/_chunks') ||
         pathname.startsWith('/_entries');
}

function applyCorsHeaders(request: Request): Response | null {
  const origin = request.headers.get('Origin');
  
  // List of allowed origins for cross-origin embedding
  const allowedOrigins = [
    'https://example.com',
    'https://www.example.com',
    'https://blog.example.com',
    // Add preview deployments
    'https://*.pages.dev',
    'https://*.cloudflareapps.com'
  ];
  
  const isAllowed = origin && allowedOrigins.some(allowed => {
    if (allowed.includes('*')) {
      const pattern = new RegExp('^' + allowed.replace('*', '.*') + '$');
      return pattern.test(origin);
    }
    return allowed === origin;
  });
  
  // Don't add CORS headers for same-origin requests
  if (!origin) {
    return null;
  }
  
  const corsHeaders: Record<string, string> = {
    'Access-Control-Allow-Origin': isAllowed ? origin : '',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Preview-Token, X-Request-ID',
    'Access-Control-Max-Age': '86400',
    'Vary': 'Origin'
  };
  
  // If origin is not allowed, don't add the header (will be blocked by browser)
  if (!isAllowed) {
    // Only block API routes from unknown origins
    const url = new URL(request.url);
    if (url.pathname.startsWith('/api/')) {
      return new Response(JSON.stringify({ error: 'CORS not allowed' }), {
        status: 403,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': ''
        }
      });
    }
  }
  
  return null;
}

function handlePreflight(request: Request): Response {
  const origin = request.headers.get('Origin');
  
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': origin || '',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Preview-Token, X-Request-ID',
      'Access-Control-Max-Age': '86400'
    }
  });
}

function logRequest(request: Request, requestId: string): void {
  const url = new URL(request.url);
  
  console.log(JSON.stringify({
    type: 'request',
    requestId,
    method: request.method,
    pathname: url.pathname,
    userAgent: request.headers.get('User-Agent'),
    cfConnectingIP: request.headers.get('CF-Connecting-IP'),
    timestamp: new Date().toISOString()
  }));
}

/**
 * Rate limiting middleware
 */
export async function checkRateLimit(
  request: Request,
  env: Env,
  limit: number = 100,
  windowMs: number = 60000
): Promise<{ allowed: boolean; remaining: number; resetAt: number }> {
  const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
  const key = `rate_limit:${ip}`;
  
  try {
    const existing = await env.EMDASH_CONTENT_CACHE.get(key);
    
    if (existing) {
      const { count, windowStart } = JSON.parse(existing);
      const now = Date.now();
      
      if (now - windowStart < windowMs) {
        if (count >= limit) {
          return { allowed: false, remaining: 0, resetAt: windowStart + windowMs };
        }
        return { allowed: true, remaining: limit - count, resetAt: windowStart + windowMs };
      }
    }
    
    return { allowed: true, remaining: limit, resetAt: Date.now() + windowMs };
  } catch {
    return { allowed: true, remaining: limit, resetAt: Date.now() + windowMs };
  }
}

/**
 * Auth middleware for protected routes
 */
export async function checkAuth(
  request: Request,
  env: Env
): Promise<{ authenticated: boolean; userId?: string }> {
  const authHeader = request.headers.get('Authorization');
  const previewToken = request.headers.get('X-Preview-Token');
  
  // Check Bearer token
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.substring(7);
    // Validate token against EmDash API or stored sessions
    try {
      const response = await fetch(`${env.EMDASH_HOST}/api/v1/auth/validate`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        return { authenticated: true, userId: data.userId };
      }
    } catch {
      // Token validation failed
    }
  }
  
  // Check preview token (API key as simple auth)
  if (previewToken && previewToken === env.EMDASH_API_KEY) {
    return { authenticated: true };
  }
  
  return { authenticated: false };
}

/**
 * Error boundary wrapper
 */
export function withErrorBoundary(
  handler: (request: Request, env: Env, ctx: ExecutionContext) => Promise<Response>
) {
  return async (request: Request, env: Env, ctx: ExecutionContext): Promise<Response> => {
    try {
      return await handler(request, env, ctx);
    } catch (error) {
      console.error('Worker error:', error);
      
      return new Response(JSON.stringify({
        error: 'Internal Server Error',
        message: 'An unexpected error occurred'
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  };
}
