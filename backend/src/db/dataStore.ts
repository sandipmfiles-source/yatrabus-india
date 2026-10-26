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
  SystemHealthMetrics,
  AutomationRule,
  ETAResult,
  LocationConfidence,
  TrackingStatus
} from '../../types';

import {
  SEED_PLACES,
  SEED_OPERATORS,
  SEED_BUSES,
  SEED_ROUTES,
  SEED_TIMETABLES,
  SEED_AUTOMATION_RULES
} from './seedData';

import {
  calculateDistanceKm,
  distanceToPolylineMeters,
  calculateDistanceMeters
} from '../utils/geoUtils';

import {
  calculateMatchScore,
  normalizeText,
  jaroWinklerSimilarity
} from '../utils/searchUtils';
import crypto from 'crypto';
import { TrackingPipeline } from '../services/trackingPipeline';

export class DataStore {
  private places: Map<string, Place> = new Map();
  private operators: Map<string, Operator> = new Map();
  private buses: Map<string, Bus> = new Map();
  private routes: Map<string, Route> = new Map();
  private timetables: Map<string, TimetableDeparture> = new Map();
  private submissions: Map<string, CommunitySubmission> = new Map();
  private sessions: Map<string, JourneySession> = new Map();
  private observations: LocationObservation[] = [];
  private latestBusObservations: Map<string, LocationObservation> = new Map();
  private auditLogs: AuditLogEntry[] = [];
  private automationRules: Map<string, AutomationRule> = new Map();
  private startTime: number = Date.now();

  constructor() {
    this.seedInitialData();
  }

  private seedInitialData() {
    SEED_PLACES.forEach(p => this.places.set(p.id, p));
    SEED_OPERATORS.forEach(o => this.operators.set(o.id, o));
    SEED_BUSES.forEach(b => this.buses.set(b.id, b));
    SEED_ROUTES.forEach(r => this.routes.set(r.id, r));
    SEED_TIMETABLES.forEach(t => this.timetables.set(t.id, t));
    SEED_AUTOMATION_RULES.forEach(rule => this.automationRules.set(rule.id, rule));
  }

  // =========================================================================
  // PLACES DIRECTORY
  // =========================================================================

  public getPlaceById(id: string): Place | undefined {
    return this.places.get(id);
  }

  public getAllPlaces(): Place[] {
    return Array.from(this.places.values());
  }

  public searchPlaces(query: string, limit: number = 8): { place: Place; score: number }[] {
    if (!query || query.trim().length === 0) {
      return Array.from(this.places.values())
        .slice(0, limit)
        .map(p => ({ place: p, score: 100 }));
    }

    const normQuery = normalizeText(query);
    const results: { place: Place; score: number }[] = [];

    for (const place of this.places.values()) {
      let maxScore = calculateMatchScore(normQuery, place.canonicalName);

      // Check state & district matching
      const districtScore = calculateMatchScore(normQuery, place.district);
      const stateScore = calculateMatchScore(normQuery, place.state);
      maxScore = Math.max(maxScore, districtScore * 0.85, stateScore * 0.75);

      // Check multilingual aliases (Hindi, Bengali, transliteration)
      if (place.aliases && place.aliases.length > 0) {
        for (const alias of place.aliases) {
          const aliasScore = calculateMatchScore(normQuery, alias.name);
          if (aliasScore > maxScore) {
            maxScore = aliasScore;
          }
        }
      }

      if (maxScore > 35) {
        results.push({ place, score: maxScore });
      }
    }

    // Sort by descending score
    results.sort((a, b) => b.score - a.score);
    return results.slice(0, limit);
  }

  public getNearbyPlaces(lat: number, lng: number, radiusKm: number = 5, limit: number = 10): (Place & { distanceKm: number })[] {
    const nearby: (Place & { distanceKm: number })[] = [];

    for (const place of this.places.values()) {
      const dist = calculateDistanceKm(lat, lng, place.latitude, place.longitude);
      if (dist <= radiusKm) {
        nearby.push({ ...place, distanceKm: Math.round(dist * 100) / 100 });
      }
    }

    nearby.sort((a, b) => a.distanceKm - b.distanceKm);
    return nearby.slice(0, limit);
  }

