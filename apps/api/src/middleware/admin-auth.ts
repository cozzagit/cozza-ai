import type { MiddlewareHandler } from 'hono';
import type { AppEnv } from '@/types/env';
import { verifyAdminToken } from '@/lib/jwt';

/**
 * Verifies a Bearer token. 401 on missing/invalid/expired.
 */
export const requireAdmin: MiddlewareHandler<AppEnv> = async (c, next) => {
  const cfg = c.get('config');
  const auth = c.req.header('Authorization');
  if (!auth?.startsWith('Bearer ')) {
    return c.json({ error: { code: 'UNAUTHENTICATED', message: 'missing bearer token' } }, 401);
  }
  const token = auth.slice('Bearer '.length).trim();
  const payload = verifyAdminToken(token, cfg.ADMIN_JWT_SECRET);
  if (!payload) {
    return c.json({ error: { code: 'UNAUTHENTICATED', message: 'invalid or expired token' } }, 401);
  }
  await next();
};

/**
 * Brute-force lockout for /api/admin/auth.
 * Per-IP. 5 attempts per 5 minutes, then 15 minute lock.
 */
interface AttemptBucket {
  attempts: number;
  firstAt: number;
  lockedUntil: number;
}

const ATTEMPT_WINDOW_MS = 5 * 60 * 1000;
const MAX_ATTEMPTS = 5;
const LOCK_MS = 15 * 60 * 1000;
const buckets = new Map<string, AttemptBucket>();

function clientIp(c: { req: { header: (n: string) => string | undefined } }): string {
  return (
    c.req.header('X-Forwarded-For')?.split(',')[0]?.trim() ?? c.req.header('X-Real-IP') ?? 'anon'
  );
}

export const adminAuthRateLimit: MiddlewareHandler<AppEnv> = async (c, next) => {
  const ip = clientIp(c);
  const now = Date.now();
  const b = buckets.get(ip);
  if (b) {
    if (b.lockedUntil > now) {
      const retryAfter = Math.ceil((b.lockedUntil - now) / 1000);
      c.res.headers.set('Retry-After', String(retryAfter));
      return c.json(
        {
          error: {
            code: 'LOCKED',
            message: `too many failed attempts, retry in ${Math.ceil(retryAfter / 60)} min`,
          },
        },
        429,
      );
    }
    // window expired → reset
    if (now - b.firstAt > ATTEMPT_WINDOW_MS) {
      buckets.delete(ip);
    }
  }
  await next();
};

/** Called by the auth handler after a failed PIN attempt. */
export function recordAuthFailure(ip: string): { remaining: number; locked: boolean } {
  const now = Date.now();
  const b = buckets.get(ip);
  if (!b) {
    buckets.set(ip, { attempts: 1, firstAt: now, lockedUntil: 0 });
    return { remaining: MAX_ATTEMPTS - 1, locked: false };
  }
  b.attempts += 1;
  if (b.attempts >= MAX_ATTEMPTS) {
    b.lockedUntil = now + LOCK_MS;
    return { remaining: 0, locked: true };
  }
  return { remaining: MAX_ATTEMPTS - b.attempts, locked: false };
}

export function recordAuthSuccess(ip: string): void {
  buckets.delete(ip);
}

/** Test helper. */
export function _resetAdminAuthBuckets(): void {
  buckets.clear();
}

export function getClientIp(c: { req: { header: (n: string) => string | undefined } }): string {
  return clientIp(c);
}
