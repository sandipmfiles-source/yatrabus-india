/**
 * YatriBus Shared Types - Community Contributions, Duplicate Candidates & Moderation
 */
export type SubmissionType =
  | 'ADD_BUS' | 'ADD_STOP' | 'SUGGEST_ROUTE' | 'UPDATE_ROUTE' | 'CORRECT_TIMETABLE'
  | 'REPORT_CHANGED_ROUTE' | 'REPORT_DISCONTINUED' | 'ADD_INTERMEDIATE_STOP'
  | 'OPERATOR_CLAIM' | 'CONFIRM_DISPUTE' | 'DELETE_BUS';

export type SubmissionStatus =
  | 'PENDING_REVIEW' | 'COMMUNITY_CORROBORATED' | 'ADMIN_VERIFIED' | 'REJECTED' | 'MERGED';

export interface CommunitySubmission {
  id: string;
  referenceId: string;
  submissionType: SubmissionType;
  entityType: 'BUS' | 'ROUTE' | 'STOP' | 'OPERATOR' | 'TIMETABLE';
  targetEntityId?: string;
  contributorNote?: string;
  proposedData: Record<string, any>;
  existingSnapshot?: Record<string, any>;
  status: SubmissionStatus;
  adminDecisionReason?: string;
  corroborationCount: number;
  duplicateCandidateIds?: string[];
  reviewedBy?: string;
  reviewedAt?: string;
  createdAt: string;
  /** Public passenger edits and verified operator submissions are reviewed separately. */
  sourceCategory?: 'PUBLIC' | 'OPERATOR';
  contributorEmail?: string;
  contributorDisplayName?: string;
  communityVotes?: Record<string, number>;
  voterKeys?: string[];
}

export interface DuplicateCandidate {
  id: string;
  entityType: 'BUS' | 'ROUTE' | 'STOP' | 'OPERATOR';
  primaryEntityId: string;
  secondaryEntityId: string;
  similarityScore: number;
  matchingFactors: string[];
  status: 'PENDING' | 'MERGED' | 'REJECTED_DIFFERENT';
  resolvedBy?: string;
  resolvedAt?: string;
  createdAt: string;
}

export interface OperatorClaimRequest {
  id: string;
  operatorId: string;
  operatorName: string;
  claimantName: string;
  claimantRole: string;
  officialEmail?: string;
  contactNumber: string;
  proofDocumentNote?: string;
  status: 'PENDING' | 'VERIFIED' | 'REJECTED';
  adminNotes?: string;
  createdAt: string;
}
