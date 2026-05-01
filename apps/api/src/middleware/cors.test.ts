import { describe, it, expect } from 'vitest';
import { Hono } from 'hono';
import type { AppEnv } from '@/types/env';
import type { AppConfig } from '@/config';
import { corsMiddleware } from './cors';

function buildApp(allowedOrigins: string) {
  const cfg: AppConfig = {
    PORT: 3025,
    HOST: '127.0.0.1',
    ANTHROPIC_API_KEY: 'x',
    OPENAI_API_KEY: 'x',
    ELEVENLABS_API_KEY: 'x',
    ALLOWED_ORIGINS: allowedOrigins,
    RATE_LIMIT_PER_MIN: 30,
    COMMIT_SHA: 'test',
    NODE_ENV: 'test',
  };
  const app = new Hono<AppEnv>();
  app.use('*', async (c, next) => {
    c.set('config', cfg);
    await next();
  });
  app.use('*', corsMiddleware);
  app.get('/ping', (c) => c.text('pong'));
  app.options('/ping', (c) => c.text('ok'));
  return app;
}

describe('corsMiddleware', () => {
  it('rejects preflight from unknown origin', async () => {
    const app = buildApp('http://localhost:5173');
    const res = await app.request('/ping', {
      method: 'OPTIONS',
      headers: {
        Origin: 'https://malicious.example',
        'Access-Control-Request-Method': 'POST',
      },
    });
    expect(res.status).toBe(403);
  });

  it('accepts preflight from allowed origin', async () => {
    const app = buildApp('http://localhost:5173,https://cozza-ai.vibecanyon.com');
    const res = await app.request('/ping', {
      method: 'OPTIONS',
      headers: {
        Origin: 'https://cozza-ai.vibecanyon.com',
        'Access-Control-Request-Method': 'POST',
      },
    });
    expect(res.status).toBe(204);
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe(
      'https://cozza-ai.vibecanyon.com',
    );
  });

  it('does not echo Allow-Origin for non-allowed origins on actual requests', async () => {
    const app = buildApp('http://localhost:5173');
    const res = await app.request('/ping', {
      method: 'GET',
      headers: { Origin: 'https://malicious.example' },
    });
    expect(res.status).toBe(200);
    expect(res.headers.get('Access-Control-Allow-Origin')).toBeNull();
  });
});
