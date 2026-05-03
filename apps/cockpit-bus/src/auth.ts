import { SignJWT, jwtVerify } from 'jose';
import { config } from './config.js';

const secret = new TextEncoder().encode(config.jwtSecret);

export interface CockpitClaims {
  sub: string;
  scopes: string[];
  exp?: number;
  iat?: number;
}

export async function issueToken(sub: string, scopes: string[], ttlSec = 86400): Promise<string> {
  return new SignJWT({ scopes })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(sub)
    .setIssuedAt()
    .setExpirationTime(Math.floor(Date.now() / 1000) + ttlSec)
    .sign(secret);
}

export async function verifyToken(token: string): Promise<CockpitClaims> {
  const { payload } = await jwtVerify(token, secret);
  return {
    sub: typeof payload.sub === 'string' ? payload.sub : 'unknown',
    scopes: Array.isArray(payload.scopes) ? (payload.scopes as string[]) : [],
    ...(typeof payload.exp === 'number' ? { exp: payload.exp } : {}),
    ...(typeof payload.iat === 'number' ? { iat: payload.iat } : {}),
  };
}

export function hasScope(claims: CockpitClaims, required: string): boolean {
  return claims.scopes.includes(required) || claims.scopes.includes('*');
}
