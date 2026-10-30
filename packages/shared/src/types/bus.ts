/**
 * YatriBus Shared Types - Bus, Route, Operator, Timetables, and Service Statuses
 */

export type ServiceStatus =
  | 'OPERATING_SCHEDULED'     // Running as scheduled with corroborating data
  | 'SCHEDULE_UNVERIFIED'     // Schedule present but unconfirmed today
  | 'POSSIBLE_DELAY'          // Slow movement or delayed departure detected
  | 'ROUTE_CHANGED'           // Diverted route reported by community/operator
  | 'DISRUPTION_REPORTED'     // Transit alert or strike/breakdown reported
  | 'POSSIBLY_DISCONTINUED'   // Flagged due to repeated non-appearance, under review
  | 'CONFIRMED_DISCONTINUED'  // Officially stopped
  | 'STATUS_UNKNOWN';         // Insufficient data to determine operational status

export type VehicleType =
  | 'ORDINARY'
  | 'EXPRESS'
  | 'SEMI_DELUXE'
  | 'DELUXE_AC'
  | 'ELECTRIC_AC'
  | 'VOLVO_SCANIA'
  | 'SLEEPER'
  | 'MINI_FEEDER';

export interface Operator {
  id: string;
  name: string;
  shortCode?: string; // e.g. DTC, BEST, BMTC, KSRTC, MSRTC, WBTC
  operatorType: 'GOVERNMENT_STATE' | 'MUNICIPAL' | 'PRIVATE_FLEET' | 'COMMUNITY_COOPERATIVE';
  serviceArea: string; // State or city
  contactPhone?: string; // Public helpline
  contactWebsite?: string;
  verificationStatus: 'VERIFIED' | 'COMMUNITY_LISTED' | 'DISPUTED';
  isClaimed: boolean;
  claimedBy?: string;
  sourceDataset: string;
  createdAt: string;
  updatedAt: string;
}

export interface Bus {
  id: string;
  publicIdentifier: string; // Public bus name or number shown on front LED/board
  operatorId: string;
  operatorName?: string;
  contributedBy?: string;
  fleetRegistrationNumber?: string; // Optional (e.g. DL 1PC 4432)
  vehicleType: VehicleType;
  photoUrl?: string; // If absent, UI must render custom SVG illustration
  hasCustomSvgIllustration: boolean;
  serviceStatus: ServiceStatus;
  statusReason?: string;
  verificationStatus: 'UNVERIFIED' | 'COMMUNITY_VERIFIED' | 'ADMIN_VERIFIED';
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface RouteStop {
  id: string;
  routeId: string;
  stopId: string;
  stopName: string;
  stopSequence: number;
  latitude: number;
  longitude: number;
  distanceFromStartKm: number;
  scheduledArrivalTime?: string; // HH:MM in IST
  scheduledDepartureTime?: string; // HH:MM in IST
  platformOrBay?: string;
  notes?: string;
}

export interface RouteGeometryPoint {
  latitude: number;
  longitude: number;
}

export interface Route {
  id: string;
  routeNumber: string; // e.g., "534", "500D", "AC-105"
  routeName: string;   // e.g., "Anand Vihar ISBT to Mehrauli"
  originStopId: string;
  originStopName: string;
  destinationStopId: string;
  destinationStopName: string;
  operatorId: string;
  operatorName?: string;
  contributedBy?: string;
  direction: 'UP' | 'DOWN' | 'CIRCULAR';
  distanceKm: number;
  typicalDurationMinutes: number;
  operatingDays: ('MON' | 'TUE' | 'WED' | 'THU' | 'FRI' | 'SAT' | 'SUN')[];
  firstDepartureTime: string; // HH:MM
  lastDepartureTime: string;  // HH:MM
  frequencyMinutes?: number;
  /** Individually scheduled and admin-approved departures for this route. */
  departures?: TimetableDeparture[];
  stops: RouteStop[];
  geometry?: RouteGeometryPoint[];
  verificationStatus: 'UNVERIFIED' | 'COMMUNITY_CORROBORATED' | 'ADMIN_VERIFIED';
  serviceStatus: ServiceStatus;
  createdAt: string;
  updatedAt: string;
}

export interface TimetableDeparture {
  id: string;
  timetableId: string;
  departureTime: string; // HH:MM IST
  arrivalTime: string;   // HH:MM IST
  busIdentifier?: string;
  stopTimes?: Array<{ stopId: string; arrivalTime?: string; departureTime?: string }>;
  operatingDays: ('MON' | 'TUE' | 'WED' | 'THU' | 'FRI' | 'SAT' | 'SUN')[];
  confidenceScore: number;
  isCancelled: boolean;
}

export interface TimetableRevision {
  id: string;
  routeId: string;
  revisionNumber: number;
  changeSummary: string;
  previousSchedule: string; // JSON snapshot
  proposedSchedule: string; // JSON snapshot
  submittedBy?: string;     // Reference ID or 'ADMIN'
  submissionRefId?: string;
  approvedBy?: string;
  effectiveFrom: string;
  createdAt: string;
}

export interface JourneyCandidate {
  id: string;
  route: Route;
  bus?: Bus;
  busIdentifier?: string;
  departureTime: string;
  arrivalTime: string;
  durationMinutes: number;
  boardingStop: RouteStop;
  alightingStop: RouteStop;
  isDirect: boolean;
  transfers: {
    firstRoute: Route;
    transferStop: RouteStop;
    secondRoute: Route;
    expectedWaitMinutes: number;
  }[];
  fareEstimate?: string;
  confidenceScore: number;
  serviceStatus: ServiceStatus;
  locationStatus: 'LIVE' | 'LAST_KNOWN' | 'ESTIMATED' | 'UNAVAILABLE';
  lastKnownLocationTime?: string;
  /** Estimated number of daily departures derived from the published service window and frequency. */
  dailyTripCount?: number;
  /** Published interval between departures; this is not a real-time guarantee. */
  frequencyMinutes?: number;
  /** Stops between the selected boarding and alighting points. */
  intermediateStops?: RouteStop[];
  timetableDepartures?: TimetableDeparture[];
}
