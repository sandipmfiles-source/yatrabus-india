/**
 * Core Types for India-Wide Smart Bus Directory & Live Tracking Platform
 */

export type PlaceType = 
  | 'country'
  | 'state'
  | 'district'
  | 'subdivision'
  | 'tehsil'
  | 'block'
  | 'city'
  | 'town'
  | 'village'
  | 'locality'
  | 'bus_terminal'
  | 'bus_station'
  | 'bus_stop'
  | 'interchange';

export type VerificationStatus =
  | 'pending_review'
  | 'published_unverified'
  | 'community_corroborated'
  | 'admin_verified'
  | 'disputed'
  | 'possibly_discontinued'
  | 'confirmed_discontinued';

export interface PlaceAlias {
  lang: 'en' | 'hi' | 'bn' | 'ta' | 'te' | 'mr';
  name: string;
  isTransliteration?: boolean;
}

export interface Place {
  id: string;
  canonicalName: string;
  placeType: PlaceType;
  parentPlaceId?: string;
  state: string;
  district: string;
  subdivision?: string;
  latitude: number;
  longitude: number;
  sourceDataset: string;
  sourceRecordId?: string;
  verificationStatus: VerificationStatus;
  aliases: PlaceAlias[];
  lastUpdated: string;
}

export interface Operator {
  id: string;
  name: string;
  shortCode: string;
  state: string;
  serviceArea: string;
  contactPhone?: string;
  contactEmail?: string;
  isGovernment: boolean; // e.g. DTC, BEST, WBTC, BMTC, KSRTC, MTC, UPSRTC
  verificationStatus: VerificationStatus;
}

export type VehicleType = 
  | 'ordinary' 
  | 'express' 
  | 'semideluxe' 
  | 'ac_volvo' 
  | 'sleeper' 
  | 'electric';

export interface Bus {
  id: string;
  name: string; // e.g. "DTC 502", "BEST 203", "WBTC C-8", "Rajdhani Express", "Vande Seva"
  operatorId: string;
  registrationNumber?: string; // Optional, masked or privacy-protected
  vehicleType: VehicleType;
  photoUrl?: string; // If undefined, displays CustomBusIllustration
  status: 'active' | 'inactive' | 'disputed' | 'under_maintenance';
  verificationStatus: VerificationStatus;
  features: string[]; // ['ac', 'charging_point', 'low_floor', 'ladies_seat']
  createdDate: string;
  updatedDate: string;
}

export interface RouteStop {
  routeId: string;
  stopId: string;
  stopName: string;
  stopSequence: number;
  arrivalOffsetMinutes: number; // Mins from origin departure
  departureOffsetMinutes: number;
  distanceFromOriginKm: number;
  stopNotes?: string;
  latitude: number;
  longitude: number;
}

export type DayOfWeek = 'Mon' | 'Tue' | 'Wed' | 'Thu' | 'Fri' | 'Sat' | 'Sun';

export interface Route {
  id: string;
  routeNumber: string; // e.g. "502", "C-8", "500-D", "AS-1"
  name: string; // e.g. "Mehrauli to Old Delhi Railway Station"
  operatorId: string;
  originPlaceId: string;
  originName: string;
  destinationPlaceId: string;
  destinationName: string;
  direction: 'up' | 'down' | 'circular';
  durationMinutes: number;
  distanceKm: number;
  operatingDays: DayOfWeek[];
  status: 'active' | 'disrupted' | 'discontinued';
  verificationStatus: VerificationStatus;
  polyline: [number, number][]; // Lat, Lng coordinates along route
  stops: RouteStop[];
  firstDepartureTime: string; // "05:30"
  lastDepartureTime: string;  // "22:45"
  frequencyMinutes?: number;  // 15 mins
}

export interface TimetableDeparture {
  id: string;
  routeId: string;
  busId?: string;
  tripCode: string;
  departureTime: string; // HH:MM in IST
  arrivalTime: string;   // HH:MM in IST
  operatingDays: DayOfWeek[];
  vehicleType: VehicleType;
  fareInRupees?: number;
  isConfirmed: boolean;
  version: number;
  lastVerifiedDate: string;
}

export type LocationConfidence = 'high' | 'moderate' | 'low';
export type TrackingStatus = 'live_gps' | 'estimated' | 'last_known' | 'unavailable';

export interface LocationObservation {
  id: string;
  sessionId: string;
  busId: string;
  routeId: string;
  latitude: number;
  longitude: number;
  accuracyMeters: number;
  speedKmh?: number;
  heading?: number;
  timestamp: string; // ISO 8601 UTC
  confidence: LocationConfidence;
  trackingStatus: TrackingStatus;
  distanceFromRouteMeters: number;
  matchedStopId?: string;
  matchingRemarks?: string;
}

export interface JourneySession {
  sessionId: string;
  busId: string;
  routeId: string;
  startedAt: string;
  expiresAt: string;
  isActive: boolean;
  hasConsented: boolean;
  totalObservationsCount: number;
  lastPingTime: string;
}

export type SubmissionType =
  | 'add_bus'
  | 'add_stop'
  | 'suggest_route'
  | 'correct_timetable'
  | 'report_disruption'
  | 'report_discontinued'
  | 'claim_operator';

export interface CommunitySubmission {
  id: string; // e.g. SUB-2026-9812
  submissionType: SubmissionType;
  entityId?: string;
  proposedData: Record<string, any>;
  currentData?: Record<string, any>;
  contributorNotes?: string;
  duplicateCandidateIds?: string[];
  status: 'pending_review' | 'approved' | 'rejected' | 'merged';
  submittedAt: string;
  reviewedAt?: string;
  reviewedBy?: string;
  reviewRemarks?: string;
  contributorRefHash: string; // Anonymized SHA hash or token
}

export interface AuditLogEntry {
  id: string;
  timestamp: string;
  action: 'create' | 'update' | 'delete' | 'verify' | 'rollback' | 'merge';
  entityType: 'place' | 'bus' | 'route' | 'timetable' | 'operator' | 'submission';
  entityId: string;
  previousValue?: any;
  newValue: any;
  performedBy: string;
  reason: string;
  isRollbackable: boolean;
}

export interface SystemHealthMetrics {
  status: 'healthy' | 'degraded' | 'maintenance';
  uptimeSeconds: number;
  totalPlaces: number;
  totalBuses: number;
  totalRoutes: number;
  totalStops: number;
  activeLiveSessions: number;
  recentObservationsCount: number;
  pendingSubmissionsCount: number;
  disputedRoutesCount: number;
  databaseStatus: 'connected' | 'offline';
  lastImportTimestamp: string;
}

export interface ETAResult {
  routeId: string;
  stopId: string;
  stopName: string;
  scheduledArrival: string;
  predictedArrival?: string;
  isEstimated: boolean;
  delayMinutes: number;
  confidence: LocationConfidence;
  trackingStatus: TrackingStatus;
  lastUpdated: string;
  basis: 'live_gps' | 'timetable_projection' | 'historical_speed';
}

export interface AutomationRule {
  id: string;
  name: string;
  description: string;
  category: 'tracking' | 'verification' | 'moderation' | 'freshness';
  thresholdValue: number | string | boolean;
  isEnabled: boolean;
  lastTriggered?: string;
}

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  meta?: Record<string, any>;
}
