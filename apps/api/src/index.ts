import { Hono } from 'hono';
import type { AppEnv } from '@/types/env';
import { config } from '@/config';
import { corsMiddleware } from '@/middleware/cors';
import { securityHeadersMiddleware } from '@/middleware/csp';
import { rateLimitMiddleware } from '@/middleware/rate-limit';
import { chatRoutes } from '@/routes/chat';
import { ttsRoutes } from '@/routes/tts';
import { healthRoutes } from '@/routes/health';
import { adminRoutes } from '@/routes/admin/index.js';

export function buildApp(): Hono<AppEnv> {
  const app = new Hono<AppEnv>();

  // Inject config into ctx for every request
  app.use('*', async (c, next) => {
    c.set('config', config);
    await next();
  });

  app.use('*', securityHeadersMiddleware);
  app.use('*', corsMiddleware);
  app.use('/api/chat/*', rateLimitMiddleware);
  app.use('/api/tts', rateLimitMiddleware);

  app.route('/api/chat', chatRoutes);
  app.route('/api/tts', ttsRoutes);
  app.route('/api/healthz', healthRoutes);
  app.route('/api/admin', adminRoutes);

  app.notFound((c) => c.json({ error: { code: 'NOT_FOUND', message: 'route not found' } }, 404));

  app.onError((err, c) => {
    console.error(JSON.stringify({ event: 'error.unhandled', message: err.message }));
    return c.json({ error: { code: 'INTERNAL', message: 'unexpected error' } }, 500);
  });

  return app;
}

export const app = buildApp();
export default app;
