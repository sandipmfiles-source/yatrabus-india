import { Router, Request, Response } from 'express';
import { repository } from '../db/repository.js';
import { requireAdminAuth } from '../middleware/auth.js';
import { CONFIG } from '../config.js';

export const adminRouter = Router();

// POST /api/admin/login
adminRouter.post('/login', (req: Request, res: Response) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password required' });
  }

  const admin = repository.getAdminByEmail(email);
  if (!admin) {
    return res.status(401).json({ error: 'Invalid administrator credentials' });
  }

  // Generate bearer session token
  const token = `yatribus_admin_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

  return res.json({
    token,
    user: {
      id: admin.id,
      email: admin.email,
      name: admin.name,
      role: admin.role,
    },
  });
});

// GET /api/admin/overview
adminRouter.get('/overview', requireAdminAuth(), (req: Request, res: Response) => {
  const health = repository.getSystemHealthStats();
  const recentSubmissions = repository.listSubmissions('PENDING_REVIEW').slice(0, 5);
  const recentAudit = repository.getAuditLogs(5);

  return res.json({
    stats: health,
    recentSubmissions,
    recentAudit,
  });
});

// GET /api/admin/submissions
adminRouter.get('/submissions', requireAdminAuth(), (req: Request, res: Response) => {
  const status = req.query.status as string;
  const submissions = repository.listSubmissions(status);
  return res.json({ count: submissions.length, submissions });
});

// POST /api/admin/submissions/:id/review
adminRouter.post('/submissions/:id/review', requireAdminAuth(), (req: Request, res: Response) => {
  const { decision, reason } = req.body; // 'COMMUNITY_CORROBORATED' | 'ADMIN_VERIFIED' | 'REJECTED'
  const adminId = (req as any).admin?.id || 'admin-default';

  if (!decision || !['ADMIN_VERIFIED', 'COMMUNITY_CORROBORATED', 'REJECTED'].includes(decision)) {
    return res.status(400).json({ error: 'Valid review decision required' });
  }

  const success = repository.updateSubmissionReview(req.params.id, decision, reason || 'Reviewed by administrator', adminId);
  if (!success) {
    return res.status(404).json({ error: 'Submission not found' });
  }

  repository.createAuditLog({
    id: `audit-${Date.now()}`,
    entityType: 'SUBMISSION',
    entityId: req.params.id,
    action: decision === 'REJECTED' ? 'DELETE' : 'VERIFY',
    actorId: adminId,
    actorRole: 'SUPER_ADMIN',
    reason,
    timestamp: new Date().toISOString(),
  });

  return res.json({ success: true, message: `Submission marked as ${decision}` });
});

// GET /api/admin/duplicates
adminRouter.get('/duplicates', requireAdminAuth(), (req: Request, res: Response) => {
  const candidates = repository.listDuplicateCandidates();
  return res.json({ count: candidates.length, candidates });
});

// POST /api/admin/duplicates/:id/resolve
adminRouter.post('/duplicates/:id/resolve', requireAdminAuth(), (req: Request, res: Response) => {
  const { resolution } = req.body; // 'MERGED' | 'REJECTED_DIFFERENT'
  const adminId = (req as any).admin?.id || 'admin-default';

  const success = repository.resolveDuplicateCandidate(req.params.id, resolution, adminId);
  if (!success) {
    return res.status(404).json({ error: 'Duplicate candidate not found' });
  }

  return res.json({ success: true, resolution });
});

// GET /api/admin/automation/rules
adminRouter.get('/automation/rules', requireAdminAuth(), (req: Request, res: Response) => {
  const rules = repository.getAutomationRules();
  return res.json({ count: rules.length, rules });
});

// PUT /api/admin/automation/rules/:id
adminRouter.put('/automation/rules/:id', requireAdminAuth(), (req: Request, res: Response) => {
  const { isEnabled, parameters } = req.body;

  const success = repository.updateAutomationRule(req.params.id, isEnabled, parameters || {});
  if (!success) {
    return res.status(404).json({ error: 'Automation rule not found' });
  }

  return res.json({ success: true, message: 'Automation rule updated' });
});

// GET /api/admin/audit-logs
adminRouter.get('/audit-logs', requireAdminAuth(), (req: Request, res: Response) => {
  const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 50;
  const logs = repository.getAuditLogs(limit);
  return res.json({ count: logs.length, logs });
});

// GET /api/admin/health
adminRouter.get('/health', (req: Request, res: Response) => {
  const health = repository.getSystemHealthStats();
  return res.json(health);
});