  public createPlace(place: Place): Place {
    this.places.set(place.id, place);
    this.addAuditLog('create', 'place', place.id, null, place, 'admin', 'Added place to directory');
    return place;
  }

  // =========================================================================
  // OPERATORS & BUSES
  // =========================================================================

  public getAllOperators(): Operator[] {
    return Array.from(this.operators.values());
  }

  public getOperatorById(id: string): Operator | undefined {
    return this.operators.get(id);
  }

  public getAllBuses(): Bus[] {
    return Array.from(this.buses.values());
  }

  public getBusById(id: string): Bus | undefined {
    return this.buses.get(id);
  }

  public getBusesByOperator(operatorId: string): Bus[] {
    return Array.from(this.buses.values()).filter(b => b.operatorId === operatorId);
  }

  public createBus(bus: Bus): Bus {
    this.buses.set(bus.id, bus);
    this.addAuditLog('create', 'bus', bus.id, null, bus, 'admin', 'Registered new bus');
    return bus;
  }

  // =========================================================================
  // ROUTES & SMART ROUTE DISCOVERY
  // =========================================================================

  public getAllRoutes(): Route[] {
    return Array.from(this.routes.values());
  }

  public getRouteById(id: string): Route | undefined {
    return this.routes.get(id);
  }

  /**
   * Find routes between Origin and Destination
   * Direct and transfer route search across intermediate stops
   */
  public findRoutes(originId: string, destinationId: string): {
    directRoutes: {
      route: Route;
      boardStopSequence: number;
      alightStopSequence: number;
      stopsCount: number;
      estimatedMinutes: number;
    }[];
    transferRoutes: {
      firstRoute: Route;
      secondRoute: Route;
      transferPlace: Place;
      totalEstimatedMinutes: number;
    }[];
  } {
    const directRoutes: {
      route: Route;
      boardStopSequence: number;
      alightStopSequence: number;
      stopsCount: number;
      estimatedMinutes: number;
    }[] = [];

    const transferRoutes: {
      firstRoute: Route;
      secondRoute: Route;
      transferPlace: Place;
      totalEstimatedMinutes: number;
    }[] = [];

    const allRoutesList = Array.from(this.routes.values());

    // 1. Direct Search
    for (const route of allRoutesList) {
      const boardIdx = route.stops.findIndex(s => s.stopId === originId);
      const alightIdx = route.stops.findIndex(s => s.stopId === destinationId);

      if (boardIdx !== -1 && alightIdx !== -1 && alightIdx > boardIdx) {
        const boardStop = route.stops[boardIdx];
        const alightStop = route.stops[alightIdx];
        const estMins = alightStop.arrivalOffsetMinutes - boardStop.departureOffsetMinutes;

        directRoutes.push({
          route,
          boardStopSequence: boardStop.stopSequence,
          alightStopSequence: alightStop.stopSequence,
          stopsCount: alightIdx - boardIdx + 1,
          estimatedMinutes: Math.max(10, estMins)
        });
      }
    }

    // 2. Transfer-based Search (if needed or as alternate options)
    if (directRoutes.length <= 2) {
      for (const routeA of allRoutesList) {
        const boardIdxA = routeA.stops.findIndex(s => s.stopId === originId);
        if (boardIdxA === -1) continue;

        for (let i = boardIdxA + 1; i < routeA.stops.length; i++) {
          const potentialTransferStop = routeA.stops[i];

          for (const routeB of allRoutesList) {
            if (routeB.id === routeA.id) continue;

            const boardIdxB = routeB.stops.findIndex(s => s.stopId === potentialTransferStop.stopId);
            const alightIdxB = routeB.stops.findIndex(s => s.stopId === destinationId);

            if (boardIdxB !== -1 && alightIdxB !== -1 && alightIdxB > boardIdxB) {
              const transferPlace = this.places.get(potentialTransferStop.stopId);
              if (transferPlace) {
                const minsA = potentialTransferStop.arrivalOffsetMinutes - routeA.stops[boardIdxA].departureOffsetMinutes;
                const minsB = routeB.stops[alightIdxB].arrivalOffsetMinutes - routeB.stops[boardIdxB].departureOffsetMinutes;
                const waitBuffer = 15; // 15 mins transfer buffer

                transferRoutes.push({
                  firstRoute: routeA,
                  secondRoute: routeB,
                  transferPlace,
                  totalEstimatedMinutes: minsA + minsB + waitBuffer
                });
              }
            }
          }
        }
      }
    }

    return { directRoutes, transferRoutes };
  }

