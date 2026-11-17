import { createHmac, timingSafeEqual } from 'node:crypto';

export interface StopQrPayload {
  version: 1;
  routeId: string;
  stopId: string;
  issuedAt: number;
  expiresAt: number;
}

function signingKey(secret: string): Buffer {
  if (!secret || secret.length < 32) throw new Error('Stop QR signing secret must contain at least 32 characters.');
  return createHmac('sha256', secret).update('YatraBus:StopQR:v1').digest();
}

export function issueStopQrToken(payload: StopQrPayload, secret: string): string {
  if (!payload.routeId || !payload.stopId || payload.expiresAt <= payload.issuedAt) throw new Error('Invalid stop QR payload.');
  const encoded = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = createHmac('sha256', signingKey(secret)).update(encoded).digest('base64url');
  return 'YB1.' + encoded + '.' + signature;
}

export function verifyStopQrToken(token: string, secret: string, now = Date.now()): StopQrPayload | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3 || parts[0] !== 'YB1' || !parts[1] || !parts[2]) return null;
    const expected = createHmac('sha256', signingKey(secret)).update(parts[1]).digest();
    const received = Buffer.from(parts[2], 'base64url');
    if (received.length !== expected.length || !timingSafeEqual(received, expected)) return null;
    const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8')) as StopQrPayload;
    if (payload.version !== 1 || typeof payload.routeId !== 'string' || typeof payload.stopId !== 'string') return null;
    if (!Number.isFinite(payload.issuedAt) || !Number.isFinite(payload.expiresAt)) return null;
    if (payload.issuedAt > now + 5 * 60 * 1000 || payload.expiresAt <= now || payload.expiresAt <= payload.issuedAt) return null;
    return payload;
  } catch {
    return null;
  }
}
