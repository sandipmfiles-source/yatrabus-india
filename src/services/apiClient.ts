import { ApiResponse } from '../types';

/**
 * Production-Ready Frontend HTTP API Client
 * Fully decoupled from backend database and internal implementation.
 * Communicates strictly via standard HTTP REST endpoints with timeout,
 * offline handling, and structured error responses.
 */
const getBaseUrl = (): string => {
  if (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_API_BASE_URL) {
    return import.meta.env.VITE_API_BASE_URL.replace(/\/$/, '');
  }
  // Capacitor Android / iOS WebView: window.location.hostname is 'localhost'
  const isCapacitorNative = typeof window !== 'undefined' && (window as any).Capacitor?.isNativePlatform?.();
  if (isCapacitorNative) {
    // In native mobile container, localhost is the phone's loopback where no Node server runs.
    console.warn('[YatraBus] Native Android environment detected without VITE_API_BASE_URL. Using production API fallback.');
    return 'https://api.yatrabus.in';
  }
  // Default to relative if deployed together, or local backend server port 3000 for web dev
  if (typeof window !== 'undefined' && window.location && window.location.hostname === 'localhost') {
    return 'http://localhost:3000';
  }
  return '';
};

const BASE_URL = getBaseUrl();

async function request<T = any>(
  endpoint: string,
  options: RequestInit = {},
  timeoutMs: number = 8000
): Promise<ApiResponse<T>> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  const token = typeof localStorage !== 'undefined' ? localStorage.getItem('yatrabus_admin_token') : null;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> || {})
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  try {
    const url = `${BASE_URL}${endpoint}`;
    const res = await fetch(url, {
      ...options,
      headers,
      signal: controller.signal
    });

    clearTimeout(timer);

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      return {
        success: false,
        error: data.error || `HTTP ${res.status}: ${res.statusText}`
      };
    }
    return data as ApiResponse<T>;
  } catch (err: any) {
    clearTimeout(timer);
    const isTimeout = err?.name === 'AbortError';
    return {
      success: false,
      error: isTimeout ? 'Request timed out' : (err?.message || 'Network connection failed')
    };
  }
}

export class ApiClient {
  public static async getHealth(): Promise<ApiResponse> {
    return request('/api/v1/health', { method: 'GET' });
  }

  public static async searchPlaces(query: string, limit: number = 8): Promise<ApiResponse> {
    return request(`/api/v1/places/search?q=${encodeURIComponent(query)}&limit=${limit}`, { method: 'GET' });
  }

  public static async getNearbyPlaces(lat: number, lng: number, radiusKm: number = 5): Promise<ApiResponse> {
    return request(`/api/v1/places/nearby?lat=${lat}&lng=${lng}&radiusKm=${radiusKm}`, { method: 'GET' });
  }

  public static async getPlaceById(id: string): Promise<ApiResponse> {
    return request(`/api/v1/places/${encodeURIComponent(id)}`, { method: 'GET' });
  }

  public static async searchRoutes(originId: string, destinationId: string): Promise<ApiResponse> {
    return request(`/api/v1/routes/search?origin=${encodeURIComponent(originId)}&destination=${encodeURIComponent(destinationId)}`, { method: 'GET' });
  }

  public static async getAllRoutes(): Promise<ApiResponse> {
    return request('/api/v1/routes', { method: 'GET' });
  }

  public static async getRouteById(id: string): Promise<ApiResponse> {
    return request(`/api/v1/routes/${encodeURIComponent(id)}`, { method: 'GET' });
  }

  public static async getTimetables(routeId: string): Promise<ApiResponse> {
    return request(`/api/v1/routes/${encodeURIComponent(routeId)}/timetables`, { method: 'GET' });
  }

  public static async getETA(routeId: string, stopId: string): Promise<ApiResponse> {
    return request(`/api/v1/routes/${encodeURIComponent(routeId)}/stops/${encodeURIComponent(stopId)}/eta`, { method: 'GET' });
  }

  public static async getAllBuses(): Promise<ApiResponse> {
    return request('/api/v1/buses', { method: 'GET' });
  }

