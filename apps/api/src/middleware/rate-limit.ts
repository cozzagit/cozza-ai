import type { MiddlewareHandler } from 'hono';
import type { AppEnv } from '@/types/env';

/**
 * Token-bucket rate limiter, in-memory.
 * Single Node process (PM2 fork mode, instances=1) → consistent state.
 * For cluster/multi-instance, swap to Redis-backed limiter.
 */
interface Bucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();
const WINDOW_MS = 60_000;

function clientIp(c: { req: { header: (n: string) => string | undefined } }): string {
  return (
    c.req.header('X-Forwarded-For')?.split(',')[0]?.trim() ??
    c.req.header('X-Real-IP') ??
    'anon'
  );
}

export const rateLimitMiddleware: MiddlewareHandler<AppEnv> = async (c, next) => {
  const cfg = c.get('config');
  const limit = cfg.RATE_LIMIT_PER_MIN;
  const ip = clientIp(c);
  const key = `${ip}:${new URL(c.req.url).pathname}`;
  const now = Date.now();

  const existing = buckets.get(key);
  if (!existing || existing.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + WINDOW_MS });
  } else {
    existing.count += 1;
    if (existing.count > limit) {
      const retryAfter = Math.ceil((existing.resetAt - now) / 1000);
      c.res.headers.set('Retry-After', String(retryAfter));
      return c.json(
        { error: { code: 'RATE_LIMITED', message: 'Too many requests' } },
        429,
      );
    }
  }

  // GC: prune expired buckets opportunistically (cheap, bounded)
  if (buckets.size > 1000) {
    for (const [k, b] of buckets) {
      if (b.resetAt <= now) buckets.delete(k);
    }
  }

  await next();
};

/** Test helper. */
export function _resetRateLimiter(): void {
  buckets.clear();
}
