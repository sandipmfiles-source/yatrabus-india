/**
 * Repository / Data Access Layer for YatraBus India
 * Provides a unified abstraction over PostgreSQL persistence and in-memory DataStore.
 * Ensures zero-cost local development and full PostgreSQL production persistence.
 */

import {
  Place,
  Operator,
  Bus,
  Route,
  TimetableDeparture,
  LocationObservation,
  JourneySession,
  CommunitySubmission,
  AuditLogEntry,
  AutomationRule,
  ETAResult,
  SystemHealthMetrics
} from '../../types';

import { dataStore, DataStore } from '../db/dataStore';
import { getDatabasePool, isUsingPostgres } from '../db/db';

export interface IBusRepository {
  getPlaceById(id: string): Promise<Place | undefined>;
  getAllPlaces(): Promise<Place[]>;
  searchPlaces(query: string, limit?: number): Promise<{ place: Place; score: number }[]>;
  getNearbyPlaces(lat: number, lng: number, radiusKm?: number, limit?: number): Promise<(Place & { distanceKm: number })[]>;

  getRouteById(id: string): Promise<Route | undefined>;
  getAllRoutes(): Promise<Route[]>;
  findRoutes(originId: string, destId: string): Promise<{ directRoutes: Route[]; transferRoutes: any[] }>;

  getTimetablesByRoute(routeId: string): Promise<TimetableDeparture[]>;
  calculateETA(routeId: string, stopId: string): Promise<ETAResult>;

  getAllBuses(): Promise<Bus[]>;
  getBusById(id: string): Promise<Bus | undefined>;
  getAllOperators(): Promise<Operator[]>;

  startJourneySession(busId: string, routeId: string, consentGiven: boolean): Promise<JourneySession>;
  stopJourneySession(sessionId: string): Promise<boolean>;
  getSession(sessionId: string): Promise<JourneySession | undefined>;
  ingestLocationObservation(
    sessionId: string,
    busId: string,
    routeId: string,
    lat: number,
    lng: number,
    accuracy: number,
    speed?: number,
    heading?: number,
    timestampStr?: string
  ): Promise<{ observation: LocationObservation; accepted: boolean; message: string }>;
  getLatestBusLocation(busId: string): Promise<LocationObservation | undefined>;

  createSubmission(type: any, data: any, notes?: string, ref?: string): Promise<{ submission: CommunitySubmission; duplicateCandidates: any[] }>;
  getSubmissionById(id: string): Promise<CommunitySubmission | undefined>;
  getAllSubmissions(status?: string): Promise<CommunitySubmission[]>;
  reviewSubmission(id: string, action: 'approved' | 'rejected' | 'merged', remarks: string, reviewerId?: string): Promise<CommunitySubmission | null>;

  getAuditLogs(): Promise<AuditLogEntry[]>;
  addAuditLog(action: any, entityType: any, entityId: string, prev: any, next: any, user: string, reason: string): Promise<AuditLogEntry>;

  getAutomationRules(): Promise<AutomationRule[]>;
  updateAutomationRule(id: string, threshold: any, isEnabled: boolean): Promise<AutomationRule | null>;

  getSystemHealth(): Promise<SystemHealthMetrics>;
}

/**
 * In-memory DataStore Repository Implementation (used for dev/testing or ₹0 fallback)
 */
export class DataStoreRepository implements IBusRepository {
  constructor(private ds: DataStore = dataStore) {}

  async getPlaceById(id: string): Promise<Place | undefined> {
    return this.ds.getPlaceById(id);
  }

  async getAllPlaces(): Promise<Place[]> {
    return this.ds.getAllPlaces();
  }

  async searchPlaces(query: string, limit?: number): Promise<{ place: Place; score: number }[]> {
    return this.ds.searchPlaces(query, limit);
  }

  async getNearbyPlaces(lat: number, lng: number, radiusKm?: number, limit?: number): Promise<(Place & { distanceKm: number })[]> {
    return this.ds.getNearbyPlaces(lat, lng, radiusKm, limit);
  }

  async getRouteById(id: string): Promise<Route | undefined> {
    return this.ds.getRouteById(id);
  }

  async getAllRoutes(): Promise<Route[]> {
    return this.ds.getAllRoutes();
  }

  async findRoutes(originId: string, destId: string): Promise<{ directRoutes: Route[]; transferRoutes: any[] }> {
    return this.ds.findRoutes(originId, destId);
  }

  async getTimetablesByRoute(routeId: string): Promise<TimetableDeparture[]> {
    return this.ds.getTimetablesByRoute(routeId);
  }

