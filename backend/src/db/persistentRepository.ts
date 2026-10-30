import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { TransitRepository } from './repository.js';
import { Place } from '../../../packages/shared/src/types/places.js';
import { Bus, Operator, Route } from '../../../packages/shared/src/types/bus.js';
import { ConsentRecord, JourneySession, LocationObservation, AggregatedBusLocation } from '../../../packages/shared/src/types/tracking.js';
import { CommunitySubmission, DuplicateCandidate, OperatorClaimRequest } from '../../../packages/shared/src/types/contribution.js';
import { AuditLogEntry } from '../../../packages/shared/src/types/admin.js';

class PersistentTransitRepository extends TransitRepository {
  private readonly dataFile = resolve(process.env.YATRIBUS_DATA_FILE || 'backend/data/yatribus-store.json');

  constructor() {
    super();
    this.loadFromDisk();
  }

  private loadFromDisk(): void {
    if (!existsSync(this.dataFile)) {
      this.persistToDisk();
      return;
    }
    const raw = readFileSync(this.dataFile, 'utf8');
    const snapshot = JSON.parse(raw) as Record<string, unknown>;
    this.restorePersistentState(snapshot);
  }

  private persistToDisk(): void {
    mkdirSync(dirname(this.dataFile), { recursive: true });
    writeFileSync(this.dataFile, JSON.stringify(this.exportPersistentState()), 'utf8');
  }

  override addPlace(place: Place): Place {
    const result = super.addPlace(place);
    this.persistToDisk();
    return result;
  }

  override addOperator(operator: Operator): Operator {
    const result = super.addOperator(operator);
    this.persistToDisk();
    return result;
  }

  override addRoute(route: Route): Route {
    const result = super.addRoute(route);
    this.persistToDisk();
    return result;
  }

  override updateRoute(route: Route): Route {
    const result = super.updateRoute(route);
    this.persistToDisk();
    return result;
  }

  override addBus(bus: Bus): Bus {
    const result = super.addBus(bus);
    this.persistToDisk();
    return result;
  }

  override recordConsent(record: ConsentRecord): void {
    super.recordConsent(record);
    this.persistToDisk();
  }

  override createJourneySession(session: JourneySession): JourneySession {
    const result = super.createJourneySession(session);
    this.persistToDisk();
    return result;
  }

  override stopJourneySession(sessionId: string, reason: JourneySession['stoppedReason']): boolean {
    const result = super.stopJourneySession(sessionId, reason);
    if (result) this.persistToDisk();
    return result;
  }

  override ingestObservation(obs: LocationObservation): void {
    super.ingestObservation(obs);
    // Persist only the updated bus aggregate/session counters, never raw passenger traces.
    this.persistToDisk();
  }

  override updateBusLocation(busId: string, location: AggregatedBusLocation): void {
    super.updateBusLocation(busId, location);
    this.persistToDisk();
  }

  override createSubmission(submission: CommunitySubmission): CommunitySubmission {
    const result = super.createSubmission(submission);
    this.persistToDisk();
    return result;
  }

  override updateSubmissionReview(id: string, status: CommunitySubmission['status'], reason: string, adminId: string): boolean {
    const result = super.updateSubmissionReview(id, status, reason, adminId);
    if (result) this.persistToDisk();
    return result;
  }

  override createOperatorClaim(claim: OperatorClaimRequest): OperatorClaimRequest {
    const result = super.createOperatorClaim(claim);
    this.persistToDisk();
    return result;
  }

  override addDuplicateCandidate(candidate: DuplicateCandidate): DuplicateCandidate {
    const result = super.addDuplicateCandidate(candidate);
    this.persistToDisk();
    return result;
  }

  override resolveDuplicateCandidate(id: string, status: DuplicateCandidate['status'], adminId: string): boolean {
    const result = super.resolveDuplicateCandidate(id, status, adminId);
    if (result) this.persistToDisk();
    return result;
  }

  override updateAutomationRule(id: string, isEnabled: boolean, params: Record<string, any>): boolean {
    const result = super.updateAutomationRule(id, isEnabled, params);
    if (result) this.persistToDisk();
    return result;
  }

  override createAuditLog(log: AuditLogEntry): void {
    super.createAuditLog(log);
    this.persistToDisk();
  }
}

export const repository = new PersistentTransitRepository();
