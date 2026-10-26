/**
 * Operator Claims & Verification Management Service
 * Allows bus operators to claim their public listings, propose official timetables,
 * and request contact corrections without paying listing fees.
 */

export interface OperatorClaimRequest {
  id: string; // e.g. OPR-CLM-2026-XXXX
  operatorId: string;
  claimantName: string;
  claimantDesignation: string; // e.g. "Depot Manager", "Fleet Operations Head", "Owner"
  officialPhone: string;
  officialEmail: string;
  supportingDocumentsNote?: string;
  status: 'pending_review' | 'verified' | 'rejected';
  submittedAt: string;
  reviewedAt?: string;
  reviewedBy?: string;
  adminRemarks?: string;
}

export class OperatorClaimService {
  private static claims: Map<string, OperatorClaimRequest> = new Map();

  public static submitClaim(
    operatorId: string,
    claimantName: string,
    claimantDesignation: string,
    officialPhone: string,
    officialEmail: string,
    supportingDocumentsNote?: string
  ): OperatorClaimRequest {
    const id = `OPR-CLM-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;

    const claim: OperatorClaimRequest = {
      id,
      operatorId,
      claimantName,
      claimantDesignation,
      officialPhone,
      officialEmail,
      supportingDocumentsNote,
      status: 'pending_review',
      submittedAt: new Date().toISOString()
    };

    this.claims.set(id, claim);
    return claim;
  }

  public static getClaimById(id: string): OperatorClaimRequest | undefined {
    return this.claims.get(id);
  }

  public static getAllClaims(status?: string): OperatorClaimRequest[] {
    const list = Array.from(this.claims.values());
    if (status) return list.filter(c => c.status === status);
    return list.sort((a, b) => b.submittedAt.localeCompare(a.submittedAt));
  }

  public static reviewClaim(
    id: string,
    decision: 'verified' | 'rejected',
    remarks: string,
    reviewerId: string = 'admin'
  ): OperatorClaimRequest | null {
    const claim = this.claims.get(id);
    if (!claim) return null;

    claim.status = decision;
    claim.reviewedAt = new Date().toISOString();
    claim.reviewedBy = reviewerId;
    claim.adminRemarks = remarks;
    return claim;
  }
}