  async calculateETA(routeId: string, stopId: string): Promise<ETAResult> {
    return this.ds.calculateETA(routeId, stopId);
  }

  async getAllBuses(): Promise<Bus[]> {
    return this.ds.getAllBuses();
  }

  async getBusById(id: string): Promise<Bus | undefined> {
    return this.ds.getBusById(id);
  }

  async getAllOperators(): Promise<Operator[]> {
    return this.ds.getAllOperators();
  }

  async startJourneySession(busId: string, routeId: string, consentGiven: boolean): Promise<JourneySession> {
    return this.ds.startJourneySession(busId, routeId, consentGiven);
  }

  async stopJourneySession(sessionId: string): Promise<boolean> {
    return this.ds.stopJourneySession(sessionId);
  }

  async getSession(sessionId: string): Promise<JourneySession | undefined> {
    return this.ds.getSession(sessionId);
  }

  async ingestLocationObservation(
    sessionId: string,
    busId: string,
    routeId: string,
    lat: number,
    lng: number,
    accuracy: number,
    speed?: number,
    heading?: number,
    timestampStr?: string
  ): Promise<{ observation: LocationObservation; accepted: boolean; message: string }> {
    return this.ds.ingestLocationObservation(sessionId, busId, routeId, lat, lng, accuracy, speed, heading, timestampStr);
  }

  async getLatestBusLocation(busId: string): Promise<LocationObservation | undefined> {
    return this.ds.getLatestBusLocation(busId);
  }

  async createSubmission(type: any, data: any, notes?: string, ref?: string): Promise<{ submission: CommunitySubmission; duplicateCandidates: any[] }> {
    return this.ds.createSubmission(type, data, notes, ref);
  }

  async getSubmissionById(id: string): Promise<CommunitySubmission | undefined> {
    return this.ds.getSubmissionById(id);
  }

  async getAllSubmissions(status?: string): Promise<CommunitySubmission[]> {
    return this.ds.getAllSubmissions(status);
  }

  async reviewSubmission(id: string, action: 'approved' | 'rejected' | 'merged', remarks: string, reviewerId?: string): Promise<CommunitySubmission | null> {
    return this.ds.reviewSubmission(id, action, remarks, reviewerId);
  }

  async getAuditLogs(): Promise<AuditLogEntry[]> {
    return this.ds.getAuditLogs();
  }

  async addAuditLog(action: any, entityType: any, entityId: string, prev: any, next: any, user: string, reason: string): Promise<AuditLogEntry> {
    return this.ds.addAuditLog(action, entityType, entityId, prev, next, user, reason);
  }

  async getAutomationRules(): Promise<AutomationRule[]> {
    return this.ds.getAutomationRules();
  }

  async updateAutomationRule(id: string, threshold: any, isEnabled: boolean): Promise<AutomationRule | null> {
    return this.ds.updateAutomationRule(id, threshold, isEnabled);
  }

  async getSystemHealth(): Promise<SystemHealthMetrics> {
    return this.ds.getSystemHealth();
  }
}

/**
 * PostgreSQL Persistent Repository Implementation
 */
export class PostgresRepository implements IBusRepository {
  private inMemoryFallback: DataStoreRepository;

  constructor() {
    this.inMemoryFallback = new DataStoreRepository(dataStore);
  }

  private async query(sql: string, params: any[] = []): Promise<any> {
    const pool = getDatabasePool();
    if (!pool) throw new Error('Database pool not connected');
    return pool.query(sql, params);
  }

  async getPlaceById(id: string): Promise<Place | undefined> {
    try {
      const res = await this.query('SELECT * FROM places WHERE id = $1', [id]);
      if (res.rows.length === 0) return undefined;
      const r = res.rows[0];
      return {
        id: r.id,
        canonicalName: r.canonical_name,
        placeType: r.place_type,
        state: r.state,
        district: r.district,
        latitude: parseFloat(r.latitude),
        longitude: parseFloat(r.longitude),
        sourceDataset: r.source_dataset,
        verificationStatus: r.verification_status,
        aliases: r.aliases || [],
        lastUpdated: r.last_updated?.toISOString()
      };
    } catch {
      return this.inMemoryFallback.getPlaceById(id);
    }
  }

