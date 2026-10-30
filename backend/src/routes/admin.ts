import { Router, Request, Response } from 'express';
import { CONFIG } from '../config.js';
import { TimetableDeparture } from '../../../packages/shared/src/types/bus.js';
import { repository } from '../db/repository.js';
import { createAdminSessionToken, requireAdminAuth, verifyAdminPassword } from '../middleware/auth.js';

export const adminRouter = Router();

// POST /api/admin/login — one configured Super Admin only.
adminRouter.post('/login', (req: Request, res: Response) => {
  const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
  const password = typeof req.body?.password === 'string' ? req.body.password : '';

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password required' });
  }

  // Fail closed: no development/default credentials are accepted.
  if (!CONFIG.ADMIN_PASSWORD_HASH || CONFIG.ADMIN_JWT_SECRET.length < 32) {
    return res.status(503).json({
      error: 'Admin login is not configured',
      message: 'The owner must configure ADMIN_PASSWORD_HASH and a 32+ character ADMIN_JWT_SECRET.',
    });
  }

  if (email !== CONFIG.ADMIN_EMAIL) {
    return res.status(401).json({ error: 'Invalid administrator credentials' });
  }

  const admin = repository.getAdminByEmail(CONFIG.ADMIN_EMAIL);
  if (!admin || !admin.isActive || admin.role !== 'SUPER_ADMIN' || !verifyAdminPassword(password)) {
    return res.status(401).json({ error: 'Invalid administrator credentials' });
  }

  const token = createAdminSessionToken(admin);
  if (!token) {
    return res.status(503).json({ error: 'Admin session signing is not configured' });
  }

  return res.json({
    token,
    expiresIn: CONFIG.ADMIN_SESSION_TTL_SECONDS,
    user: { id: admin.id, email: admin.email, name: admin.name, role: admin.role },
  });
});

// GET /api/admin/overview
adminRouter.get('/overview', requireAdminAuth('SUPER_ADMIN'), (_req: Request, res: Response) => {
  const health = repository.getSystemHealthStats();
  const recentSubmissions = repository.listSubmissions('PENDING_REVIEW').slice(0, 5);
  const recentAudit = repository.getAuditLogs(5);
  return res.json({ stats: health, recentSubmissions, recentAudit });
});

// GET /api/admin/submissions
adminRouter.get('/submissions', requireAdminAuth('SUPER_ADMIN'), (req: Request, res: Response) => {
  const status = typeof req.query.status === 'string' ? req.query.status : undefined;
  const submissions = repository.listSubmissions(status);
  return res.json({ count: submissions.length, submissions });
});

