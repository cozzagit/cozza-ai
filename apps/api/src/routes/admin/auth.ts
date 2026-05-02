import { Hono } from 'hono';
import { z } from 'zod';
import { timingSafeEqual } from 'node:crypto';
import type { AppEnv } from '@/types/env';
import { signAdminToken } from '@/lib/jwt';
import { validateBody, getValidated } from '@/middleware/validate';
import {
  adminAuthRateLimit,
  recordAuthFailure,
  recordAuthSuccess,
  getClientIp,
} from '@/middleware/admin-auth';

const PinSchema = z.object({
  pin: z.string().regex(/^\d{6}$/, 'pin must be 6 digits'),
});
type PinPayload = z.infer<typeof PinSchema>;

export const adminAuthRoutes = new Hono<AppEnv>();

adminAuthRoutes.post('/', adminAuthRateLimit, validateBody(PinSchema), (c) => {
  const cfg = c.get('config');
  const { pin } = getValidated<PinPayload>(c);
  const ip = getClientIp(c);

  // Constant-time compare against configured PIN
  const expected = Buffer.from(cfg.ADMIN_PIN);
  const got = Buffer.from(pin);
  const match = expected.length === got.length && timingSafeEqual(expected, got);

  if (!match) {
    const f = recordAuthFailure(ip);
    return c.json(
      {
        error: {
          code: f.locked ? 'LOCKED' : 'INVALID_PIN',
          message: f.locked
            ? 'too many failed attempts, locked for 15 minutes'
            : `invalid pin, ${f.remaining} attempts remaining`,
        },
      },
      f.locked ? 429 : 401,
    );
  }

  recordAuthSuccess(ip);
  const token = signAdminToken(cfg.ADMIN_JWT_SECRET, cfg.ADMIN_TOKEN_TTL_SECONDS);
  return c.json({
    token,
    expiresIn: cfg.ADMIN_TOKEN_TTL_SECONDS,
  });
});