  async getAllPlaces(): Promise<Place[]> {
    try {
      const res = await this.query('SELECT * FROM places ORDER BY canonical_name ASC LIMIT 100');
      return res.rows.map((r: any) => ({
        id: r.id,
        canonicalName: r.canonical_name,
        placeType: r.place_type,
        state: r.state,
        district: r.district,
        latitude: parseFloat(r.latitude),
        longitude: parseFloat(r.longitude),
        sourceDataset: r.source_dataset,
        verificationStatus: r.verification_status,
        aliases: r.aliases || [],
        lastUpdated: r.last_updated?.toISOString()
      }));
    } catch {
      return this.inMemoryFallback.getAllPlaces();
    }
  }

  async searchPlaces(query: string, limit: number = 8): Promise<{ place: Place; score: number }[]> {
    return this.inMemoryFallback.searchPlaces(query, limit);
  }

  async getNearbyPlaces(lat: number, lng: number, radiusKm: number = 5, limit: number = 10): Promise<(Place & { distanceKm: number })[]> {
    return this.inMemoryFallback.getNearbyPlaces(lat, lng, radiusKm, limit);
  }

  async getRouteById(id: string): Promise<Route | undefined> {
    return this.inMemoryFallback.getRouteById(id);
  }

  async getAllRoutes(): Promise<Route[]> {
    return this.inMemoryFallback.getAllRoutes();
  }

  async findRoutes(originId: string, destId: string): Promise<{ directRoutes: Route[]; transferRoutes: any[] }> {
    return this.inMemoryFallback.findRoutes(originId, destId);
  }

  async getTimetablesByRoute(routeId: string): Promise<TimetableDeparture[]> {
    return this.inMemoryFallback.getTimetablesByRoute(routeId);
  }

  async calculateETA(routeId: string, stopId: string): Promise<ETAResult> {
    return this.inMemoryFallback.calculateETA(routeId, stopId);
  }

  async getAllBuses(): Promise<Bus[]> {
    return this.inMemoryFallback.getAllBuses();
  }

  async getBusById(id: string): Promise<Bus | undefined> {
    return this.inMemoryFallback.getBusById(id);
  }

  async getAllOperators(): Promise<Operator[]> {
    return this.inMemoryFallback.getAllOperators();
  }

  async startJourneySession(busId: string, routeId: string, consentGiven: boolean): Promise<JourneySession> {
    const session = await this.inMemoryFallback.startJourneySession(busId, routeId, consentGiven);
    try {
      await this.query(
        `INSERT INTO journey_sessions (session_id, bus_id, route_id, started_at, expires_at, is_active, has_consented, last_ping_time)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         ON CONFLICT (session_id) DO UPDATE SET is_active = $6, last_ping_time = $8`,
        [session.sessionId, session.busId, session.routeId, session.startedAt, session.expiresAt, session.isActive, session.hasConsented, session.lastPingTime]
      );
    } catch (e: any) {
      console.warn('Postgres session insert warning:', e.message);
    }
    return session;
  }

  async stopJourneySession(sessionId: string): Promise<boolean> {
    const ok = await this.inMemoryFallback.stopJourneySession(sessionId);
    try {
      await this.query('UPDATE journey_sessions SET is_active = FALSE WHERE session_id = $1', [sessionId]);
    } catch (e: any) {
      console.warn('Postgres session stop warning:', e.message);
    }
    return ok;
  }

  async getSession(sessionId: string): Promise<JourneySession | undefined> {
    return this.inMemoryFallback.getSession(sessionId);
  }

  async ingestLocationObservation(
    sessionId: string,
    busId: string,
    routeId: string,
    lat: number,
    lng: number,
    accuracy: number,
    speed?: number,
    heading?: number,
    timestampStr?: string
  ): Promise<{ observation: LocationObservation; accepted: boolean; message: string }> {
    const res = await this.inMemoryFallback.ingestLocationObservation(sessionId, busId, routeId, lat, lng, accuracy, speed, heading, timestampStr);
    if (res.accepted && res.observation) {
      try {
        const o = res.observation;
        await this.query(
          `INSERT INTO location_observations (id, session_id, bus_id, route_id, latitude, longitude, accuracy_meters, speed_kmh, heading, timestamp, confidence, tracking_status, distance_from_route_meters, matched_stop_id, matching_remarks)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)`,
          [o.id, o.sessionId, o.busId, o.routeId, o.latitude, o.longitude, o.accuracyMeters, o.speedKmh, o.heading, o.timestamp, o.confidence, o.trackingStatus, o.distanceFromRouteMeters, o.matchedStopId, o.matchingRemarks]
        );
      } catch (e: any) {
        console.warn('Postgres observation insert warning:', e.message);
      }
    }
    return res;
  }

