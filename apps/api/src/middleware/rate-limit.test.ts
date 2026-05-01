import { describe, it, expect, beforeEach } from 'vitest';
import { Hono } from 'hono';
import type { AppEnv } from '@/types/env';
import type { AppConfig } from '@/config';
import { rateLimitMiddleware, _resetRateLimiter } from './rate-limit';

function build(limit: number) {
  const cfg: AppConfig = {
    PORT: 3025,
    HOST: '127.0.0.1',
    ANTHROPIC_API_KEY: 'x',
    OPENAI_API_KEY: 'x',
    ELEVENLABS_API_KEY: 'x',
    ALLOWED_ORIGINS: '',
    RATE_LIMIT_PER_MIN: limit,
    COMMIT_SHA: 'test',
    NODE_ENV: 'test',
  };
  const app = new Hono<AppEnv>();
  app.use('*', async (c, next) => {
    c.set('config', cfg);
    await next();
  });
  app.use('*', rateLimitMiddleware);
  app.get('/ping', (c) => c.text('pong'));
  return app;
}

describe('rateLimitMiddleware', () => {
  beforeEach(() => {
    _resetRateLimiter();
  });

  it('lets through requests under the limit', async () => {
    const app = build(3);
    for (let i = 0; i < 3; i++) {
      const res = await app.request('/ping', {
        headers: { 'X-Forwarded-For': '1.2.3.4' },
      });
      expect(res.status).toBe(200);
    }
  });

  it('returns 429 once limit is exceeded with Retry-After header', async () => {
    const app = build(2);
    await app.request('/ping', { headers: { 'X-Forwarded-For': '5.6.7.8' } });
    await app.request('/ping', { headers: { 'X-Forwarded-For': '5.6.7.8' } });
    const res = await app.request('/ping', { headers: { 'X-Forwarded-For': '5.6.7.8' } });
    expect(res.status).toBe(429);
    expect(res.headers.get('Retry-After')).toMatch(/^\d+$/);
    const j = (await res.json()) as { error: { code: string } };
    expect(j.error.code).toBe('RATE_LIMITED');
  });

  it('isolates different IPs', async () => {
    const app = build(1);
    const a = await app.request('/ping', { headers: { 'X-Forwarded-For': '10.0.0.1' } });
    const b = await app.request('/ping', { headers: { 'X-Forwarded-For': '10.0.0.2' } });
    expect(a.status).toBe(200);
    expect(b.status).toBe(200);
  });
});
