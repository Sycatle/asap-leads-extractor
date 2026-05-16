import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { signUnsubToken, verifyUnsubToken } from './unsubToken';

const SECRET = 'test-secret-with-enough-entropy-1234567890';

beforeEach(() => {
  process.env.UNSUB_TOKEN_SECRET = SECRET;
});

afterEach(() => {
  delete process.env.UNSUB_TOKEN_SECRET;
});

describe('signUnsubToken / verifyUnsubToken', () => {
  it('round-trips payload', () => {
    const token = signUnsubToken({ enrollmentId: 42, contactId: 7 });
    const verified = verifyUnsubToken(token);
    expect(verified?.enrollmentId).toBe(42);
    expect(verified?.contactId).toBe(7);
    expect(verified?.exp).toBeGreaterThan(Math.floor(Date.now() / 1000));
  });

  it('rejects tampered token', () => {
    const token = signUnsubToken({ enrollmentId: 1, contactId: 1 });
    const [payload, sig] = token.split('.');
    // change one byte of the payload
    const tampered = payload.slice(0, -1) + (payload.endsWith('A') ? 'B' : 'A') + '.' + sig;
    expect(verifyUnsubToken(tampered)).toBeNull();
  });

  it('rejects token with wrong secret', () => {
    const token = signUnsubToken({ enrollmentId: 1, contactId: 1 });
    expect(verifyUnsubToken(token, 'other-secret-with-enough-entropy')).toBeNull();
  });

  it('rejects expired token', () => {
    const token = signUnsubToken({ enrollmentId: 1, contactId: 1, ttlSeconds: -10 });
    expect(verifyUnsubToken(token)).toBeNull();
  });

  it('rejects malformed token (no dot)', () => {
    expect(verifyUnsubToken('no-dot-here')).toBeNull();
  });

  it('throws if secret missing', () => {
    delete process.env.UNSUB_TOKEN_SECRET;
    expect(() => signUnsubToken({ enrollmentId: 1, contactId: 1 })).toThrow(/UNSUB_TOKEN_SECRET/);
  });
});
