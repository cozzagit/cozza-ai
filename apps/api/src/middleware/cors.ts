import type { MiddlewareHandler } from 'hono';
import type { AppEnv } from '@/types/env';

/**
 * Strict CORS allowlist (origin only, no `*`).
 * Reads ALLOWED_ORIGINS from c.var.config (loaded from process.env at boot).
 */
export const corsMiddleware: MiddlewareHandler<AppEnv> = async (c, next) => {
  const cfg = c.get('config');
  const origin = c.req.header('Origin') ?? '';
  const allowed = cfg.ALLOWED_ORIGINS.split(',').map((s) => s.trim()).filter(Boolean);
  const allow = allowed.includes(origin);

  if (c.req.method === 'OPTIONS') {
    if (!allow) {
      return c.text('Origin not allowed', 403);
    }
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': origin,
        'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Max-Age': '600',
        Vary: 'Origin',
      },
    });
  }

  await next();

  if (allow) {
    c.res.headers.set('Access-Control-Allow-Origin', origin);
    c.res.headers.set('Vary', 'Origin');
  }
};