  public static async getBusById(id: string): Promise<ApiResponse> {
    return request(`/api/v1/buses/${encodeURIComponent(id)}`, { method: 'GET' });
  }

  public static async getAllOperators(): Promise<ApiResponse> {
    return request('/api/v1/operators', { method: 'GET' });
  }

  public static async startJourneySession(busId: string, routeId: string, consent: boolean): Promise<ApiResponse> {
    return request('/api/v1/tracking/session/start', {
      method: 'POST',
      body: JSON.stringify({ busId, routeId, consent })
    });
  }

  public static async stopJourneySession(sessionId: string): Promise<ApiResponse> {
    return request(`/api/v1/tracking/session/${encodeURIComponent(sessionId)}/stop`, {
      method: 'POST'
    });
  }

  public static async sendLocationObservation(
    sessionId: string,
    busId: string,
    routeId: string,
    latitude: number,
    longitude: number,
    accuracyMeters: number,
    speedKmh?: number,
    heading?: number
  ): Promise<ApiResponse> {
    return request('/api/v1/tracking/observation', {
      method: 'POST',
      body: JSON.stringify({
        sessionId,
        busId,
        routeId,
        latitude,
        longitude,
        accuracyMeters,
        speedKmh,
        heading
      })
    });
  }

  public static async submitContribution(
    submissionType: any,
    proposedData: Record<string, any>,
    contributorNotes?: string,
    contributorRef?: string
  ): Promise<ApiResponse> {
    return request('/api/v1/contributions', {
      method: 'POST',
      body: JSON.stringify({
        submissionType,
        proposedData,
        contributorNotes,
        contributorRef
      })
    });
  }

  public static async getContributionStatus(id: string): Promise<ApiResponse> {
    return request(`/api/v1/contributions/${encodeURIComponent(id)}`, { method: 'GET' });
  }

  // Admin Authentication
  public static async adminLogin(password: string, username?: string): Promise<ApiResponse> {
    const res = await request('/api/v1/admin/login', {
      method: 'POST',
      body: JSON.stringify({ password, username: username || undefined })
    });
    if (res.success && res.data?.token && typeof localStorage !== 'undefined') {
      localStorage.setItem('yatrabus_admin_token', res.data.token);
    }
    return res;
  }

  public static adminLogout(): void {
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem('yatrabus_admin_token');
    }
  }

  // Admin Operations
  public static async getAdminSubmissions(status?: string): Promise<ApiResponse> {
    const q = status ? `?status=${encodeURIComponent(status)}` : '';
    return request(`/api/v1/admin/submissions${q}`, { method: 'GET' });
  }

  public static async reviewSubmission(id: string, action: 'approved' | 'rejected' | 'merged', remarks: string): Promise<ApiResponse> {
    return request(`/api/v1/admin/submissions/${encodeURIComponent(id)}/review`, {
      method: 'POST',
      body: JSON.stringify({ action, remarks })
    });
  }

  public static async getAuditLogs(): Promise<ApiResponse> {
    return request('/api/v1/admin/audit-logs', { method: 'GET' });
  }

  public static async getAutomationRules(): Promise<ApiResponse> {
    return request('/api/v1/admin/rules', { method: 'GET' });
  }

  public static async updateAutomationRule(id: string, thresholdValue: any, isEnabled: boolean): Promise<ApiResponse> {
    return request(`/api/v1/admin/rules/${encodeURIComponent(id)}`, {
      method: 'POST',
      body: JSON.stringify({ thresholdValue, isEnabled })
    });
  }

  // Operator Claims
  public static async submitOperatorClaim(payload: {
    operatorId: string;
    claimantName: string;
    claimantDesignation: string;
    officialPhone: string;
    officialEmail: string;
    notes?: string;
  }): Promise<ApiResponse> {
    return request('/api/v1/operator/claim', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  }

  public static async getAdminClaims(status?: string): Promise<ApiResponse> {
    const q = status ? `?status=${encodeURIComponent(status)}` : '';
    return request(`/api/v1/admin/claims${q}`, { method: 'GET' });
  }
}
