/**
 * REST API Router & Controller Implementation for India-Wide Smart Bus Platform
 * Delegates to repository layer for persistence and business logic.
 */
import { getRepository } from '../repository/busRepository';
import { OperatorClaimService } from '../services/operatorClaimService';
import { AdminAuthService } from '../services/adminAuthService';

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  meta?: Record<string, any>;
}

export class ApiHandler {
  // 1. System Health
  public static async getHealth(): Promise<ApiResponse> {
    const health = await getRepository().getSystemHealth();
    return {
      success: true,
      data: health
    };
  }

  // 2. Places Search & Nearby
  public static async searchPlaces(query: string, limit: number = 8): Promise<ApiResponse> {
    const results = await getRepository().searchPlaces(query, limit);
    return {
      success: true,
      data: results.map(r => ({
        ...r.place,
        matchScore: r.score
      })),
      meta: { totalResults: results.length, query }
    };
  }

  public static async getNearbyPlaces(lat: number, lng: number, radiusKm: number = 5): Promise<ApiResponse> {
    if (isNaN(lat) || isNaN(lng)) {
      return { success: false, error: 'Valid latitude and longitude are required' };
    }
    const places = await getRepository().getNearbyPlaces(lat, lng, radiusKm);
    return {
      success: true,
      data: places,
      meta: { count: places.length, radiusKm }
    };
  }

  public static async getPlaceById(id: string): Promise<ApiResponse> {
    const place = await getRepository().getPlaceById(id);
    if (!place) {
      return { success: false, error: 'Place not found' };
    }
    return { success: true, data: place };
  }

  // 3. Routes & Search
  public static async searchRoutes(originId: string, destinationId: string): Promise<ApiResponse> {
    if (!originId || !destinationId) {
      return { success: false, error: 'Origin and destination place IDs are required' };
    }
    const routesData = await getRepository().findRoutes(originId, destinationId);
    return {
      success: true,
      data: routesData,
      meta: {
        directCount: routesData.directRoutes.length,
        transferCount: routesData.transferRoutes.length
      }
    };
  }

  public static async getAllRoutes(): Promise<ApiResponse> {
    const routes = await getRepository().getAllRoutes();
    return {
      success: true,
      data: routes
    };
  }

  public static async getRouteById(id: string): Promise<ApiResponse> {
    const route = await getRepository().getRouteById(id);
    if (!route) {
      return { success: false, error: 'Route not found' };
    }
    return { success: true, data: route };
  }

  public static async getTimetables(routeId: string): Promise<ApiResponse> {
    const timetables = await getRepository().getTimetablesByRoute(routeId);
    return {
      success: true,
      data: timetables,
      meta: { count: timetables.length }
    };
  }

  public static async getETA(routeId: string, stopId: string): Promise<ApiResponse> {
    const eta = await getRepository().calculateETA(routeId, stopId);
    return {
      success: true,
      data: eta
    };
  }

  // 4. Buses & Live Location
  public static async getAllBuses(): Promise<ApiResponse> {
    const buses = await getRepository().getAllBuses();
    return {
      success: true,
      data: buses
    };
  }

  public static async getBusById(id: string): Promise<ApiResponse> {
    const bus = await getRepository().getBusById(id);
    if (!bus) return { success: false, error: 'Bus not found' };

    const location = await getRepository().getLatestBusLocation(id);
    return {
      success: true,
      data: {
        ...bus,
        currentLocation: location || null
      }
    };
  }

  // 5. Operators
  public static async getAllOperators(): Promise<ApiResponse> {
    const operators = await getRepository().getAllOperators();
    return {
      success: true,
      data: operators
    };
  }

  // 6. Journey Tracking & Sessions
  public static async startJourneySession(payload: { busId: string; routeId: string; consent: boolean }): Promise<ApiResponse> {
    if (!payload.consent) {
      return { success: false, error: 'Explicit passenger consent is required for tracking' };
    }
    const session = await getRepository().startJourneySession(payload.busId, payload.routeId, payload.consent);
    return {
      success: true,
      data: session,
      meta: { message: 'Journey tracking session started. You can stop sharing at any time.' }
    };
  }

  public static async stopJourneySession(sessionId: string): Promise<ApiResponse> {
    const success = await getRepository().stopJourneySession(sessionId);
    return {
      success,
      data: { sessionId, stopped: success }
    };
  }