  // =========================================================================
  // TIMETABLES & VERSIONING
  // =========================================================================

  public getTimetablesByRoute(routeId: string): TimetableDeparture[] {
    return Array.from(this.timetables.values())
      .filter(t => t.routeId === routeId)
      .sort((a, b) => a.departureTime.localeCompare(b.departureTime));
  }

  public addTimetableRevision(
    routeId: string,
    existingTimetableId: string | null,
    newDepartureTime: string,
    newArrivalTime: string,
    vehicleType: any,
    fare: number,
    adminNotes: string
  ): TimetableDeparture {
    const existing = existingTimetableId ? this.timetables.get(existingTimetableId) : null;
    const newVersion = existing ? existing.version + 1 : 1;
    const newId = `tt-${routeId}-${Date.now()}`;

    const newTimetable: TimetableDeparture = {
      id: newId,
      routeId,
      tripCode: existing ? existing.tripCode : `TRIP-${Date.now().toString().slice(-4)}`,
      departureTime: newDepartureTime,
      arrivalTime: newArrivalTime,
      operatingDays: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
      vehicleType: vehicleType || 'express',
      fareInRupees: fare,
      isConfirmed: true,
      version: newVersion,
      lastVerifiedDate: new Date().toISOString()
    };

    this.timetables.set(newId, newTimetable);
    this.addAuditLog(
      'update',
      'timetable',
      newId,
      existing,
      newTimetable,
      'admin',
      adminNotes || `Updated timetable revision to v${newVersion}`
    );

    return newTimetable;
  }

  // =========================================================================
  // COMMUNITY CONTRIBUTIONS & DUPLICATE DETECTION
  // =========================================================================

  public getAllSubmissions(status?: string): CommunitySubmission[] {
    const list = Array.from(this.submissions.values());
    if (status) {
      return list.filter(s => s.status === status);
    }
    return list.sort((a, b) => b.submittedAt.localeCompare(a.submittedAt));
  }

  public getSubmissionById(id: string): CommunitySubmission | undefined {
    return this.submissions.get(id);
  }

