import { describe, it, expect } from 'vitest';
import { Hono } from 'hono';
import { z } from 'zod';
import type { AppEnv } from '@/types/env';
import type { AppConfig } from '@/config';
import { validateBody, getValidated } from './validate';

const Schema = z.object({ name: z.string().min(2) });
type Body = z.infer<typeof Schema>;

function build() {
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
  };
  const app = new Hono<AppEnv>();
  app.use('*', async (c, next) => {
    c.set('config', cfg);
    await next();
  });
  app.post('/x', validateBody(Schema), (c) => {
    const body = getValidated<Body>(c);
    return c.json({ name: body.name });
  });
  return app;
}

describe('validateBody', () => {
  it('rejects invalid JSON', async () => {
    const app = build();
    const res = await app.request('/x', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: 'not-json',
    });
    expect(res.status).toBe(400);
    const j = (await res.json()) as { error: { code: string } };
    expect(j.error.code).toBe('INVALID_JSON');
  });

  it('rejects schema mismatch with details', async () => {
    const app = build();
    const res = await app.request('/x', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'x' }),
    });
    expect(res.status).toBe(400);
    const j = (await res.json()) as {
      error: { code: string; details: { path: string }[] };
    };
    expect(j.error.code).toBe('VALIDATION_ERROR');
    expect(j.error.details[0]?.path).toBe('name');
  });

  it('accepts valid body', async () => {
    const app = build();
    const res = await app.request('/x', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'cozza' }),
    });
    expect(res.status).toBe(200);
    const j = (await res.json()) as { name: string };
    expect(j.name).toBe('cozza');
  });

  it('rejects oversized body via Content-Length', async () => {
    const app = build();
    const res = await app.request('/x', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': '5000000',
      },
      body: JSON.stringify({ name: 'cozza' }),
    });
    expect(res.status).toBe(413);
  });
});
