import { describe, it, expect } from 'vitest';
import { signAdminToken, verifyAdminToken } from './jwt';

const SECRET = 'a'.repeat(64);

describe('signAdminToken / verifyAdminToken', () => {
  it('round-trip valid token', () => {
    const tok = signAdminToken(SECRET, 60);
    const payload = verifyAdminToken(tok, SECRET);
    expect(payload).not.toBeNull();
    expect(payload?.sub).toBe('admin');
  });

  it('rejects tampered signature', () => {
    const tok = signAdminToken(SECRET, 60);
    const tampered = tok.slice(0, -2) + 'aa';
    expect(verifyAdminToken(tampered, SECRET)).toBeNull();
  });

  it('rejects wrong secret', () => {
    const tok = signAdminToken(SECRET, 60);
    expect(verifyAdminToken(tok, 'b'.repeat(64))).toBeNull();
  });

  it('rejects expired token', () => {
    const tok = signAdminToken(SECRET, -10); // already expired
    expect(verifyAdminToken(tok, SECRET)).toBeNull();
  });

  it('rejects malformed token', () => {
    expect(verifyAdminToken('not.a.jwt', SECRET)).toBeNull();
    expect(verifyAdminToken('only.twoparts', SECRET)).toBeNull();
    expect(verifyAdminToken('', SECRET)).toBeNull();
  });
});
