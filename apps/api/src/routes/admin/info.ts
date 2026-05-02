import { Hono } from 'hono';
import type { AppEnv } from '@/types/env';
import { requireAdmin } from '@/middleware/admin-auth';

export const adminInfoRoutes = new Hono<AppEnv>();

adminInfoRoutes.use('*', requireAdmin);

adminInfoRoutes.get('/', (c) => {
  const cfg = c.get('config');
  return c.json({
    ok: true,
    commit: cfg.COMMIT_SHA,
    env: cfg.NODE_ENV,
    rateLimitPerMin: cfg.RATE_LIMIT_PER_MIN,
    tokenTtlSeconds: cfg.ADMIN_TOKEN_TTL_SECONDS,
  });
});
