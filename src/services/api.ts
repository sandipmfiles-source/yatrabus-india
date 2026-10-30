import { repository } from '../../backend/src/db/repository.js';
import { discoverJourneys } from '../../packages/shared/src/engine/routeGraph.js';
import { calculateStopETAs } from '../../packages/shared/src/engine/etaCalculator.js';
import { evaluateJourneyPrompt } from '../../packages/shared/src/engine/journeyConfirmationEngine.js';

const API_BASE = import.meta.env.VITE_API_BASE_URL ? `${import.meta.env.VITE_API_BASE_URL.replace(/\/$/, '')}/api` : '/api';

export const api = {
  // Search places / autocomplete
  async searchPlaces(query: string, limit = 8) {
    try {
      const res = await fetch(`${API_BASE}/places/search?q=${encodeURIComponent(query)}&limit=${limit}`);
      if (res.ok) {
        const data = await res.json();
        return data.results || [];
      }
    } catch {}
    // Fallback to in-memory repository
    return repository.searchPlaces(query, limit);
  },

  // Nearby stops
  async getNearbyStops(lat: number, lon: number, radius = 3000) {
    try {
      const res = await fetch(`${API_BASE}/places/nearby?lat=${lat}&lon=${lon}&radius=${radius}`);
      if (res.ok) {
        const data = await res.json();
        return data.stops || [];
      }
    } catch {}
    return repository.findNearbyStops(lat, lon, radius);
  },

  // Search routes from A to B
  async searchRoutes(from: string, to: string) {
    try {
      const res = await fetch(`${API_BASE}/routes/search?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`);
      if (res.ok) {
        return await res.json();
      }
    } catch {}
    const all = repository.getAllRoutes();
    const result = discoverJourneys(from, to, all);
    return {
      from,
      to,
      directCount: result.directRoutes.length,
      transferCount: result.transferRoutes.length,
      directRoutes: result.directRoutes,
      transferRoutes: result.transferRoutes,
    };
  },

  // Get Route Details
  async getRouteById(id: string) {
    try {
      const res = await fetch(`${API_BASE}/routes/${id}`);
      if (res.ok) return await res.json();
    } catch {}
    const route = repository.getRouteById(id);
    const buses = repository.getBusesForRoute(id);
    return { route, stopsCount: route?.stops.length || 0, buses };
  },

  // Get Bus Details & Stop ETAs
  async getBusById(id: string) {
    try {
      const res = await fetch(`${API_BASE}/buses/${id}`);
      if (res.ok) return await res.json();
    } catch {}
    const bus = repository.getBusById(id);
    const loc = repository.getBusLocation(id);
    const routes = repository.getAllRoutes();
    const route = routes.find(r => r.operatorId === bus?.operatorId) || routes[0];
    const stopETAs = calculateStopETAs(
      route.stops,
      0.35,
      loc?.isLive ? { latitude: loc.latitude!, longitude: loc.longitude!, speedKmh: loc.speedKmh, isLive: true } : undefined
    );
    return { bus, location: loc, route, stopETAs };
  },

  // Evaluate Journey Confirmation Prompt
  async evaluateJourneyPrompt(routeId: string, isAlreadyTracking: boolean, dismissedCount: number) {
    try {
      const res = await fetch(`${API_BASE}/tracking/evaluate-prompt`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ routeId, isAlreadyTracking, dismissedCount }),
      });
      if (res.ok) return await res.json();
    } catch {}
    const route = repository.getRouteById(routeId);
    if (!route) return { shouldPrompt: false };
    return evaluateJourneyPrompt(route, {
      isAlreadyTrackingThisBus: isAlreadyTracking,
      dismissedCountForRoute: dismissedCount,
      hasExplicitlyDeclined: false,
    });
  },

  // Record Consent
  async recordConsent(sessionId: string, status: string, disclosuresAccepted: boolean) {
    try {
      await fetch(`${API_BASE}/tracking/consent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, status, disclosuresAccepted }),
      });
    } catch {}
    repository.recordConsent({
      sessionId,
      scope: 'JOURNEY_TRACKING',
      status: status as any,
      disclosuresAccepted,
    });
  },

  // Start Journey Tracking Session
  async startJourneySession(busId: string, routeId: string) {
    try {
      const res = await fetch(`${API_BASE}/tracking/session/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ busId, routeId }),
      });
      if (res.ok) return await res.json();
    } catch {}
    const sessionId = `sess-${Date.now()}`;
    const session = repository.createJourneySession({
      sessionId,
      busId,
      routeId,
      startTime: new Date().toISOString(),
      lastActiveTime: new Date().toISOString(),
      maxExpiryTime: new Date(Date.now() + 12 * 3600 * 1000).toISOString(),
      isActive: true,
      isConfirmedPassenger: true,
      observationsContributedCount: 0,
    });
    return { session };
  },

  // Stop Journey Tracking Session
  async stopJourneySession(sessionId: string, reason = 'USER_STOPPED') {
    try {
      await fetch(`${API_BASE}/tracking/session/stop`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, reason }),
      });
    } catch {}
    repository.stopJourneySession(sessionId, reason as any);
  },

  // Send Location Observation
  async sendObservation(obs: {
    sessionId: string;
    busId: string;
    routeId: string;
    latitude: number;
    longitude: number;
    accuracyMeters: number;
    speedKmh?: number;
    headingDegrees?: number;
  }) {
    try {
      const res = await fetch(`${API_BASE}/tracking/observation`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(obs),
      });
      if (res.ok) return await res.json();
    } catch {}
    return { accepted: true };
  },

  // Community Submission
  async submitContribution(data: {
    submissionType: string;
    entityType: string;
    targetEntityId?: string;
    contributorNote?: string;
    proposedData: Record<string, any>;
  }) {
    try {
      const res = await fetch(`${API_BASE}/contributions/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (res.ok) return await res.json();
    } catch {}
    const ref = `YB-SUB-2026-${Math.floor(1000 + Math.random() * 9000)}`;
    const sub = repository.createSubmission({
      id: `sub-${Date.now()}`,
      referenceId: ref,
      submissionType: data.submissionType as any,
      entityType: data.entityType as any,
      targetEntityId: data.targetEntityId,
      contributorNote: data.contributorNote,
      proposedData: data.proposedData,
      status: 'PENDING_REVIEW',
      corroborationCount: 1,
      createdAt: new Date().toISOString(),
    });
    return {
      success: true,
      referenceId: sub.referenceId,
      status: sub.status,
      message: 'Contribution received successfully. Track with reference ID.',
    };
  },

  // Check Submission Status
  async getSubmissionStatus(refId: string) {
    try {
      const res = await fetch(`${API_BASE}/contributions/status/${encodeURIComponent(refId)}`);
      if (res.ok) return await res.json();
    } catch {}
    const sub = repository.getSubmissionByReference(refId);
    if (!sub) throw new Error('Reference ID not found');
    return sub;
  },

  // Submit Operator Claim
  async submitOperatorClaim(data: any) {
    try {
      const res = await fetch(`${API_BASE}/contributions/operator-claim`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (res.ok) return await res.json();
    } catch {}
    return { success: true, message: 'Operator claim received' };
  },

  // Admin APIs: no client-side development-token fallback is permitted.
  async adminLogin(email: string, password: string) {
    const res = await fetch(`${API_BASE}/admin/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    if (!res.ok) throw new Error('Invalid administrator credentials or server unavailable.');
    return await res.json();
  },

  async getAdminOverview(token: string) {
    const res = await fetch(`${API_BASE}/admin/overview`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) throw new Error('Could not load administrator overview. Please sign in again.');
    return await res.json();
  },

  async getAdminSubmissions(token: string, status?: string) {
    const query = status ? `?status=${encodeURIComponent(status)}` : '';
    const res = await fetch(`${API_BASE}/admin/submissions${query}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) throw new Error('Could not load community submissions. Please sign in again.');
    return await res.json();
  },

  async reviewSubmission(token: string, id: string, decision: 'ADMIN_VERIFIED' | 'COMMUNITY_CORROBORATED' | 'REJECTED', reason: string) {
    const res = await fetch(`${API_BASE}/admin/submissions/${encodeURIComponent(id)}/review`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ decision, reason }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Could not save review decision.');
    return data;
  },
};
