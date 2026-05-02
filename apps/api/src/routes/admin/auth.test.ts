import { describe, it, expect, beforeEach } from 'vitest';
import { Hono } from 'hono';
import type { AppEnv } from '@/types/env';
import type { AppConfig } from '@/config';
import { adminAuthRoutes } from './auth';
import { adminInfoRoutes } from './info';
import { _resetAdminAuthBuckets } from '@/middleware/admin-auth';

function buildApp(pin = '123456') {
  const cfg: AppConfig = {
    PORT: 3025,
    HOST: '127.0.0.1',
    ANTHROPIC_API_KEY: 'x',
    OPENAI_API_KEY: 'x',
    ELEVENLABS_API_KEY: 'x',
    ALLOWED_ORIGINS: '',
    RATE_LIMIT_PER_MIN: 30,
    COMMIT_SHA: 'test',
    NODE_ENV: 'test',
    ADMIN_PIN: pin,
    ADMIN_JWT_SECRET: 'a'.repeat(64),
    ADMIN_TOKEN_TTL_SECONDS: 60,
  };
  const app = new Hono<AppEnv>();
  app.use('*', async (c, next) => {
    c.set('config', cfg);
    await next();
  });
  app.route('/api/admin/auth', adminAuthRoutes);
  app.route('/api/admin/info', adminInfoRoutes);
  return app;
}

describe('admin auth + info', () => {
  beforeEach(() => {
    _resetAdminAuthBuckets();
  });

  it('rejects malformed PIN', async () => {
    const app = buildApp();
    const res = await app.request('/api/admin/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pin: 'abc' }),
    });
    expect(res.status).toBe(400);
  });

  it('rejects wrong PIN with remaining counter', async () => {
    const app = buildApp('111111');
    const res = await app.request('/api/admin/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': '1.1.1.1' },
      body: JSON.stringify({ pin: '999999' }),
    });
    expect(res.status).toBe(401);
    const j = (await res.json()) as { error: { code: string; message: string } };
    expect(j.error.code).toBe('INVALID_PIN');
    expect(j.error.message).toContain('attempts remaining');
  });

  it('issues a valid token on correct PIN', async () => {
    const app = buildApp('555555');
    const res = await app.request('/api/admin/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': '2.2.2.2' },
      body: JSON.stringify({ pin: '555555' }),
    });
    expect(res.status).toBe(200);
    const j = (await res.json()) as { token: string; expiresIn: number };
    expect(typeof j.token).toBe('string');
    expect(j.expiresIn).toBe(60);

    // /info should pass with the token
    const info = await app.request('/api/admin/info', {
      headers: { Authorization: `Bearer ${j.token}` },
    });
    expect(info.status).toBe(200);
    const ij = (await info.json()) as { ok: boolean; commit: string };
    expect(ij.ok).toBe(true);
    expect(ij.commit).toBe('test');
  });

  it('blocks /info without bearer', async () => {
    const app = buildApp();
    const res = await app.request('/api/admin/info');
    expect(res.status).toBe(401);
  });

  it('locks out after 5 failed attempts', async () => {
    const app = buildApp('111111');
    for (let i = 0; i < 5; i++) {
      const r = await app.request('/api/admin/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': '3.3.3.3' },
        body: JSON.stringify({ pin: '000000' }),
      });
      expect([401, 429]).toContain(r.status);
    }
    const r = await app.request('/api/admin/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': '3.3.3.3' },
      body: JSON.stringify({ pin: '000000' }),
    });
    expect(r.status).toBe(429);
    expect(r.headers.get('Retry-After')).toMatch(/^\d+$/);
  });
});