  public static async ingestObservation(payload: {
    sessionId: string;
    busId: string;
    routeId: string;
    latitude: number;
    longitude: number;
    accuracyMeters: number;
    speedKmh?: number;
    heading?: number;
    timestampStr?: string;
  }): Promise<ApiResponse> {
    const result = await getRepository().ingestLocationObservation(
      payload.sessionId,
      payload.busId,
      payload.routeId,
      payload.latitude,
      payload.longitude,
      payload.accuracyMeters,
      payload.speedKmh,
      payload.heading,
      payload.timestampStr
    );

    if (!result.accepted) {
      return { success: false, error: result.message };
    }

    return {
      success: true,
      data: result.observation,
      meta: { message: result.message }
    };
  }

  // 7. Community Contributions
  public static async submitContribution(payload: {
    submissionType: any;
    proposedData: Record<string, any>;
    contributorNotes?: string;
    contributorRef?: string;
  }): Promise<ApiResponse> {
    if (!payload.submissionType || !payload.proposedData) {
      return { success: false, error: 'Submission type and proposed data are required' };
    }

    const { submission, duplicateCandidates } = await getRepository().createSubmission(
      payload.submissionType,
      payload.proposedData,
      payload.contributorNotes,
      payload.contributorRef
    );

    return {
      success: true,
      data: submission,
      meta: {
        duplicateCandidates,
        hasDuplicates: duplicateCandidates.length > 0,
        trackingReferenceId: submission.id
      }
    };
  }

  public static async getContributionStatus(id: string): Promise<ApiResponse> {
    const sub = await getRepository().getSubmissionById(id);
    if (!sub) return { success: false, error: 'Submission reference ID not found' };
    return {
      success: true,
      data: {
        id: sub.id,
        type: sub.submissionType,
        status: sub.status,
        submittedAt: sub.submittedAt,
        reviewedAt: sub.reviewedAt,
        reviewRemarks: sub.reviewRemarks
      }
    };
  }

  // 8. Admin APIs (Protected)
  public static async adminLogin(username: string, password: string, clientIp?: string): Promise<ApiResponse> {
    const res = AdminAuthService.login(username, password, clientIp);
    if (res.success && res.token) {
      await getRepository().addAuditLog('login', 'admin', username, null, { username }, username, 'Admin authenticated');
      return {
        success: true,
        data: {
          token: res.token,
          message: 'Admin authenticated successfully'
        }
      };
    }
    await getRepository().addAuditLog('login_failed', 'admin', username || 'unknown', null, null, username || 'anonymous', `Failed admin login: ${res.error}`);
    return {
      success: false,
      error: res.error,
      meta: res.retryAfterSeconds ? { retryAfterSeconds: res.retryAfterSeconds } : undefined
    };
  }

  public static adminLogout(token: string): ApiResponse {
    const loggedOut = AdminAuthService.logout(token);
    return {
      success: true,
      data: { loggedOut }
    };
  }

  public static async getAdminSubmissions(status?: string): Promise<ApiResponse> {
    const subs = await getRepository().getAllSubmissions(status);
    return {
      success: true,
      data: subs
    };
  }

  public static async reviewSubmission(id: string, action: 'approved' | 'rejected' | 'merged', remarks: string): Promise<ApiResponse> {
    const reviewed = await getRepository().reviewSubmission(id, action, remarks);
    if (!reviewed) return { success: false, error: 'Submission not found' };
    return {
      success: true,
      data: reviewed
    };
  }

  public static async getAuditLogs(): Promise<ApiResponse> {
    const logs = await getRepository().getAuditLogs();
    return {
      success: true,
      data: logs
    };
  }

  public static async getAutomationRules(): Promise<ApiResponse> {
    const rules = await getRepository().getAutomationRules();
    return {
      success: true,
      data: rules
    };
  }

  public static async updateAutomationRule(id: string, thresholdValue: any, isEnabled: boolean): Promise<ApiResponse> {
    const updated = await getRepository().updateAutomationRule(id, thresholdValue, isEnabled);
    if (!updated) return { success: false, error: 'Rule not found' };
    return {
      success: true,
      data: updated
    };
  }

  // 9. Operator Claims
  public static submitOperatorClaim(payload: {
    operatorId: string;
    claimantName: string;
    claimantDesignation: string;
    officialPhone: string;
    officialEmail: string;
    notes?: string;
  }): ApiResponse {
    const claim = OperatorClaimService.submitClaim(
      payload.operatorId,
      payload.claimantName,
      payload.claimantDesignation,
      payload.officialPhone,
      payload.officialEmail,
      payload.notes
    );
    return { success: true, data: claim };
  }

  public static getAdminClaims(status?: string): ApiResponse {
    return { success: true, data: OperatorClaimService.getAllClaims(status) };
  }
}
