import { Router, Request, Response } from 'express';
import { createHash } from 'node:crypto';
import { repository } from '../db/repository.js';
import { checkDuplicateStop, checkDuplicateRoute } from '../../../packages/shared/src/engine/duplicateDetector.js';
import { contributionLimiter } from '../middleware/rateLimiter.js';

export const contributionsRouter = Router();

// POST /api/contributions/submit
// Account-free submission with duplicate checking and reference ID generation
contributionsRouter.post('/submit', contributionLimiter, (req: Request, res: Response) => {
  const { submissionType, entityType, targetEntityId, contributorNote, proposedData } = req.body;

  if (!submissionType || !entityType || !proposedData) {
    return res.status(400).json({
      error: 'Missing required parameters: submissionType, entityType, and proposedData required',
    });
  }

  // Generate public tracking reference ID: e.g. YB-SUB-2026-4821
  const randomSuffix = Math.floor(1000 + Math.random() * 9000);
  const referenceId = `YB-SUB-2026-${randomSuffix}`;

  const duplicateCandidateIds: string[] = [];

  // Check for potential duplicates
  if (entityType === 'STOP' && proposedData.name && proposedData.latitude && proposedData.longitude) {
    const nearby = repository.findNearbyStops(proposedData.latitude, proposedData.longitude, 500);
    for (const item of nearby) {
      const dupCheck = checkDuplicateStop(
        { name: proposedData.name, latitude: proposedData.latitude, longitude: proposedData.longitude },
        { name: item.place.canonicalName, latitude: item.place.latitude || 0, longitude: item.place.longitude || 0 }
      );

      if (dupCheck.isLikelyDuplicate) {
        const cand = repository.addDuplicateCandidate({
          id: `dup-${Date.now()}-${item.place.id}`,
          entityType: 'STOP',
          primaryEntityId: item.place.id,
          secondaryEntityId: referenceId,
          similarityScore: dupCheck.similarityScore,
          matchingFactors: dupCheck.matchingFactors,
          status: 'PENDING',
          createdAt: new Date().toISOString(),
        });
        duplicateCandidateIds.push(cand.id);
      }
    }
  }

  // Create submission record
  const submission = repository.createSubmission({
    id: `sub-${Date.now()}`,
    referenceId,
    submissionType,
    entityType,
    targetEntityId,
    contributorNote,
    proposedData,
    status: 'PENDING_REVIEW',
    corroborationCount: 0,
    sourceCategory: 'PUBLIC',
    duplicateCandidateIds,
    createdAt: new Date().toISOString(),
  });

  return res.json({
    success: true,
    referenceId: submission.referenceId,
    status: submission.status,
    duplicateWarnings: duplicateCandidateIds.length > 0 ? 'Potential duplicate detected and flagged for verifier review' : null,
    message: 'Contribution received successfully. You can check review progress anytime using your Reference ID without an account.',
  });
});



// POST /api/contributions/vote/:refId — one anonymous correction vote per app/browser install.
contributionsRouter.post('/vote/:refId', contributionLimiter, (req: Request, res: Response) => {
  const submission = repository.getSubmissionByReference(String(req.params.refId));
  if (!submission || submission.sourceCategory === 'OPERATOR') return res.status(404).json({ error: 'Correction not found' });
  if (submission.status !== 'PENDING_REVIEW' && submission.status !== 'COMMUNITY_CORROBORATED') {
    return res.status(409).json({ error: 'This correction is no longer open for voting' });
  }
  const field = typeof req.body?.field === 'string' ? req.body.field.trim() : '';
  const value = typeof req.body?.value === 'string' ? req.body.value.trim() : '';
  const visitorId = typeof req.body?.visitorId === 'string' ? req.body.visitorId : '';
  if (!field || !value || visitorId.length < 16 || visitorId.length > 128 ||
      submission.proposedData?.field !== field || String(submission.proposedData?.value || '') !== value) {
    return res.status(400).json({ error: 'A correction field, proposed value and anonymous visitor ID are required' });
  }
  const voterKey = createHash('sha256').update(visitorId).digest('hex');
  const result = repository.recordSubmissionVote(submission.id, voterKey, field, value);
  if (!result.success) return res.status(409).json({ error: result.error });
  return res.json({ success: true, counts: result.counts, message: 'Your community vote was counted.' });
});



