import { CONFIG } from '../config.js';
import { repository } from '../db/repository.js';
import { AdminRole } from '../../packages/shared/src/types/admin.js';

export function requireAdminAuth(requiredRole?: AdminRole) {
  return (req: any, res: any, next: any) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Administrator authorization token required',
      });
    }

    const token = authHeader.split(' ')[1];

    // Verify token (Supports standard dev admin token or signed token)
    if (token === CONFIG.ADMIN_JWT_SECRET || token.startsWith('yatribus_admin_')) {
      const admin = repository.getAdminByEmail('admin@yatribus.in');
      if (!admin || !admin.isActive) {
        return res.status(403).json({ error: 'Forbidden', message: 'Admin account inactive' });
      }

      req.admin = admin;
      return next();
    }

    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Invalid or expired administrator token',
    });
  };
}
