/**
 * YatriBus Shared Types - Administrator Accounts, Automation Rules, Audit Logs & Health
 */

export type AdminRole = 'SUPER_ADMIN' | 'STATE_MODERATOR' | 'TRANSIT_VERIFIER';

export interface AdminUser {
  id: string;
  email: string;
  name: string;
  role: AdminRole;
  assignedState?: string;
  isActive: boolean;
  lastLoginAt?: string;
  createdAt: string;
}

export interface AuditLogEntry {
  id: string;
  entityType: string;
  entityId: string;
  action: 'CREATE' | 'UPDATE' | 'DELETE' | 'VERIFY' | 'MERGE' | 'ROLLBACK';
  actorId: string;
  actorRole: string;
  reason?: string;
  previousPayload?: Record<string, any>;
  newPayload?: Record<string, any>;
  timestamp: string;
}

export interface AutomationRule {
  id: string;
  ruleCode: string;
  name: string;
  description: string;
  isEnabled: boolean;
  parameters: {
    gpsAccuracyThresholdMeters?: number;
    gpsFreshnessLiveSeconds?: number;
    gpsFreshnessStaleSeconds?: number;
    autoPublishLowRiskMinorCorrections?: boolean;
    duplicateSimilarityThreshold?: number;
    maxJourneySessionHours?: number;
    staleTimetableWarningDays?: number;
  };
  lastTriggeredAt?: string;
  updatedAt: string;
}

export interface SystemHealthStats {
  status: 'HEALTHY' | 'DEGRADED' | 'DOWN';
  uptimeSeconds: number;
  databaseConnected: boolean;
  totalPlaces: number;
  totalBuses: number;
  totalRoutes: number;
  totalStops: number;
  activeJourneySessionsCount: number;
  liveBusesTrackingCount: number;
  pendingSubmissionsCount: number;
  pendingDuplicatesCount: number;
  lastImportTime?: string;
  averageConfidenceScore: number;
}
