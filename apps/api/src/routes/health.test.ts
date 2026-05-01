import { describe, it, expect } from 'vitest';
import { Hono } from 'hono';
import type { AppEnv } from '@/types/env';
import type { AppConfig } from '@/config';
import { healthRoutes } from './health';

describe('healthRoutes', () => {
  it('returns ok with commit and timestamp', async () => {
    const cfg: AppConfig = {
      PORT: 3025,
      HOST: '127.0.0.1',
      ANTHROPIC_API_KEY: 'x',
      OPENAI_API_KEY: 'x',
      ELEVENLABS_API_KEY: 'x',
      ALLOWED_ORIGINS: '',
      RATE_LIMIT_PER_MIN: 30,
      COMMIT_SHA: 'abc1234',
      NODE_ENV: 'test',
    };
    const app = new Hono<AppEnv>();
    app.use('*', async (c, next) => {
      c.set('config', cfg);
      await next();
    });
    app.route('/api/healthz', healthRoutes);
    const res = await app.request('/api/healthz');
    expect(res.status).toBe(200);
    const j = (await res.json()) as { status: string; commit: string; timestamp: string };
    expect(j.status).toBe('ok');
    expect(j.commit).toBe('abc1234');
    expect(typeof j.timestamp).toBe('string');
    expect(new Date(j.timestamp).toString()).not.toBe('Invalid Date');
  });
});
