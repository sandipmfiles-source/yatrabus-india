import { Place } from '../../../packages/shared/src/types/places.js';
import { Bus, Operator, Route } from '../../../packages/shared/src/types/bus.js';
import {
  ConsentRecord,
  JourneySession,
  LocationObservation,
  AggregatedBusLocation,
} from '../../../packages/shared/src/types/tracking.js';
import {
  CommunitySubmission,
  DuplicateCandidate,
  OperatorClaimRequest,
} from '../../../packages/shared/src/types/contribution.js';
import { AdminUser, AuditLogEntry, AutomationRule, SystemHealthStats } from '../../../packages/shared/src/types/admin.js';
import { SEED_PLACES, SEED_OPERATORS, SEED_ROUTES, SEED_BUSES } from './seedData.js';
import { searchPlaces as runSearchPlaces } from '../../../packages/shared/src/search/typoSearch.js';
import { haversineDistanceMeters } from '../../../packages/shared/src/engine/routeMatcher.js';

export class TransitRepository {
  private places: Map<string, Place> = new Map();
  private operators: Map<string, Operator> = new Map();
  private routes: Map<string, Route> = new Map();
  private buses: Map<string, Bus> = new Map();
  private consentRecords: Map<string, ConsentRecord> = new Map();
  private journeySessions: Map<string, JourneySession> = new Map();
  private observations: LocationObservation[] = [];
  private busLocations: Map<string, AggregatedBusLocation> = new Map();
  private submissions: Map<string, CommunitySubmission> = new Map();
  private duplicateCandidates: Map<string, DuplicateCandidate> = new Map();
  private operatorClaims: Map<string, OperatorClaimRequest> = new Map();
  private automationRules: Map<string, AutomationRule> = new Map();
  private auditLogs: AuditLogEntry[] = [];
  private adminUsers: Map<string, AdminUser> = new Map();

  private startTimeMs: number = Date.now();

  constructor() {
    this.seedInitialData();
  }

  private seedInitialData() {
    // Seed Places
    for (const p of SEED_PLACES) {
      this.places.set(p.id, p);
    }
    // Seed Operators
    for (const op of SEED_OPERATORS) {
      this.operators.set(op.id, op);
    }
    // Seed Routes
    for (const r of SEED_ROUTES) {
      this.routes.set(r.id, r);
    }
    // Seed Buses & initial Location Aggregates
    for (const b of SEED_BUSES) {
      this.buses.set(b.id, b);
      this.busLocations.set(b.id, {
        busId: b.id,
        routeId: b.publicIdentifier.includes('534') ? 'route-dtc-534-up' : 'route-dtc-429-up',
        displayState: 'ESTIMATED',
        latitude: 28.6469,
        longitude: 77.3160,
        accuracyMeters: 25,
        bearing: 140,
        speedKmh: 24,
        confidenceCategory: 'MODERATE',
        confidenceScore: 65,
        observationCount: 0,
        independentContributorsCount: 0,
        lastObservedAt: new Date().toISOString(),
        estimatedNextStopName: 'Sarai Kale Khan ISBT',
        estimatedArrivalMinutes: 12,
        isLive: false,
        statusExplanation: 'Scheduled timetable estimate — waiting for passenger GPS corroboration',
        updatedAt: new Date().toISOString(),
      });
    }

    // Seed Default Automation Rules
    const defaultRules: AutomationRule[] = [
      {
        id: 'rule-gps-freshness',
        ruleCode: 'GPS_FRESHNESS_MONITOR',
        name: 'GPS Freshness Enforcer',
        description: 'Marks observations older than 120s as Last Known, and >600s as Unavailable',
        isEnabled: true,
        parameters: { gpsFreshnessLiveSeconds: 120, gpsFreshnessStaleSeconds: 600 },
        updatedAt: new Date().toISOString(),
      },
      {
        id: 'rule-auto-publish-minor',
        ruleCode: 'AUTO_PUBLISH_MINOR_TIMETABLE',
        name: 'Low-Risk Timetable Correction Review',
        description: 'Requires explicit administrator verification for schedule shifts exceeding 15 minutes',
        isEnabled: false,
        parameters: { autoPublishLowRiskMinorCorrections: false },
        updatedAt: new Date().toISOString(),
      },
      {
        id: 'rule-duplicate-scanner',
        ruleCode: 'DUPLICATE_STOP_SCANNER',
        name: 'Duplicate Transit Stops Candidate Generator',
        description: 'Flags stops within 150m with >65% token similarity',
        isEnabled: true,
        parameters: { duplicateSimilarityThreshold: 0.65 },
        updatedAt: new Date().toISOString(),
      },
      {
        id: 'rule-session-safety-expiry',
        ruleCode: 'SESSION_SAFETY_EXPIRY',
        name: '12-Hour Journey Session Enforcer',
        description: 'Terminates journey tracking sessions older than 12 hours automatically',
        isEnabled: true,
        parameters: { maxJourneySessionHours: 12 },
        updatedAt: new Date().toISOString(),
      },
    ];

    for (const rule of defaultRules) {
      this.automationRules.set(rule.id, rule);
    }

    // The sole Super Admin is provisioned from the deployment's ADMIN_EMAIL at server startup.
  }

