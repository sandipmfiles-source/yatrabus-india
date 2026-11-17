import React from 'react';
import { LocationDisplayState, ConfidenceCategory } from '@shared/types/tracking.js';

interface ConfidenceBadgeProps {
  displayState: LocationDisplayState;
  confidenceCategory?: ConfidenceCategory;
  ageSeconds?: number;
  className?: string;
}

export const ConfidenceBadge: React.FC<ConfidenceBadgeProps> = ({
  displayState,
  confidenceCategory,
  ageSeconds,
  className = '',
}) => {
  switch (displayState) {
    case 'LIVE':
      return (
        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-800 border border-emerald-300 ${className}`}>
          <span className="w-2 h-2 rounded-full bg-emerald-500 live-pulse-badge"></span>
          Live GPS
          {confidenceCategory ? ` • ${confidenceCategory}` : ''}
        </span>
      );
    case 'LAST_KNOWN':
      return (
        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-50 text-amber-800 border border-amber-300 ${className}`}>
          <span className="w-2 h-2 rounded-full bg-amber-500"></span>
          Last Seen {ageSeconds ? `${Math.round(ageSeconds / 60)}m ago` : ''}
        </span>
      );
    case 'ESTIMATED':
      return (
        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-sky-50 text-sky-800 border border-sky-300 ${className}`}>
          <span className="w-2 h-2 rounded-full bg-sky-400"></span>
          Timetable Prediction
        </span>
      );
    default:
      return (
        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-yatriwarm-100 text-yatriwarm-600 border border-yatriwarm-200 ${className}`}>
          <span className="w-2 h-2 rounded-full bg-yatriwarm-400"></span>
          Location Unavailable
        </span>
      );
  }
};
