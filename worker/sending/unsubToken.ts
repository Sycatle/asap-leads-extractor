/**
 * Tokens unsubscribe one-click (RFC 8058).
 *
 * Format : base64url(JSON({enrollmentId, contactId, exp})) + "." + hmacSha256
 * Pas de stockage : tout est dans le token. Expiration 90 jours.
 *
 * Secret : env `UNSUB_TOKEN_SECRET` (32 octets minimum).
 */

import { createHmac, timingSafeEqual } from 'node:crypto';

const DEFAULT_TTL_SECONDS = 90 * 24 * 60 * 60;

export interface UnsubPayload {
  enrollmentId: number;
  contactId: number;
  /** Unix seconds */
  exp: number;
}

function b64urlEncode(buf: Buffer | string): string {
  const b = typeof buf === 'string' ? Buffer.from(buf, 'utf8') : buf;
  return b.toString('base64').replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
}

function b64urlDecode(s: string): Buffer {
  const pad = s.length % 4 === 0 ? '' : '='.repeat(4 - (s.length % 4));
  return Buffer.from(s.replace(/-/g, '+').replace(/_/g, '/') + pad, 'base64');
}

function getSecret(secret?: string): string {
  const s = secret ?? process.env.UNSUB_TOKEN_SECRET;
  if (!s || s.length < 16) {
    throw new Error('UNSUB_TOKEN_SECRET must be set and at least 16 chars');
  }
  return s;
}

export function signUnsubToken(
  payload: Omit<UnsubPayload, 'exp'> & { ttlSeconds?: number },
  secret?: string,
): string {
  const exp = Math.floor(Date.now() / 1000) + (payload.ttlSeconds ?? DEFAULT_TTL_SECONDS);
  const body: UnsubPayload = {
    enrollmentId: payload.enrollmentId,
    contactId: payload.contactId,
    exp,
  };
  const encoded = b64urlEncode(JSON.stringify(body));
  const sig = createHmac('sha256', getSecret(secret)).update(encoded).digest();
  return `${encoded}.${b64urlEncode(sig)}`;
}

export function verifyUnsubToken(token: string, secret?: string): UnsubPayload | null {
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [encoded, sig] = parts;
  const expected = createHmac('sha256', getSecret(secret)).update(encoded).digest();
  const got = b64urlDecode(sig);
  if (got.length !== expected.length || !timingSafeEqual(got, expected)) return null;
  try {
    const body = JSON.parse(b64urlDecode(encoded).toString('utf8')) as UnsubPayload;
    if (typeof body.exp !== 'number' || body.exp < Math.floor(Date.now() / 1000)) return null;
    if (typeof body.enrollmentId !== 'number' || typeof body.contactId !== 'number') return null;
    return body;
  } catch {
    return null;
  }
}
