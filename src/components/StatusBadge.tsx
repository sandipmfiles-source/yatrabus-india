import React from 'react';
import { ServiceStatus } from '@shared/types/bus.js';

interface StatusBadgeProps {
  status: ServiceStatus;
  className?: string;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, className = '' }) => {
  switch (status) {
    case 'OPERATING_SCHEDULED':
      return (
        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800 border border-emerald-200 ${className}`}>
          ● Operating as Scheduled
        </span>
      );
    case 'POSSIBLE_DELAY':
      return (
        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800 border border-amber-200 ${className}`}>
          ▲ Possible Delay
        </span>
      );
    case 'ROUTE_CHANGED':
      return (
        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 border border-blue-200 ${className}`}>
          ↺ Route Diverted
        </span>
      );
    case 'DISRUPTION_REPORTED':
      return (
        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-rose-100 text-rose-800 border border-rose-200 ${className}`}>
          ✕ Disruption Reported
        </span>
      );
    case 'SCHEDULE_UNVERIFIED':
      return (
        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yatriwarm-200 text-yatriwarm-700 border border-yatriwarm-300 ${className}`}>
          ? Schedule Unverified
        </span>
      );
    case 'POSSIBLY_DISCONTINUED':
      return (
        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-800 border border-orange-200 ${className}`}>
          ⚠ Service Under Review
        </span>
      );
    default:
      return (
        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yatriwarm-100 text-yatriwarm-600 border border-yatriwarm-200 ${className}`}>
          Status Unknown
        </span>
      );
  }
};