// GET /api/contributions/corrections/:routeId — anonymous timetable suggestions and vote totals.
contributionsRouter.get('/corrections/:routeId', (req: Request, res: Response) => {
  const corrections = repository.listSubmissions().filter(item =>
    item.targetEntityId === String(req.params.routeId) &&
    item.submissionType === 'CORRECT_TIMETABLE' && item.sourceCategory !== 'OPERATOR' &&
    typeof item.proposedData?.field === 'string' && typeof item.proposedData?.value === 'string' &&
    (item.status === 'PENDING_REVIEW' || item.status === 'COMMUNITY_CORROBORATED')
  );
  const totals: Record<string, { field: string; value: string; votes: number }> = {};
  for (const correction of corrections) {
    for (const [key, count] of Object.entries(correction.communityVotes || {})) {
      const split = key.indexOf(':');
      if (split < 1) continue;
      const field = key.slice(0, split);
      const value = key.slice(split + 1);
      const totalKey = field + ':' + value;
      totals[totalKey] = totals[totalKey] || { field, value, votes: 0 };
      totals[totalKey].votes += count;
    }
  }
  const consensus = Object.values(totals).sort((a, b) => b.votes - a.votes)[0] || null;
  return res.json({ corrections, consensus });
});

// GET /api/contributions/status/:refId
// Public check of review status without account
contributionsRouter.get('/status/:refId', (req: Request, res: Response) => {
  const sub = repository.getSubmissionByReference(String(req.params.refId));
  if (!sub) {
    return res.status(404).json({
      error: 'Submission reference ID not found. Please verify the code.',
    });
  }

  return res.json({
    referenceId: sub.referenceId,
    submissionType: sub.submissionType,
    entityType: sub.entityType,
    status: sub.status,
    adminDecisionReason: sub.adminDecisionReason || null,
    submittedAt: sub.createdAt,
    reviewedAt: sub.reviewedAt || null,
  });
});

// Account-free operator/owner submissions are routed to a separate Super Admin review queue.
contributionsRouter.post('/operator-submit', contributionLimiter, (req: Request, res: Response) => {
  const { submissionType, entityType, targetEntityId, contributorNote, proposedData } = req.body || {};
  const contactName = typeof req.body?.contactName === 'string' ? req.body.contactName.trim().slice(0, 100) : '';
  const contactPhone = typeof req.body?.contactPhone === 'string' ? req.body.contactPhone.trim().slice(0, 30) : '';
  const operatorName = typeof req.body?.operatorName === 'string' ? req.body.operatorName.trim().slice(0, 120) : '';
  const officialEmail = typeof req.body?.officialEmail === 'string' ? req.body.officialEmail.trim().slice(0, 160) : '';
  const allowed: string[] = ['ADD_BUS', 'ADD_STOP', 'SUGGEST_ROUTE', 'CORRECT_TIMETABLE', 'REPORT_CHANGED_ROUTE', 'REPORT_DISCONTINUED', 'ADD_INTERMEDIATE_STOP', 'DELETE_BUS'];
  if (!allowed.includes(submissionType) || !['BUS', 'ROUTE', 'TIMETABLE', 'STOP'].includes(entityType) ||
      !proposedData || typeof proposedData !== 'object' || Array.isArray(proposedData) ||
      contactName.length < 2 || operatorName.length < 2 || contactPhone.replace(/\D/g, '').length < 10) {
    return res.status(400).json({ error: 'Provide a valid submission, operator name, contact person and 10-digit contact phone.' });
  }
  const referenceId = 'YB-OWN-' + Math.floor(100000 + Math.random() * 900000).toString();
  const now = new Date().toISOString();
  const submission = repository.createSubmission({
    id: 'operator-sub-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8),
    referenceId,
    submissionType,
    entityType,
    targetEntityId: typeof targetEntityId === 'string' ? targetEntityId.slice(0, 120) : undefined,
    contributorNote: typeof contributorNote === 'string' ? contributorNote.slice(0, 1000) : undefined,
    proposedData: { ...proposedData, operatorName, operatorContactName: contactName, operatorContactPhone: contactPhone, officialEmail },
    status: 'PENDING_REVIEW',
    corroborationCount: 0,
    createdAt: now,
    sourceCategory: 'OPERATOR',
    contributorDisplayName: contactName,
  });
  return res.status(201).json({
    success: true,
    referenceId: submission.referenceId,
    status: submission.status,
    message: 'Owner submission received without sign-in. It is waiting in the separate Super Admin owner-review queue.',
  });
});

// POST /api/contributions/operator-claim
contributionsRouter.post('/operator-claim', (req: Request, res: Response) => {
  const { operatorId, operatorName, claimantName, claimantRole, officialEmail, contactNumber, proofDocumentNote } = req.body;

  if (!operatorName || !claimantName || !contactNumber) {
    return res.status(400).json({ error: 'Missing mandatory operator claim details' });
  }

  const claim = repository.createOperatorClaim({
    id: `claim-${Date.now()}`,
    operatorId: operatorId || 'op-custom-new',
    operatorName,
    claimantName,
    claimantRole: claimantRole || 'Fleet Owner / Manager',
    officialEmail,
    contactNumber,
    proofDocumentNote,
    status: 'PENDING',
    createdAt: new Date().toISOString(),
  });

  return res.json({
    success: true,
    claimId: claim.id,
    message: 'Operator claim received. A transit verifier will review the submission.',
  });
});