  // ==================== PLACES ====================
  public searchPlaces(query: string, limit: number = 8) {
    const all = Array.from(this.places.values());
    return runSearchPlaces(query, all, limit);
  }

  public findNearbyStops(lat: number, lon: number, maxDistanceMeters: number = 3000): { place: Place; distanceMeters: number }[] {
    const matches: { place: Place; distanceMeters: number }[] = [];
    for (const p of this.places.values()) {
      if (p.latitude !== undefined && p.longitude !== undefined) {
        const dist = haversineDistanceMeters(lat, lon, p.latitude, p.longitude);
        if (dist <= maxDistanceMeters) {
          matches.push({ place: p, distanceMeters: Math.round(dist) });
        }
      }
    }
    matches.sort((a, b) => a.distanceMeters - b.distanceMeters);
    return matches.slice(0, 10);
  }

  public getPlaceById(id: string): Place | undefined {
    return this.places.get(id);
  }

  public addPlace(place: Place): Place {
    this.places.set(place.id, place);
    return place;
  }

  // ==================== ROUTES & BUSES ====================
  public getAllRoutes(): Route[] {
    return Array.from(this.routes.values());
  }

  public getRouteById(id: string): Route | undefined {
    return this.routes.get(id);
  }

  public getRouteByNumber(routeNumber: string): Route | undefined {
    const normalized = routeNumber.trim().toLowerCase();
    return Array.from(this.routes.values()).find(route => route.routeNumber.trim().toLowerCase() === normalized);
  }

  public getOperatorByName(name: string): Operator | undefined {
    const normalized = name.trim().toLowerCase();
    return Array.from(this.operators.values()).find(operator => operator.name.trim().toLowerCase() === normalized);
  }

  public addOperator(operator: Operator): Operator {
    this.operators.set(operator.id, operator);
    return operator;
  }

  public addRoute(route: Route): Route {
    this.routes.set(route.id, route);
    return route;
  }

  public addTimetableDeparture(routeId: string, departure: NonNullable<Route['departures']>[number], frequencyMinutes?: number): boolean {
    const route = this.routes.get(routeId);
    if (!route) return false;
    const current = route.departures || [];
    const duplicate = current.some(item => item.departureTime === departure.departureTime &&
      (item.busIdentifier || '').toLowerCase() === (departure.busIdentifier || '').toLowerCase() && !item.isCancelled);
    if (duplicate) return false;
    route.departures = [...current, departure].sort((a, b) => a.departureTime.localeCompare(b.departureTime));
    if (Number.isFinite(frequencyMinutes) && frequencyMinutes && frequencyMinutes > 0) route.frequencyMinutes = frequencyMinutes;
    route.updatedAt = new Date().toISOString();
    return true;
  }

  public getBusById(id: string): Bus | undefined {
    return this.buses.get(id);
  }

  public getBusesForRoute(routeId: string): Bus[] {
    const route = this.routes.get(routeId);
    if (!route) return [];
    return Array.from(this.buses.values()).filter(b => b.operatorId === route.operatorId);
  }

  public addBus(bus: Bus): Bus {
    this.buses.set(bus.id, bus);
    return bus;
  }

  // ==================== CONSENT & TRACKING ====================
  public recordConsent(record: ConsentRecord): void {
    this.consentRecords.set(record.sessionId, record);
  }

  public getConsent(sessionId: string): ConsentRecord | undefined {
    return this.consentRecords.get(sessionId);
  }

  public createJourneySession(session: JourneySession): JourneySession {
    this.journeySessions.set(session.sessionId, session);
    return session;
  }

  public getJourneySession(sessionId: string): JourneySession | undefined {
    return this.journeySessions.get(sessionId);
  }

