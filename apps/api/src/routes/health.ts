import { Hono } from 'hono';
import type { AppEnv } from '@/types/env';

export const healthRoutes = new Hono<AppEnv>();

healthRoutes.get('/', (c) => {
  const cfg = c.get('config');
  return c.json({
    status: 'ok',
    commit: cfg.COMMIT_SHA,
    timestamp: new Date().toISOString(),
  });
});