// POST /api/admin/submissions/:id/review
adminRouter.post('/submissions/:id/review', requireAdminAuth('SUPER_ADMIN'), (req: Request, res: Response) => {
  const { decision, reason } = req.body;
  const adminId = (req as any).admin.id;

  if (!decision || !['ADMIN_VERIFIED', 'COMMUNITY_CORROBORATED', 'REJECTED'].includes(decision)) {
    return res.status(400).json({ error: 'Valid review decision required' });
  }

  const reviewReason = typeof reason === 'string' ? reason.trim().slice(0, 1000) : '';

  // Only an explicit, admin-approved timetable contribution becomes publicly searchable.
  const pendingSubmission = repository.listSubmissions().find(item => item.id === String(req.params.id));
  if (decision === 'ADMIN_VERIFIED' && pendingSubmission?.proposedData?.timetableEntry === true) {
    const data = pendingSubmission.proposedData;
    const route = typeof data.routeNumber === 'string' ? repository.getRouteByNumber(data.routeNumber) : undefined;
    if (!route) {
      return res.status(422).json({ error: 'Route number was not found. Add and verify the route before approving this bus timetable entry.' });
    }
    if (typeof data.departureTime !== 'string' || !/^([01]\d|2[0-3]):[0-5]\d$/.test(data.departureTime) ||
        typeof data.arrivalTime !== 'string' || !/^([01]\d|2[0-3]):[0-5]\d$/.test(data.arrivalTime)) {
      return res.status(422).json({ error: 'A valid departure and arrival time are required before publishing.' });
    }
    const days = Array.isArray(data.operatingDays)
      ? data.operatingDays.filter((day: string) => ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'].includes(day))
      : ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'];
    const departure: TimetableDeparture = {
      id: `departure-${pendingSubmission.id}`,
      timetableId: route.id,
      departureTime: data.departureTime,
      arrivalTime: data.arrivalTime,
      busIdentifier: typeof data.busIdentifier === 'string' ? data.busIdentifier.trim().slice(0, 80) : undefined,
      operatingDays: days.length ? days : ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'],
      confidenceScore: 100,
      isCancelled: false,
    };
    if (!repository.addTimetableDeparture(route.id, departure)) {
      return res.status(409).json({ error: 'This bus and departure time already exist on the selected route.' });
    }
  }

  const success = repository.updateSubmissionReview(
    String(req.params.id),
    decision,
    reviewReason || 'Reviewed by Super Admin',
    adminId
  );
  if (!success) return res.status(404).json({ error: 'Submission not found' });

  repository.createAuditLog({
    id: `audit-${Date.now()}`,
    entityType: 'SUBMISSION',
    entityId: String(req.params.id),
    action: decision === 'REJECTED' ? 'DELETE' : 'VERIFY',
    actorId: adminId,
    actorRole: 'SUPER_ADMIN',
    reason: reviewReason || undefined,
    timestamp: new Date().toISOString(),
  });

  return res.json({ success: true, message: `Submission marked as ${decision}` });
});

// GET /api/admin/duplicates
adminRouter.get('/duplicates', requireAdminAuth('SUPER_ADMIN'), (_req: Request, res: Response) => {
  const candidates = repository.listDuplicateCandidates();
  return res.json({ count: candidates.length, candidates });
});

// POST /api/admin/duplicates/:id/resolve
adminRouter.post('/duplicates/:id/resolve', requireAdminAuth('SUPER_ADMIN'), (req: Request, res: Response) => {
  const { resolution } = req.body;
  const adminId = (req as any).admin.id;
  if (!['MERGED', 'REJECTED_DIFFERENT'].includes(resolution)) {
    return res.status(400).json({ error: 'Valid duplicate resolution required' });
  }
  const success = repository.resolveDuplicateCandidate(String(req.params.id), resolution, adminId);
  if (!success) return res.status(404).json({ error: 'Duplicate candidate not found' });
  return res.json({ success: true, resolution });
});

// GET /api/admin/automation/rules
adminRouter.get('/automation/rules', requireAdminAuth('SUPER_ADMIN'), (_req: Request, res: Response) => {
  const rules = repository.getAutomationRules();
  return res.json({ count: rules.length, rules });
});

// PUT /api/admin/automation/rules/:id
adminRouter.put('/automation/rules/:id', requireAdminAuth('SUPER_ADMIN'), (req: Request, res: Response) => {
  const { isEnabled, parameters } = req.body;
  if (typeof isEnabled !== 'boolean') {
    return res.status(400).json({ error: 'isEnabled must be a boolean' });
  }
  const success = repository.updateAutomationRule(String(req.params.id), isEnabled, parameters || {});
  if (!success) return res.status(404).json({ error: 'Automation rule not found' });
  return res.json({ success: true, message: 'Automation rule updated' });
});

// GET /api/admin/audit-logs
adminRouter.get('/audit-logs', requireAdminAuth('SUPER_ADMIN'), (req: Request, res: Response) => {
  const requestedLimit = req.query.limit ? parseInt(req.query.limit as string, 10) : 50;
  const limit = Number.isFinite(requestedLimit) ? Math.min(200, Math.max(1, requestedLimit)) : 50;
  const logs = repository.getAuditLogs(limit);
  return res.json({ count: logs.length, logs });
});

// GET /api/admin/health — private; never expose internal admin health publicly.
adminRouter.get('/health', requireAdminAuth('SUPER_ADMIN'), (_req: Request, res: Response) => {
  return res.json(repository.getSystemHealthStats());
});
