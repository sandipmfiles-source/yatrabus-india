import { repository } from '../../backend/src/db/repository.js';
import { discoverJourneys } from '../../packages/shared/src/engine/routeGraph.js';
import { calculateStopETAs } from '../../packages/shared/src/engine/etaCalculator.js';
import { evaluateJourneyPrompt } from '../../packages/shared/src/engine/journeyConfirmationEngine.js';

const API_BASE = import.meta.env.VITE_API_BASE_URL || '/api';

export const api = {
  async searchPlaces(query: string, limit = 8) {
    try {
      const res = await fetch(`${API_BASE}/places/search?q=${encodeURIComponent(query)}&limit=${limit}`);
      if (res.ok) {
        const data = await res.json();
        return data.results || [];
      }
    } catch {}
    return repository.searchPlaces(query, limit);
  },

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

  async searchRoutes(from: string, to: string) {
    try {
      const res = await fetch(`${API_BASE}/routes/search?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`);
      if (res.ok) return await res.json();
    } catch {}
    const all = repository.getAllRoutes();
    const result = discoverJourneys(from, to, all);
    return { from, to, directCount: result.directRoutes.length, transferCount: result.transferRoutes.length, directRoutes: result.directRoutes, transferRoutes: result.transferRoutes };
  },

  async getRouteById(id: string) {
    try {
      const res = await fetch(`${API_BASE}/routes/${id}`);
      if (res.ok) return await res.json();
    } catch {}
    const route = repository.getRouteById(id);
    const buses = repository.getBusesForRoute(id);
    return { route, stopsCount: route?.stops.length || 0, buses };
  },

  async getBusById(id: string) {
    try {
      const res = await fetch(`${API_BASE}/buses/${id}`);
      if (res.ok) return await res.json();
    } catch {}
    const bus = repository.getBusById(id);
    const loc = repository.getBusLocation(id);
    const routes = repository.getAllRoutes();
    const route = routes.find(r => r.operatorId === bus?.operatorId) || routes[0];
    const stopETAs = calculateStopETAs(route.stops, 0.35, loc?.isLive ? { latitude: loc.latitude!, longitude: loc.longitude!, speedKmh: loc.speedKmh, isLive: true } : undefined);
    return { bus, location: loc, route, stopETAs };
  },

  async evaluateJourneyPrompt(routeId: string, isAlreadyTracking: boolean, dismissedCount: number) {
    try {
      const res = await fetch(`${API_BASE}/tracking/evaluate-prompt`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ routeId, isAlreadyTracking, dismissedCount }) });
      if (res.ok) return await res.json();
    } catch {}
    const route = repository.getRouteById(routeId);
    if (!route) return { shouldPrompt: false };
    return evaluateJourneyPrompt(route, { isAlreadyTrackingThisBus: isAlreadyTracking, dismissedCountForRoute: dismissedCount, hasExplicitlyDeclined: false });
  },

  async recordConsent(sessionId: string, status: string, disclosuresAccepted: boolean) {
    const res = await fetch(`${API_BASE}/tracking/consent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId, status, disclosuresAccepted }),
    });
    if (!res.ok) throw new Error('Unable to record location consent. Connect to the YatraBus backend and try again.');
    return await res.json();
  },

  async startJourneySession(busId: string, routeId: string) {
    const res = await fetch(`${API_BASE}/tracking/session/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ busId, routeId }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.session) throw new Error(data.message || 'Live tracking service is unavailable. Please try again when connected.');
    return data;
  },

  async stopJourneySession(sessionId: string, reason = 'USER_STOPPED') {
    try {
      const res = await fetch(`${API_BASE}/tracking/session/stop`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, reason }),
      });
      return res.ok;
    } catch {
      return false;
    }
  },

  async sendObservation(obs: { sessionId: string; busId: string; routeId: string; latitude: number; longitude: number; accuracyMeters: number; speedKmh?: number; headingDegrees?: number }) {
    try {
      const res = await fetch(`${API_BASE}/tracking/observation`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(obs),
      });
      if (!res.ok) return { accepted: false };
      return await res.json();
    } catch {
      return { accepted: false };
    }
  },

  async submitContribution(data: { submissionType: string; entityType: string; targetEntityId?: string; contributorNote?: string; proposedData: Record<string, any> }) {
    const res = await fetch(`${API_BASE}/contributions/submit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    const result = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(result.message || result.error || 'Contribution service is unavailable. Please try again when connected.');
    return result;
  },

  async getSubmissionStatus(refId: string) {
    const res = await fetch(`${API_BASE}/contributions/status/${encodeURIComponent(refId)}`);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.message || data.error || 'Submission status service is unavailable.');
    return data;
  },

  async submitOperatorClaim(data: any) {
    const res = await fetch(`${API_BASE}/contributions/operator-claim`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    const result = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(result.message || result.error || 'Operator claim service is unavailable.');
    return result;
  },

  // Admin endpoints deliberately fail closed: no local/demo token or data fallback.
  async adminLogin(email: string, password: string) {
    const res = await fetch(`${API_BASE}/admin/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }) });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.message || data.error || 'Administrator login failed');
    return data;
  },

  async getAdminOverview(token: string) {
    const res = await fetch(`${API_BASE}/admin/overview`, { headers: { Authorization: `Bearer ${token}` } });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.message || data.error || 'Unable to load admin dashboard');
    return data;
  },

  async getAdminSubmissions(token: string, status?: string) {
    const query = status ? `?status=${encodeURIComponent(status)}` : '';
    const res = await fetch(`${API_BASE}/admin/submissions${query}`, { headers: { Authorization: `Bearer ${token}` } });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.message || data.error || 'Unable to load submissions');
    return data;
  },

  async reviewAdminSubmission(token: string, id: string, decision: 'ADMIN_VERIFIED' | 'COMMUNITY_CORROBORATED' | 'REJECTED', reason: string) {
    const res = await fetch(`${API_BASE}/admin/submissions/${encodeURIComponent(id)}/review`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ decision, reason }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.message || data.error || 'Unable to review submission');
    return data;
  },
};
