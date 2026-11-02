import { Capacitor } from '@capacitor/core';

const CONFIGURED_API_BASE = (import.meta.env.VITE_API_BASE_URL || '').trim().replace(/\/$/, '');
const API_BASE = CONFIGURED_API_BASE || '/api';

// A native APK runs from its own WebView origin. Relative /api requests do not reach
// the hosted backend, so refuse to silently fall back to bundled sample data.
function getApiBase() {
  if (Capacitor.isNativePlatform()) {
    if (!CONFIGURED_API_BASE) {
      throw new Error('YatraBus server URL is not configured in this APK. Set VITE_API_BASE_URL to your HTTPS backend URL and rebuild the APK.');
    }

    let parsedUrl: URL;
    try {
      parsedUrl = new URL(CONFIGURED_API_BASE);
    } catch {
      throw new Error('YatraBus backend URL is invalid. Configure VITE_API_BASE_URL with a valid HTTPS URL and rebuild the APK.');
    }

    if (parsedUrl.protocol !== 'https:' || !parsedUrl.hostname) {
      throw new Error('YatraBus Android builds require an HTTPS backend URL. HTTP and cleartext API connections are blocked.');
    }
  }
  return API_BASE;
}

export const api = {
  async searchPlaces(query: string, limit = 8) {
    const res = await fetch(`${getApiBase()}/places/search?q=${encodeURIComponent(query)}&limit=${limit}`);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.message || data.error || 'Place search is unavailable. Check your connection to the YatraBus server.');
    return data.results || [];
  },

  async reverseGeocodePlace(latitude: number, longitude: number) {
    const res = await fetch(`${getApiBase()}/places/reverse-geocode?lat=${latitude}&lon=${longitude}`);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.message || 'Could not identify this GPS location.');
    return data.place || null;
  },

  async searchMapPlaces(query: string) {
    const res = await fetch(`${getApiBase()}/places/geocode-search?q=${encodeURIComponent(query)}`);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.message || 'Place search is temporarily unavailable.');
    return data.results || [];
  },

  async previewRoadRoute(origin: string, destination: string, stops: string[] = []) {
    const res = await fetch(`${getApiBase()}/places/route-preview`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ origin, destination, stops }) });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.message || data.error || 'Free OpenStreetMap road-route preview is unavailable.');
    return data;
  },

  async getNearbyStops(lat: number, lon: number, radius = 3000) {
    const res = await fetch(`${getApiBase()}/places/nearby?lat=${lat}&lon=${lon}&radius=${radius}`);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.message || data.error || 'Nearby stops are unavailable.');
    return data.stops || [];
  },

  async searchRoutes(from: string, to: string) {
    const res = await fetch(`${getApiBase()}/routes/search?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.message || data.error || 'Route search is unavailable.');
    return data;
  },

  async getRouteById(id: string) {
    const res = await fetch(`${getApiBase()}/routes/${encodeURIComponent(id)}`);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.message || data.error || 'Route details are unavailable.');
    return data;
  },

  async getBusById(id: string, routeId?: string) {
    const query = routeId ? `?routeId=${encodeURIComponent(routeId)}` : '';
    const res = await fetch(`${getApiBase()}/buses/${encodeURIComponent(id)}${query}`);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.message || data.error || 'Bus details are unavailable.');
    return data;
  },

  async evaluateJourneyPrompt(routeId: string, isAlreadyTracking: boolean, dismissedCount: number) {
    const res = await fetch(`${getApiBase()}/tracking/evaluate-prompt`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ routeId, isAlreadyTracking, dismissedCount }) });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.message || data.error || 'Journey prompt service is unavailable.');
    return data;
  },

  async recordConsent(sessionId: string, status: string, disclosuresAccepted: boolean) {
    const res = await fetch(`${getApiBase()}/tracking/consent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId, status, disclosuresAccepted }),
    });
    if (!res.ok) throw new Error('Unable to record location consent. Connect to the YatraBus backend and try again.');
    return await res.json();
  },

  async startJourneySession(busId: string, routeId: string, destinationStopId?: string) {
    const res = await fetch(`${getApiBase()}/tracking/session/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ busId, routeId, destinationStopId }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.session) throw new Error(data.message || 'Live tracking service is unavailable. Please try again when connected.');
    return data;
  },

  async stopJourneySession(sessionId: string, reason = 'USER_STOPPED') {
    try {
      const res = await fetch(`${getApiBase()}/tracking/session/stop`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, reason }),
      });
      return res.ok;
    } catch {
      return false;
    }
  },

  async sendObservation(obs: { sessionId: string; busId: string; routeId: string; latitude: number; longitude: number; accuracyMeters: number; speedKmh?: number; headingDegrees?: number; locationSource?: 'GPS' | 'NETWORK' }) {
    try {
      const res = await fetch(`${getApiBase()}/tracking/observation`, {
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

  async sendCellObservation(observation: { sessionId: string; busId: string; routeId: string; radioType: string; mcc: string; mnc: string; areaCode: number; cellId: string; signalDbm: number; isRegistered: boolean; timestamp: string }) {
    try {
      const res = await fetch(`${getApiBase()}/tracking/cell-observation`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(observation),
      });
      return await res.json().catch(() => ({ accepted: false }));
    } catch {
      return { accepted: false };
    }
  },

  async submitContribution(data: { submissionType: string; entityType: string; targetEntityId?: string; contributorNote?: string; proposedData: Record<string, any> }) {
    const res = await fetch(`${getApiBase()}/contributions/submit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    const result = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(result.message || result.error || 'Contribution service is unavailable. Please try again when connected.');
    return result;
  },

  async getRouteCorrections(routeId: string) {
    const res = await fetch(`${getApiBase()}/contributions/corrections/${encodeURIComponent(routeId)}`);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.message || data.error || 'Unable to load community corrections');
    return data;
  },

  async getSubmissionStatus(refId: string) {
    const res = await fetch(`${getApiBase()}/contributions/status/${encodeURIComponent(refId)}`);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.message || data.error || 'Submission status service is unavailable.');
    return data;
  },

  async voteOnCorrection(referenceId: string, field: string, value: string, visitorId: string) {
    const res = await fetch(`${getApiBase()}/contributions/vote/${encodeURIComponent(referenceId)}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ field, value, visitorId }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.message || data.error || 'Unable to record vote');
    return data;
  },

  async submitOperatorContribution(data: { submissionType: string; entityType: string; targetEntityId?: string; contributorNote?: string; proposedData: Record<string, any>; operatorName: string; contactName: string; contactPhone: string; officialEmail?: string }) {
    const res = await fetch(`${getApiBase()}/contributions/operator-submit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    const result = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(result.message || result.error || 'Owner submission service is unavailable.');
    return result;
  },

  async submitOperatorClaim(data: any) {
    const res = await fetch(`${getApiBase()}/contributions/operator-claim`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data),
    });
    const result = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(result.message || result.error || 'Operator claim service is unavailable.');
    return result;
  },

  async adminLogin(email: string, password: string) {
    const res = await fetch(`${getApiBase()}/admin/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.message || data.error || 'Administrator login failed.');
    return data;
  },

  async adminGetAutomationRules(token: string) {
    const res = await fetch(`${getApiBase()}/admin/automation/rules`, { headers: { Authorization: `Bearer ${token}` } });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.message || data.error || 'Unable to load automation rules.');
    return data;
  },

  async adminUpdateAutomationRule(token: string, id: string, isEnabled: boolean, parameters: Record<string, any>) {
    const res = await fetch(`${getApiBase()}/admin/automation/rules/${encodeURIComponent(id)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ isEnabled, parameters }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.message || data.error || 'Unable to update automation rule.');
    return data;
  },
};
