import { Router, Request, Response } from 'express';
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
    corroborationCount: 1,
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