  public createSubmission(
    submissionType: any,
    proposedData: Record<string, any>,
    contributorNotes?: string,
    contributorRef?: string
  ): { submission: CommunitySubmission; duplicateCandidates: any[] } {
    const id = `SUB-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;

    // Duplicate Detection Logic
    const duplicateCandidates: any[] = [];
    const simThreshold = (this.automationRules.get('rule-duplicate-similarity')?.thresholdValue as number) || 80;

    if (submissionType === 'add_bus' && proposedData.name) {
      for (const bus of this.buses.values()) {
        const sim = jaroWinklerSimilarity(proposedData.name, bus.name) * 100;
        if (sim >= simThreshold) {
          duplicateCandidates.push({ id: bus.id, name: bus.name, type: 'bus', similarity: Math.round(sim) });
        }
      }
    } else if (submissionType === 'suggest_route' && proposedData.name) {
      for (const route of this.routes.values()) {
        const sim = jaroWinklerSimilarity(proposedData.name, route.name) * 100;
        if (sim >= simThreshold) {
          duplicateCandidates.push({ id: route.id, name: route.name, type: 'route', similarity: Math.round(sim) });
        }
      }
    } else if (submissionType === 'add_stop' && proposedData.canonicalName) {
      for (const place of this.places.values()) {
        const sim = jaroWinklerSimilarity(proposedData.canonicalName, place.canonicalName) * 100;
        if (sim >= simThreshold) {
          duplicateCandidates.push({ id: place.id, name: place.canonicalName, type: 'place', similarity: Math.round(sim) });
        }
      }
    }

    const submission: CommunitySubmission = {
      id,
      submissionType,
      proposedData,
      contributorNotes,
      duplicateCandidateIds: duplicateCandidates.map(c => c.id),
      status: 'pending_review',
      submittedAt: new Date().toISOString(),
      contributorRefHash: contributorRef || 'anon-hash-' + Math.random().toString(36).substring(2, 10)
    };

    this.submissions.set(id, submission);
    this.addAuditLog('create', 'submission', id, null, submission, 'public_contributor', 'Community submission created');

    return { submission, duplicateCandidates };
  }

  public reviewSubmission(
    submissionId: string,
    action: 'approved' | 'rejected' | 'merged',
    reviewerRemarks: string,
    reviewerId: string = 'admin'
  ): CommunitySubmission | null {
    const submission = this.submissions.get(submissionId);
    if (!submission) return null;

    submission.status = action;
    submission.reviewedAt = new Date().toISOString();
    submission.reviewedBy = reviewerId;
    submission.reviewRemarks = reviewerRemarks;

    // Apply approved change
    if (action === 'approved') {
      if (submission.submissionType === 'add_bus' && submission.proposedData) {
        const newBus: Bus = {
          id: `bus-${Date.now()}`,
          name: submission.proposedData.name,
          operatorId: submission.proposedData.operatorId || 'op-dtc',
          vehicleType: submission.proposedData.vehicleType || 'express',
          status: 'active',
          verificationStatus: 'community_corroborated',
          features: submission.proposedData.features || [],
          createdDate: new Date().toISOString(),
          updatedDate: new Date().toISOString()
        };
        this.buses.set(newBus.id, newBus);
      } else if (submission.submissionType === 'add_stop' && submission.proposedData) {
        const newPlace: Place = {
          id: `plc-comm-${Date.now()}`,
          canonicalName: submission.proposedData.canonicalName,
          placeType: 'bus_stop',
          state: submission.proposedData.state || 'General',
          district: submission.proposedData.district || 'General',
          latitude: Number(submission.proposedData.latitude) || 0,
          longitude: Number(submission.proposedData.longitude) || 0,
          sourceDataset: 'Community Contributed / Verified',
          verificationStatus: 'community_corroborated',
          aliases: [],
          lastUpdated: new Date().toISOString()
        };
        this.places.set(newPlace.id, newPlace);
      }
    }

    this.addAuditLog(
      'update',
      'submission',
      submission.id,
      null,
      submission,
      reviewerId,
      `Submission reviewed: ${action}. ${reviewerRemarks}`
    );

    return submission;
  }

  // =========================================================================
  // CONSENT-BASED GPS TRACKING LIFECYCLE & CONFIDENCE ENGINE
  // =========================================================================

  public startJourneySession(busId: string, routeId: string, consentGiven: boolean = false): JourneySession {
    const sessionId = `sess-${crypto.randomUUID()}`;
    const startedAt = new Date().toISOString();
    const maxHours = 12; // Configurable 12h safety ceiling
    const expiresAt = new Date(Date.now() + maxHours * 3600 * 1000).toISOString();

    const session: JourneySession = {
      sessionId,
      busId,
      routeId,
      startedAt,
      expiresAt,
      isActive: true,
      hasConsented: Boolean(consentGiven),
      totalObservationsCount: 0,
      lastPingTime: startedAt
    };

    this.sessions.set(sessionId, session);
    return session;
  }

  public stopJourneySession(sessionId: string): boolean {
    const session = this.sessions.get(sessionId);
    if (!session) return false;
    session.isActive = false;
    return true;
  }

  public getSession(sessionId: string): JourneySession | undefined {
    return this.sessions.get(sessionId);
  }

  /**
   * Ingest and match location observation against route & confidence rules
   */
  public ingestLocationObservation(
    sessionId: string,
    busId: string,
    routeId: string,
    latitude: number,
    longitude: number,
    accuracyMeters: number,
    speedKmh?: number,
    heading?: number,
    timestampStr?: string
  ): { observation: LocationObservation; accepted: boolean; message: string } {
    const session = this.sessions.get(sessionId);
    if (!session || !session.isActive || !session.hasConsented) {
      return {
        observation: null as any,
        accepted: false,
        message: 'Invalid, inactive or unconsented journey session'
      };
    }

    // Server-enforced session binding check
    if (session.busId !== busId || session.routeId !== routeId) {
      return {
        observation: null as any,
        accepted: false,
        message: `Session binding violation: session is bound to bus ${session.busId} and route ${session.routeId}, got bus ${busId} and route ${routeId}`
      };
    }

    const route = this.routes.get(routeId);
    if (!route) {
      return {
        observation: null as any,
        accepted: false,
        message: 'Associated route not found'
      };
    }

    // Delegate directly to TrackingPipeline.processObservation
    const result = TrackingPipeline.processObservation(
      session,
      route,
      latitude,
      longitude,
      accuracyMeters,
      speedKmh,
      heading,
      timestampStr
    );

    if (!result.accepted || !result.observation) {
      return {
        observation: null as any,
        accepted: false,
        message: result.rejectionReason || 'Observation rejected by tracking pipeline'
      };
    }

    const observation = result.observation;

    // Check closest stop along route
    let matchedStopId: string | undefined = undefined;
    let minStopDist = Infinity;
    for (const stop of route.stops) {
      const d = calculateDistanceMeters(latitude, longitude, stop.latitude, stop.longitude);
      if (d < minStopDist && d < 200) {
        minStopDist = d;
        matchedStopId = stop.stopId;
      }
    }
    if (matchedStopId) {
      observation.matchedStopId = matchedStopId;
    }

    this.observations.push(observation);
    this.latestBusObservations.set(busId, observation);

    // Update session ping
    session.totalObservationsCount++;
    session.lastPingTime = observation.timestamp;

    return {
      observation,
      accepted: true,
      message: `Observation recorded with ${observation.confidence} confidence`
    };
  }

  public getLatestBusLocation(busId: string): LocationObservation | undefined {
    const obs = this.latestBusObservations.get(busId);
    if (!obs) return undefined;

    // Check freshness (5 mins / 300s)
    const freshnessWindowSec = (this.automationRules.get('rule-gps-freshness')?.thresholdValue as number) || 300;
    const ageSeconds = (Date.now() - new Date(obs.timestamp).getTime()) / 1000;

    if (ageSeconds > freshnessWindowSec) {
      return {
        ...obs,
        trackingStatus: 'last_known',
        confidence: 'low',
        matchingRemarks: `Observation is ${Math.round(ageSeconds / 60)} minutes old`
      };
    }

    return obs;
  }

  // =========================================================================
  // DYNAMIC ETA ESTIMATION
  // =========================================================================

  public calculateETA(routeId: string, stopId: string): ETAResult {
    const route = this.routes.get(routeId);
    const stop = route?.stops.find(s => s.stopId === stopId);
    const now = new Date();

    // Use explicit Asia/Kolkata timezone for Indian transport schedules
    const istFormatter = new Intl.DateTimeFormat('en-IN', {
      timeZone: 'Asia/Kolkata',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    });
    const parts = istFormatter.formatToParts(now);
    const curH = parts.find(p => p.type === 'hour')?.value || '00';
    const curM = parts.find(p => p.type === 'minute')?.value || '00';
    const currentTimeStr = `${curH}:${curM}`;

    if (!route || !stop) {
      return {
        routeId,
        stopId,
        stopName: 'Unknown Stop',
        scheduledArrival: '--:--',
        isEstimated: true,
        delayMinutes: 0,
        confidence: 'low',
        trackingStatus: 'unavailable',
        lastUpdated: now.toISOString(),
        basis: 'timetable_projection'
      };
    }

    // Check for active buses on this route
    const busesOnRoute = Array.from(this.buses.values()).filter(b => b.operatorId === route.operatorId);
    let activeObs: LocationObservation | undefined = undefined;

    for (const b of busesOnRoute) {
      const o = this.getLatestBusLocation(b.id);
      if (o && o.routeId === routeId) {
        activeObs = o;
        break;
      }
    }

    // Find next scheduled timetable
    const timetables = this.getTimetablesByRoute(routeId);
    const nextTrip = timetables.find(t => t.departureTime >= currentTimeStr) || timetables[0];

    // No timetable exists: return truthful 'ETA unavailable', never fabricated 08:00
    if (!nextTrip) {
      return {
        routeId,
        stopId,
        stopName: stop.stopName,
        scheduledArrival: 'ETA unavailable',
        predictedArrival: undefined,
        isEstimated: false,
        delayMinutes: 0,
        confidence: 'low',
        trackingStatus: 'unavailable',
        lastUpdated: now.toISOString(),
        basis: 'timetable_projection'
      };
    }

    // Calculate arrival time based on scheduled offset in IST
    const [depH, depM] = nextTrip.departureTime.split(':').map(Number);
    const totalMinutes = depH * 60 + depM + (stop.arrivalOffsetMinutes || 0);
    const arrH = Math.floor(totalMinutes / 60) % 24;
    const arrM = totalMinutes % 60;
    const schedArrivalStr = `${arrH.toString().padStart(2, '0')}:${arrM.toString().padStart(2, '0')}`;

    if (activeObs && activeObs.trackingStatus === 'live_gps') {
      // Calculate remaining distance to this stop
      const distToStopKm = calculateDistanceKm(activeObs.latitude, activeObs.longitude, stop.latitude, stop.longitude);
      const estSpeedKmh = Math.max(15, activeObs.speedKmh || 25);
      const remainingMinutes = Math.round((distToStopKm / estSpeedKmh) * 60);

      const predDate = new Date(Date.now() + remainingMinutes * 60000);
      const predParts = istFormatter.formatToParts(predDate);
      const pH = predParts.find(p => p.type === 'hour')?.value || '00';
      const pM = predParts.find(p => p.type === 'minute')?.value || '00';
      const predArrivalStr = `${pH}:${pM}`;

      return {
        routeId,
        stopId,
        stopName: stop.stopName,
        scheduledArrival: schedArrivalStr,
        predictedArrival: predArrivalStr,
        isEstimated: false,
        delayMinutes: Math.max(0, remainingMinutes - stop.arrivalOffsetMinutes),
        confidence: activeObs.confidence,
        trackingStatus: 'live_gps',
        lastUpdated: activeObs.timestamp,
        basis: 'live_gps'
      };
    }

    return {
      routeId,
      stopId,
      stopName: stop.stopName,
      scheduledArrival: schedArrivalStr,
      predictedArrival: schedArrivalStr,
      isEstimated: true,
      delayMinutes: 0,
      confidence: 'moderate',
      trackingStatus: 'estimated',
      lastUpdated: now.toISOString(),
      basis: 'timetable_projection'
    };
  }

  // =========================================================================
  // AUDIT LOGS, HEALTH METRICS & AUTOMATION RULES
  // =========================================================================

  public addAuditLog(
    action: any,
    entityType: any,
    entityId: string,
    previousValue: any,
    newValue: any,
    performedBy: string,
    reason: string
  ): AuditLogEntry {
    const entry: AuditLogEntry = {
      id: `audit-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      timestamp: new Date().toISOString(),
      action,
      entityType,
      entityId,
      previousValue,
      newValue,
      performedBy,
      reason,
      isRollbackable: true
    };
    this.auditLogs.unshift(entry);
    return entry;
  }

  public getAuditLogs(limit: number = 30): AuditLogEntry[] {
    return this.auditLogs.slice(0, limit);
  }

  public getAutomationRules(): AutomationRule[] {
    return Array.from(this.automationRules.values());
  }

  public updateAutomationRule(id: string, thresholdValue: any, isEnabled: boolean): AutomationRule | null {
    const rule = this.automationRules.get(id);
    if (!rule) return null;
    rule.thresholdValue = thresholdValue;
    rule.isEnabled = isEnabled;
    rule.lastTriggered = new Date().toISOString();
    return rule;
  }

  public getSystemHealth(): SystemHealthMetrics {
    const activeSessionsCount = Array.from(this.sessions.values()).filter(s => s.isActive).length;
    const pendingSubs = Array.from(this.submissions.values()).filter(s => s.status === 'pending_review').length;

    return {
      status: 'healthy',
      uptimeSeconds: Math.floor((Date.now() - this.startTime) / 1000),
      totalPlaces: this.places.size,
      totalBuses: this.buses.size,
      totalRoutes: this.routes.size,
      totalStops: Array.from(this.routes.values()).reduce((acc, r) => acc + r.stops.length, 0),
      activeLiveSessions: activeSessionsCount,
      recentObservationsCount: this.observations.length,
      pendingSubmissionsCount: pendingSubs,
      disputedRoutesCount: Array.from(this.routes.values()).filter(r => r.status === 'disrupted').length,
      databaseStatus: 'connected',
      lastImportTimestamp: '2026-03-25T12:00:00Z'
    };
  }
}

// Singleton in-memory persistent store instance
export const dataStore = new DataStore();
