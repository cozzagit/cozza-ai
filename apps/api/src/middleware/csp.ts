import type { MiddlewareHandler } from 'hono';
import type { AppEnv } from '@/types/env';

const CSP = [
  "default-src 'self'",
  "connect-src 'self'",
  "media-src 'self' blob:",
  "img-src 'self' data:",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "font-src 'self' data:",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join('; ');

export const securityHeadersMiddleware: MiddlewareHandler<AppEnv> = async (c, next) => {
  await next();
  c.res.headers.set('Content-Security-Policy', CSP);
  c.res.headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  c.res.headers.set('X-Content-Type-Options', 'nosniff');
  c.res.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  c.res.headers.set('Permissions-Policy', 'microphone=(self), camera=(), geolocation=()');
  c.res.headers.set('X-Frame-Options', 'DENY');
};
