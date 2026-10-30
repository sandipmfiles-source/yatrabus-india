import { createHmac, timingSafeEqual } from 'node:crypto';
import { CONFIG } from '../config.js';
import { repository } from '../db/persistentRepository.js';
import { AdminRole, AdminUser } from '../../../packages/shared/src/types/admin.js';

interface AdminTokenPayload {
  sub: string;
  email: string;
  role: AdminRole;
  exp: number;
}

function signature(payload: string): string {
  return createHmac('sha256', CONFIG.ADMIN_JWT_SECRET).update(payload).digest('base64url');
}

export function createAdminToken(admin: AdminUser): string {
  const payload: AdminTokenPayload = {
    sub: admin.id,
    email: admin.email,
    role: admin.role,
    exp: Math.floor(Date.now() / 1000) + 12 * 60 * 60,
  };
  const encoded = Buffer.from(JSON.stringify(payload)).toString('base64url');
  return `${encoded}.${signature(encoded)}`;
}

function verifyAdminToken(token: string): AdminTokenPayload | null {
  const [encoded, suppliedSignature, extra] = token.split('.');
  if (!encoded || !suppliedSignature || extra) return null;
  const expected = Buffer.from(signature(encoded));
  const supplied = Buffer.from(suppliedSignature);
  if (expected.length !== supplied.length || !timingSafeEqual(expected, supplied)) return null;
  try {
    const payload = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8')) as AdminTokenPayload;
    if (!payload.sub || !payload.email || !payload.exp || payload.exp <= Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}

export function requireAdminAuth(requiredRole?: AdminRole) {
  return (req: any, res: any, next: any) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Unauthorized', message: 'Administrator authorization token required' });
    }

    const payload = verifyAdminToken(authHeader.slice(7).trim());
    if (!payload) {
      return res.status(401).json({ error: 'Unauthorized', message: 'Invalid or expired administrator token' });
    }

    const admin = repository.getAdminByEmail(payload.email);
    if (!admin || !admin.isActive || admin.id !== payload.sub || admin.role !== payload.role) {
      return res.status(403).json({ error: 'Forbidden', message: 'Administrator account inactive or changed' });
    }

    const roleLevel: Record<AdminRole, number> = {
      TRANSIT_VERIFIER: 1,
      STATE_MODERATOR: 2,
      SUPER_ADMIN: 3,
    };
    if (requiredRole && roleLevel[admin.role] < roleLevel[requiredRole]) {
      return res.status(403).json({ error: 'Forbidden', message: 'Insufficient administrator role' });
    }

    req.admin = admin;
    return next();
  };
}
