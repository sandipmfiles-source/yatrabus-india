import { createHmac, scryptSync, timingSafeEqual } from 'node:crypto';
import { CONFIG } from '../config.js';
import { repository } from '../db/repository.js';
import { AdminRole, AdminUser } from '../../../packages/shared/src/types/admin.js';

type AdminSessionPayload = {
  sub: string;
  email: string;
  role: AdminRole;
  iat: number;
  exp: number;
};

function getSigningSecret(): string | null {
  return CONFIG.ADMIN_JWT_SECRET.length >= 32 ? CONFIG.ADMIN_JWT_SECRET : null;
}

export function verifyAdminPassword(password: string): boolean {
  const [salt, expectedHex, extra] = CONFIG.ADMIN_PASSWORD_HASH.split(':');
  if (!salt || !expectedHex || extra !== undefined || !/^[a-f0-9]{128}$/i.test(expectedHex)) {
    return false;
  }

  try {
    const actual = scryptSync(password, salt, 64);
    const expected = Buffer.from(expectedHex, 'hex');
    return expected.length === actual.length && timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}

export function createAdminSessionToken(admin: AdminUser): string | null {
  const secret = getSigningSecret();
  if (!secret) return null;

  const now = Math.floor(Date.now() / 1000);
  const payload: AdminSessionPayload = {
    sub: admin.id,
    email: admin.email,
    role: admin.role,
    iat: now,
    exp: now + CONFIG.ADMIN_SESSION_TTL_SECONDS,
  };
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = createHmac('sha256', secret).update(encodedPayload).digest('base64url');
  return `${encodedPayload}.${signature}`;
}

function readAdminSession(token: string): AdminSessionPayload | null {
  const secret = getSigningSecret();
  if (!secret) return null;

  const parts = token.split('.');
  if (parts.length !== 2 || !parts[0] || !parts[1]) return null;

  const expected = createHmac('sha256', secret).update(parts[0]).digest();
  let supplied: Buffer;
  try {
    supplied = Buffer.from(parts[1], 'base64url');
  } catch {
    return null;
  }
  if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) return null;

  try {
    const payload = JSON.parse(Buffer.from(parts[0], 'base64url').toString('utf8')) as AdminSessionPayload;
    const now = Math.floor(Date.now() / 1000);
    if (
      !payload.sub ||
      !payload.email ||
      payload.role !== 'SUPER_ADMIN' ||
      !Number.isFinite(payload.exp) ||
      payload.exp <= now ||
      !Number.isFinite(payload.iat) ||
      payload.iat > now + 60
    ) return null;
    return payload;
  } catch {
    return null;
  }
}

export function requireAdminAuth(requiredRole?: AdminRole) {
  return (req: any, res: any, next: any) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Administrator authorization token required',
      });
    }

    const payload = readAdminSession(authHeader.slice(7).trim());
    if (!payload) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Invalid or expired administrator session',
      });
    }

    const admin = repository.getAdminByEmail(payload.email);
    if (
      !admin ||
      !admin.isActive ||
      admin.id !== payload.sub ||
      admin.role !== 'SUPER_ADMIN' ||
      (requiredRole === 'SUPER_ADMIN' && admin.role !== requiredRole)
    ) {
      return res.status(403).json({ error: 'Forbidden', message: 'Administrator access denied' });
    }

    req.admin = admin;
    return next();
  };
}