  public stopJourneySession(sessionId: string, reason: JourneySession['stoppedReason']): boolean {
    const sess = this.journeySessions.get(sessionId);
    if (!sess) return false;
    sess.isActive = false;
    sess.stoppedReason = reason;
    sess.lastActiveTime = new Date().toISOString();
    return true;
  }

  public ingestObservation(obs: LocationObservation): void {
    this.observations.push(obs);
    // Increment session counter
    const sess = this.journeySessions.get(obs.sessionId);
    if (sess) {
      sess.observationsContributedCount++;
      sess.lastActiveTime = new Date().toISOString();
    }
  }

  public getDistinctSessionsForBus(busId: string, sinceIso: string): number {
    const sinceMs = new Date(sinceIso).getTime();
    const sessions = new Set<string>();
    for (const obs of this.observations) {
      if (obs.busId === busId && new Date(obs.timestamp).getTime() >= sinceMs) {
        sessions.add(obs.sessionId);
      }
    }
    return sessions.size;
  }

  public getBusLocation(busId: string): AggregatedBusLocation | undefined {
    return this.busLocations.get(busId);
  }

  public updateBusLocation(busId: string, loc: AggregatedBusLocation): void {
    this.busLocations.set(busId, loc);
  }

  // ==================== COMMUNITY SUBMISSIONS ====================
  public createSubmission(submission: CommunitySubmission): CommunitySubmission {
    this.submissions.set(submission.id, submission);
    return submission;
  }

  public getSubmissionByReference(refId: string): CommunitySubmission | undefined {
    for (const sub of this.submissions.values()) {
      if (sub.referenceId.toLowerCase() === refId.toLowerCase()) {
        return sub;
      }
    }
    return undefined;
  }

  public listSubmissions(status?: string): CommunitySubmission[] {
    const all = Array.from(this.submissions.values());
    if (!status) return all;
    return all.filter(s => s.status === status);
  }

  public updateSubmissionReview(id: string, status: CommunitySubmission['status'], reason: string, adminId: string): boolean {
    const sub = this.submissions.get(id);
    if (!sub) return false;
    sub.status = status;
    sub.adminDecisionReason = reason;
    sub.reviewedBy = adminId;
    sub.reviewedAt = new Date().toISOString();
    return true;
  }

  // ==================== OPERATOR CLAIMS ====================
  public createOperatorClaim(claim: OperatorClaimRequest): OperatorClaimRequest {
    this.operatorClaims.set(claim.id, claim);
    return claim;
  }

  public listOperatorClaims(): OperatorClaimRequest[] {
    return Array.from(this.operatorClaims.values());
  }

  // ==================== DUPLICATE CANDIDATES ====================
  public addDuplicateCandidate(cand: DuplicateCandidate): DuplicateCandidate {
    this.duplicateCandidates.set(cand.id, cand);
    return cand;
  }

  public listDuplicateCandidates(): DuplicateCandidate[] {
    return Array.from(this.duplicateCandidates.values());
  }

  public resolveDuplicateCandidate(id: string, status: DuplicateCandidate['status'], adminId: string): boolean {
    const cand = this.duplicateCandidates.get(id);
    if (!cand) return false;
    cand.status = status;
    cand.resolvedBy = adminId;
    cand.resolvedAt = new Date().toISOString();
    return true;
  }

  // ==================== AUTOMATION RULES ====================
  public getAutomationRules(): AutomationRule[] {
    return Array.from(this.automationRules.values());
  }

  public updateAutomationRule(id: string, isEnabled: boolean, params: Record<string, any>): boolean {
    const rule = this.automationRules.get(id);
    if (!rule) return false;
    rule.isEnabled = isEnabled;
    rule.parameters = { ...rule.parameters, ...params };
    rule.updatedAt = new Date().toISOString();
    return true;
  }

  // ==================== AUDIT LOGS ====================
  public createAuditLog(log: AuditLogEntry): void {
    this.auditLogs.unshift(log);
    if (this.auditLogs.length > 500) {
      this.auditLogs.pop();
    }
  }

  public getAuditLogs(limit: number = 50): AuditLogEntry[] {
    return this.auditLogs.slice(0, limit);
  }

