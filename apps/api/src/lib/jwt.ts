import { createHmac, timingSafeEqual } from 'node:crypto';

/**
 * Minimal HS256 JWT for the admin panel.
 * Stdlib only — no `jose` / `jsonwebtoken` dependency.
 */

export interface AdminTokenPayload {
  sub: 'admin';
  iat: number;
  exp: number;
}

const b64url = (buf: Buffer | string): string =>
  Buffer.from(buf).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');

const b64urlDecode = (s: string): Buffer =>
  Buffer.from(s.replace(/-/g, '+').replace(/_/g, '/'), 'base64');

export function signAdminToken(secret: string, ttlSeconds: number): string {
  const header = { alg: 'HS256', typ: 'JWT' };
  const now = Math.floor(Date.now() / 1000);
  const payload: AdminTokenPayload = { sub: 'admin', iat: now, exp: now + ttlSeconds };
  const h = b64url(JSON.stringify(header));
  const p = b64url(JSON.stringify(payload));
  const data = `${h}.${p}`;
  const sig = b64url(createHmac('sha256', secret).update(data).digest());
  return `${data}.${sig}`;
}

export function verifyAdminToken(token: string, secret: string): AdminTokenPayload | null {
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [h, p, s] = parts;
  if (!h || !p || !s) return null;
  const data = `${h}.${p}`;
  const expected = b64url(createHmac('sha256', secret).update(data).digest());
  // Constant-time compare
  const a = Buffer.from(expected);
  const b = Buffer.from(s);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  let payload: AdminTokenPayload;
  try {
    payload = JSON.parse(b64urlDecode(p).toString('utf-8')) as AdminTokenPayload;
  } catch {
    return null;
  }
  if (payload.sub !== 'admin') return null;
  if (typeof payload.exp !== 'number' || payload.exp <= Math.floor(Date.now() / 1000)) {
    return null;
  }
  return payload;
}
