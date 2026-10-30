import React from 'react';
import { Link } from 'react-router-dom';
import { JourneyCandidate } from '@shared/types/bus.js';
import { StatusBadge } from './StatusBadge.js';
import { ConfidenceBadge } from './ConfidenceBadge.js';
import { BusIllustration } from '../assets/BusIllustration.js';
import { Clock, ArrowRight, Split, BusFront } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext.js';

interface BusCardProps {
  journey: JourneyCandidate;
}

export const BusCard: React.FC<BusCardProps> = ({ journey }) => {
  const { t } = useLanguage();
  const { route, isDirect, transfers, departureTime, arrivalTime, durationMinutes, boardingStop, alightingStop, locationStatus, serviceStatus } = journey;

  return (
    <div className="bg-white rounded-2xl border border-yatriwarm-200 shadow-card hover:shadow-elevated hover:border-yatribrand-300 transition-all overflow-hidden flex flex-col justify-between">
      <div className="p-4 sm:p-5">
        {/* Header row: Route number, operator, and badges */}
        <div className="flex items-start justify-between gap-3 mb-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-lg font-bold text-yatribrand-900 tracking-tight">
                {route.routeNumber}
              </span>
              <span className="text-xs font-semibold px-2 py-0.5 rounded-md bg-yatriwarm-100 text-yatriwarm-700">
                {route.operatorName?.split(' ')[0] || 'Transit'}
              </span>
              {isDirect ? (
                <span className="text-[11px] font-medium text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                  Direct
                </span>
              ) : (
                <span className="text-[11px] font-medium text-purple-800 bg-purple-50 px-2 py-0.5 rounded-full border border-purple-200 flex items-center gap-1">
                  <Split className="w-3 h-3" />
                  1 Transfer
                </span>
              )}
            </div>
            <h3 className="text-xs text-yatriwarm-600 mt-1 font-medium line-clamp-1">
              {route.routeName}
            </h3>
            {journey.busIdentifier && <div className="text-[10px] text-yatriwarm-500 mt-1">Bus: <strong>{journey.busIdentifier}</strong></div>}
            {route.contributedBy && <div className="text-[10px] text-yatriwarm-500">Helped by {route.contributedBy}</div>}
          </div>

          <ConfidenceBadge displayState={locationStatus} />
        </div>

        {/* Departure -> Arrival Timeline */}
        <div className="bg-yatriwarm-50/80 rounded-xl p-3 border border-yatriwarm-200/60 my-3">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-base font-bold text-yatriwarm-900">{departureTime}</div>
              <div className="text-[11px] text-yatriwarm-500 font-medium flex items-center gap-1 mt-0.5">
                <BusFront className="w-4 h-4 text-yatribrand-700 shrink-0" />
                <span className="line-clamp-1">{boardingStop.stopName}</span>
              </div>
            </div>

            <div className="flex flex-col items-center px-3">
              <span className="text-[10px] font-medium text-yatriwarm-500 flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {durationMinutes} min
              </span>
              <div className="w-20 sm:w-28 h-0.5 bg-yatriwarm-300 relative my-1">
                <div className="absolute w-2 h-2 rounded-full bg-yatribrand-700 -top-[3px] left-0"></div>
                <div className="absolute w-2 h-2 rounded-full bg-emerald-500 -top-[3px] right-0"></div>
              </div>
              <span className="text-[9px] text-yatriwarm-400">
                {journey.intermediateStops ? journey.intermediateStops.length + 2 : route.stops.length} stops
              </span>
            </div>

            <div className="text-right">
              <div className="text-base font-bold text-yatriwarm-900">{arrivalTime}</div>
              <div className="text-[11px] text-yatriwarm-500 font-medium flex items-center justify-end gap-1 mt-0.5">
                <span className="line-clamp-1">{alightingStop.stopName}</span>
                <BusFront className="w-4 h-4 text-emerald-600 shrink-0" />
              </div>
            </div>
          </div>

          <div className="mt-3 text-[10px] text-yatriwarm-500">
            {t('service_hours')}: {route.firstDepartureTime}–{route.lastDepartureTime}
          </div>
          {journey.timetableDepartures && journey.timetableDepartures.length > 0 && (
            <div className="mt-3 pt-3 border-t border-yatriwarm-200">
              <div className="flex items-center justify-between mb-2">
                <div className="text-[11px] font-bold text-signal-charcoal-800">{t('verified_departures')}</div>
                <span className="text-[9px] uppercase tracking-wider font-bold text-emerald-700 bg-emerald-50 px-2 py-1 rounded-full">{t('admin_verified')}</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {journey.timetableDepartures.map(item => (
                  <div key={item.id} className="flex items-center justify-between gap-2 rounded-lg border border-signal-yellow-200 bg-white px-3 py-2">
                    <div className="min-w-0">
                      <div className="text-[11px] font-semibold text-signal-charcoal-900 truncate">{item.busIdentifier || route.routeNumber}</div>
                      <div className="text-[9px] text-yatriwarm-500">{item.operatingDays.join(', ')}</div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-xs font-bold tabular-nums text-signal-red-700">{item.departureTime}</div>
                      <div className="text-[9px] text-yatriwarm-500">{t('arrival_short')} {item.arrivalTime}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {journey.dailyTripCount !== undefined && (
            <div className="mt-3 pt-2 border-t border-yatriwarm-200 text-[11px] text-yatriwarm-700 flex flex-wrap items-center gap-x-3 gap-y-1">
              <span className="font-semibold">{t('approx_daily_departures')}: {journey.dailyTripCount}</span>
              {journey.frequencyMinutes && <span>{t('every_minutes').replace('{minutes}', String(journey.frequencyMinutes))}</span>}
            </div>
          )}

          {journey.intermediateStops && journey.intermediateStops.length > 0 && (
            <div className="mt-3 pt-2 border-t border-yatriwarm-200">
              <div className="text-[11px] font-bold text-yatriwarm-700 mb-2">{t('intermediate_stops')}</div>
              <ol className="space-y-1.5">
                {journey.intermediateStops.map((stop, index) => (
                  <li key={stop.id} className="flex items-center gap-2 text-[11px] text-yatriwarm-600">
                    <span className="w-4 h-4 rounded-full bg-yatriwarm-200 text-yatriwarm-700 flex items-center justify-center text-[9px] font-bold shrink-0">{index + 1}</span>
                    <span className="min-w-0 flex-1">{stop.stopName}</span>
                    {stop.scheduledArrivalTime && <span className="font-semibold tabular-nums">{stop.scheduledArrivalTime}</span>}
                  </li>
                ))}
              </ol>
            </div>
          )}

          {/* Transfer notice if applicable */}
          {!isDirect && transfers.length > 0 && (
            <div className="mt-2.5 pt-2 border-t border-yatriwarm-200 text-[11px] text-purple-900 flex items-center justify-between">
              <span>Change bus at <strong>{transfers[0].transferStop.stopName}</strong></span>
              <span className="text-yatriwarm-500">Wait ~{transfers[0].expectedWaitMinutes}m</span>
            </div>
          )}
        </div>

        {/* Bus Illustration Asset if no custom photograph */}
        <div className="my-2">
          <BusIllustration
            variant="compact"
            className="w-full h-24"
            routeNumber={route.routeNumber}
            destinationText={alightingStop.stopName}
          />
        </div>
      </div>

      {/* Footer action bar */}
      <div className="px-4 py-3 bg-yatriwarm-50 border-t border-yatriwarm-200 flex items-center justify-between">
        <StatusBadge status={serviceStatus} />

        <Link
          to={`/routes/${route.id}`}
          className="inline-flex items-center gap-1 text-xs font-semibold text-yatribrand-900 hover:text-yatribrand-700 transition-colors"
        >
          View Route Details
          <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>
    </div>
  );
};