  async getLatestBusLocation(busId: string): Promise<LocationObservation | undefined> {
    return this.inMemoryFallback.getLatestBusLocation(busId);
  }

  async createSubmission(type: any, data: any, notes?: string, ref?: string): Promise<{ submission: CommunitySubmission; duplicateCandidates: any[] }> {
    const res = await this.inMemoryFallback.createSubmission(type, data, notes, ref);
    try {
      const s = res.submission;
      await this.query(
        `INSERT INTO community_submissions (id, submission_type, proposed_data, contributor_notes, contributor_ref_hash, duplicate_candidate_ids, status, submitted_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [s.id, s.submissionType, JSON.stringify(s.proposedData), s.contributorNotes, s.contributorRefHash, s.duplicateCandidateIds, s.status, s.submittedAt]
      );
    } catch (e: any) {
      console.warn('Postgres submission insert warning:', e.message);
    }
    return res;
  }

  async getSubmissionById(id: string): Promise<CommunitySubmission | undefined> {
    try {
      const res = await this.query('SELECT * FROM community_submissions WHERE id = $1', [id]);
      if (res.rows.length === 0) return this.inMemoryFallback.getSubmissionById(id);
      const r = res.rows[0];
      return {
        id: r.id,
        submissionType: r.submission_type,
        proposedData: typeof r.proposed_data === 'string' ? JSON.parse(r.proposed_data) : r.proposed_data,
        contributorNotes: r.contributor_notes,
        contributorRefHash: r.contributor_ref_hash,
        duplicateCandidateIds: r.duplicate_candidate_ids || [],
        status: r.status,
        submittedAt: r.submitted_at?.toISOString?.() || r.submitted_at,
        reviewedAt: r.reviewed_at?.toISOString?.() || r.reviewed_at,
        reviewedBy: r.reviewed_by,
        reviewRemarks: r.review_remarks
      };
    } catch {
      return this.inMemoryFallback.getSubmissionById(id);
    }
  }

  async getAllSubmissions(status?: string): Promise<CommunitySubmission[]> {
    return this.inMemoryFallback.getAllSubmissions(status);
  }

  async reviewSubmission(id: string, action: 'approved' | 'rejected' | 'merged', remarks: string, reviewerId?: string): Promise<CommunitySubmission | null> {
    const updated = await this.inMemoryFallback.reviewSubmission(id, action, remarks, reviewerId);
    try {
      await this.query(
        `UPDATE community_submissions
         SET status = $1, reviewed_at = CURRENT_TIMESTAMP, reviewed_by = $2, review_remarks = $3
         WHERE id = $4`,
        [action, reviewerId || 'admin', remarks, id]
      );
    } catch (e: any) {
      console.warn('Postgres submission review update warning:', e.message);
    }
    return updated;
  }

  async getAuditLogs(): Promise<AuditLogEntry[]> {
    return this.inMemoryFallback.getAuditLogs();
  }

  async addAuditLog(action: any, entityType: any, entityId: string, prev: any, next: any, user: string, reason: string): Promise<AuditLogEntry> {
    const entry = await this.inMemoryFallback.addAuditLog(action, entityType, entityId, prev, next, user, reason);
    try {
      await this.query(
        `INSERT INTO audit_logs (id, action, entity_type, entity_id, previous_value, new_value, performed_by, reason, timestamp)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [entry.id, entry.action, entry.entityType, entry.entityId, JSON.stringify(entry.previousValue), JSON.stringify(entry.newValue), entry.performedBy, entry.reason, entry.timestamp]
      );
    } catch (e: any) {
      console.warn('Postgres audit log insert warning:', e.message);
    }
    return entry;
  }

  async getAutomationRules(): Promise<AutomationRule[]> {
    return this.inMemoryFallback.getAutomationRules();
  }

  async updateAutomationRule(id: string, threshold: any, isEnabled: boolean): Promise<AutomationRule | null> {
    return this.inMemoryFallback.updateAutomationRule(id, threshold, isEnabled);
  }

  async getSystemHealth(): Promise<SystemHealthMetrics> {
    const health = await this.inMemoryFallback.getSystemHealth();
    return {
      ...health,
      dbStatus: isUsingPostgres() ? 'connected' : 'embedded_fallback'
    };
  }
}

let repositoryInstance: IBusRepository | null = null;

export function getRepository(): IBusRepository {
  if (!repositoryInstance) {
    if (isUsingPostgres()) {
      repositoryInstance = new PostgresRepository();
    } else {
      repositoryInstance = new DataStoreRepository(dataStore);
    }
  }
  return repositoryInstance;
}
