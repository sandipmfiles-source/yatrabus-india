import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto';
import { Router, Request, Response, NextFunction } from 'express';
import { CONFIG } from '../config.js';
import { repository } from '../db/repository.js';
import { contributionLimiter } from '../middleware/rateLimiter.js';
import { CommunitySubmission, SubmissionType } from '../../../packages/shared/src/types/contribution.js';

type OwnerIdentity = { sub: string; email: string; name: string; exp: number };
const router = Router();

function sign(payload: OwnerIdentity): string {
  const encoded = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = createHmac('sha256', CONFIG.OWNER_JWT_SECRET).update(encoded).digest('base64url');
  return encoded + '.' + signature;
}

function readToken(token: string): OwnerIdentity | null {
  if (CONFIG.OWNER_JWT_SECRET.length < 32) return null;
  const [encoded, suppliedText, extra] = token.split('.');
  if (!encoded || !suppliedText || extra !== undefined) return null;
  const expected = createHmac('sha256', CONFIG.OWNER_JWT_SECRET).update(encoded).digest();
  const supplied = Buffer.from(suppliedText, 'base64url');
  if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) return null;
  try {
    const payload = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8')) as OwnerIdentity;
    if (!payload.sub || !payload.email || !payload.name || !Number.isFinite(payload.exp) || payload.exp <= Date.now() / 1000) return null;
    return payload;
  } catch { return null; }
}

function requireOwner(req: Request & { owner?: OwnerIdentity }, res: Response, next: NextFunction) {
  const header = req.headers.authorization || '';
  const payload = header.startsWith('Bearer ') ? readToken(header.slice(7).trim()) : null;
  if (!payload) return res.status(401).json({ error: 'Owner sign-in required', message: 'Please sign in with your verified Google account.' });
  req.owner = payload;
  return next();
}

// Google Identity Services sends a signed ID token credential. The backend verifies
// its audience and verified email with Google's tokeninfo endpoint before issuing
// a separate YatraBus owner session.
router.post('/auth/google', async (req: Request, res: Response) => {
  const credential = typeof req.body?.credential === 'string' ? req.body.credential : '';
  if (!credential || credential.length > 10000) return res.status(400).json({ error: 'Google credential is required' });
  if (!CONFIG.GOOGLE_OAUTH_CLIENT_ID || CONFIG.OWNER_JWT_SECRET.length < 32) {
    return res.status(503).json({ error: 'Owner sign-in is not configured', message: 'The service owner must configure GOOGLE_OAUTH_CLIENT_ID and a 32+ character OWNER_JWT_SECRET.' });
  }

  try {
    const response = await fetch('https://oauth2.googleapis.com/tokeninfo?id_token=' + encodeURIComponent(credential), {
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) return res.status(401).json({ error: 'Google sign-in could not be verified' });
    const identity = await response.json() as Record<string, string>;
    if (identity.aud !== CONFIG.GOOGLE_OAUTH_CLIENT_ID || identity.email_verified !== 'true' ||
        !identity.sub || !identity.email || !identity.name) {
      return res.status(401).json({ error: 'Google account verification failed' });
    }
    const owner: OwnerIdentity = {
      sub: identity.sub,
      email: identity.email.toLowerCase(),
      name: identity.name.slice(0, 100),
      exp: Math.floor(Date.now() / 1000) + CONFIG.OWNER_SESSION_TTL_SECONDS,
    };
    return res.json({
      token: sign(owner),
      expiresIn: CONFIG.OWNER_SESSION_TTL_SECONDS,
      user: { id: owner.sub, email: owner.email, name: owner.name },
    });
  } catch {
    return res.status(503).json({ error: 'Google sign-in is temporarily unavailable' });
  }
});

router.get('/me', requireOwner, (req: Request & { owner?: OwnerIdentity }, res: Response) => {
  return res.json({ user: req.owner });
});

router.get('/me/submissions', requireOwner, (req: Request & { owner?: OwnerIdentity }, res: Response) => {
  const submissions = repository.listSubmissions()
    .filter(item => item.sourceCategory === 'OPERATOR' && item.contributorEmail === req.owner?.email)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return res.json({ count: submissions.length, submissions });
});

// Owners can submit bus, route, timetable, correction and deletion requests.
// These requests are never published directly; the Super Admin must approve them.
router.post('/submissions', requireOwner, contributionLimiter, (req: Request & { owner?: OwnerIdentity }, res: Response) => {
  const allowed: SubmissionType[] = ['ADD_BUS', 'SUGGEST_ROUTE', 'CORRECT_TIMETABLE', 'DELETE_BUS', 'ADD_INTERMEDIATE_STOP'];
  const submissionType = req.body?.submissionType as SubmissionType;
  const entityType = req.body?.entityType;
  const proposedData = req.body?.proposedData;
  if (!allowed.includes(submissionType) || !['BUS', 'ROUTE', 'TIMETABLE', 'STOP'].includes(entityType) ||
      !proposedData || typeof proposedData !== 'object' || Array.isArray(proposedData)) {
    return res.status(400).json({ error: 'A valid submission type, entity type and details are required' });
  }
  const now = new Date().toISOString();
  const id = 'operator-sub-' + randomUUID();
  const referenceId = 'YB-OWN-' + randomUUID().slice(0, 8).toUpperCase();
  const submission: CommunitySubmission = {
    id, referenceId, submissionType, entityType,
    targetEntityId: typeof req.body.targetEntityId === 'string' ? req.body.targetEntityId.slice(0, 120) : undefined,
    contributorNote: typeof req.body.contributorNote === 'string' ? req.body.contributorNote.slice(0, 1000) : undefined,
    proposedData,
    status: 'PENDING_REVIEW',
    corroborationCount: 0,
    createdAt: now,
    sourceCategory: 'OPERATOR',
    contributorEmail: req.owner!.email,
    contributorDisplayName: req.owner!.name,
  };
  repository.createSubmission(submission);
  return res.status(201).json({
    success: true,
    referenceId,
    status: submission.status,
    message: 'Your operator submission has been sent for separate Super Admin approval.',
  });
});

export const operatorsRouter = router;