  public exportState(): Record<string, unknown> {
    return {
      places: Array.from(this.places.values()),
      operators: Array.from(this.operators.values()),
      routes: Array.from(this.routes.values()),
      buses: Array.from(this.buses.values()),
      consentRecords: Array.from(this.consentRecords.values()),
      journeySessions: Array.from(this.journeySessions.values()),
      observations: this.observations.slice(-10000),
      busLocations: Array.from(this.busLocations.values()),
      submissions: Array.from(this.submissions.values()),
      duplicateCandidates: Array.from(this.duplicateCandidates.values()),
      operatorClaims: Array.from(this.operatorClaims.values()),
      automationRules: Array.from(this.automationRules.values()),
      auditLogs: this.auditLogs.slice(0, 500),
      adminUsers: Array.from(this.adminUsers.values()),
    };
  }

  public importState(snapshot: Record<string, unknown>): void {
    const restore = <T,>(target: Map<string, T>, values: unknown, key: (item: T) => string) => {
      if (!Array.isArray(values)) return;
      for (const item of values as T[]) {
        const id = key(item);
        if (id) target.set(id, item);
      }
    };
    restore(this.places, snapshot.places, item => (item as any).id);
    restore(this.operators, snapshot.operators, item => (item as any).id);
    restore(this.routes, snapshot.routes, item => (item as any).id);
    restore(this.buses, snapshot.buses, item => (item as any).id);
    restore(this.consentRecords, snapshot.consentRecords, item => (item as any).sessionId);
    restore(this.journeySessions, snapshot.journeySessions, item => (item as any).sessionId);
    restore(this.busLocations, snapshot.busLocations, item => (item as any).busId);
    restore(this.submissions, snapshot.submissions, item => (item as any).id);
    restore(this.duplicateCandidates, snapshot.duplicateCandidates, item => (item as any).id);
    restore(this.operatorClaims, snapshot.operatorClaims, item => (item as any).id);
    restore(this.automationRules, snapshot.automationRules, item => (item as any).id);
    restore(this.adminUsers, snapshot.adminUsers, item => (item as any).id);
    if (Array.isArray(snapshot.observations)) this.observations = (snapshot.observations as LocationObservation[]).slice(-10000);
    if (Array.isArray(snapshot.auditLogs)) this.auditLogs = (snapshot.auditLogs as AuditLogEntry[]).slice(0, 500);
  }

  // ==================== ADMIN & HEALTH ====================
  public ensureSuperAdmin(email: string): AdminUser | undefined {
    const normalizedEmail = email.trim().toLowerCase();
    // Enforce a single owner account; never retain seeded or additional admin identities.
    this.adminUsers.clear();
    if (!normalizedEmail) return undefined;
    const owner: AdminUser = {
      id: 'owner-super-admin',
      email: normalizedEmail,
      name: 'YatraBus Owner',
      role: 'SUPER_ADMIN',
      isActive: true,
      createdAt: new Date().toISOString(),
    };
    this.adminUsers.set(owner.id, owner);
    return owner;
  }

  public getAdminByEmail(email: string): AdminUser | undefined {
    for (const u of this.adminUsers.values()) {
      if (u.email.toLowerCase() === email.toLowerCase()) {
        return u;
      }
    }
    return undefined;
  }

  public getSystemHealthStats(): SystemHealthStats {
    const activeSessions = Array.from(this.journeySessions.values()).filter(s => s.isActive).length;
    const liveBuses = Array.from(this.busLocations.values()).filter(b => b.displayState === 'LIVE').length;
    const pendingSubs = Array.from(this.submissions.values()).filter(s => s.status === 'PENDING_REVIEW').length;
    const pendingDups = Array.from(this.duplicateCandidates.values()).filter(d => d.status === 'PENDING').length;

    let scoreSum = 0;
    const locs = Array.from(this.busLocations.values());
    for (const l of locs) {
      scoreSum += l.confidenceScore;
    }
    const avgScore = locs.length > 0 ? Math.round(scoreSum / locs.length) : 0;

    return {
      status: 'HEALTHY',
      uptimeSeconds: Math.floor((Date.now() - this.startTimeMs) / 1000),
      databaseConnected: true,
      totalPlaces: this.places.size,
      totalBuses: this.buses.size,
      totalRoutes: this.routes.size,
      totalStops: Array.from(this.routes.values()).reduce((acc, r) => acc + r.stops.length, 0),
      activeJourneySessionsCount: activeSessions,
      liveBusesTrackingCount: liveBuses,
      pendingSubmissionsCount: pendingSubs,
      pendingDuplicatesCount: pendingDups,
      averageConfidenceScore: avgScore,
    };
  }
}

// Global Singleton Repository instance
export const repository = new TransitRepository();
