import React, { useState, useEffect } from 'react';
import { useLanguage } from '../context/LanguageContext.js';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { api } from '../services/api.js';
import { Route, RouteStop } from '@shared/types/bus.js';
import { AggregatedBusLocation } from '@shared/types/tracking.js';
import { ETAResult } from '@shared/engine/etaCalculator.js';
import { StatusBadge } from '../components/StatusBadge.js';
import { ConfidenceBadge } from '../components/ConfidenceBadge.js';
import { JourneyConfirmBanner } from '../components/JourneyConfirmBanner.js';
import { BusIllustration } from '../assets/BusIllustration.js';
import { MapView } from '../components/MapView.js';
import { ArrowLeft, Clock, MapPin, ShieldCheck, AlertTriangle, Edit3, Flag } from 'lucide-react';

export const BusDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { t } = useLanguage();

  const [isLoading, setIsLoading] = useState(true);
  const [route, setRoute] = useState<Route | null>(null);
  const [location, setLocation] = useState<AggregatedBusLocation | null>(null);
  const [stopETAs, setStopETAs] = useState<ETAResult[]>([]);

  useEffect(() => {
    if (!id) return;

    setIsLoading(true);
    api.getRouteById(id).then(res => {
      if (res.route) {
        setRoute(res.route);
        // Also fetch bus location if bus exists
        if (res.buses && res.buses.length > 0) {
          api.getBusById(res.buses[0].id).then(busRes => {
            setLocation(busRes.location);
            setStopETAs(busRes.stopETAs);
          });
        }
      }
      setIsLoading(false);
    });
  }, [id]);

  if (isLoading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8 text-center text-yatriwarm-500">
        {t('loading_route_details')}
      </div>
    );
  }

  if (!route) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8 text-center space-y-3">
        <h2 className="text-lg font-bold text-yatriwarm-900">{t('route_not_found')}</h2>
        <Link to="/" className="text-xs text-yatribrand-900 font-semibold underline">
          {t('return_to_search')}
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
      {/* Top Bar */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate(-1)}
          className="p-2 rounded-xl bg-white hover:bg-yatriwarm-100 border border-yatriwarm-200 text-yatriwarm-700 transition-colors shadow-subtle"
          aria-label="Back"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>

        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span className="text-xl font-extrabold text-yatribrand-900">{route.routeNumber}</span>
            <span className="text-xs font-semibold px-2 py-0.5 rounded-md bg-yatribrand-100 text-yatribrand-800">
              {route.operatorName || 'Transit Agency'}
            </span>
            <StatusBadge status={route.serviceStatus} />
          </div>
          <h1 className="text-sm font-semibold text-yatriwarm-600 line-clamp-1 mt-0.5">
            {route.routeName}
          </h1>
        </div>
      </div>

      {/* Journey Confirmation Prompt */}
      <JourneyConfirmBanner
        busId={route.id}
        routeId={route.id}
        routeNumber={route.routeNumber}
      />

      {/* Hero Visual Card with SVG Artwork */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white rounded-3xl p-5 border border-yatriwarm-200 shadow-card flex flex-col justify-between">
          <BusIllustration
            variant="banner"
            className="w-full h-44"
            routeNumber={route.routeNumber}
            destinationText={route.destinationStopName}
          />
          <div className="mt-4 flex items-center justify-between text-xs text-yatriwarm-600 border-t border-yatriwarm-100 pt-3">
            <span>{t('operating_days')}: <strong>{route.operatingDays.join(', ')}</strong></span>
            <span>{t('frequency_label')}: <strong>~{route.frequencyMinutes || 20}m</strong></span>
          </div>
        </div>

        {/* Live Location / Confidence Overview */}
        <div className="bg-white rounded-3xl p-5 border border-yatriwarm-200 shadow-card space-y-4 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-yatriwarm-500">
                {t('tracking_engine_status')}
              </span>
              <ConfidenceBadge displayState={location?.displayState || 'ESTIMATED'} />
            </div>

            <div className="mt-3 p-3.5 rounded-2xl bg-yatriwarm-50 border border-yatriwarm-200 text-xs space-y-1.5">
              <div className="font-semibold text-yatriwarm-900">
                {location?.statusExplanation || '{t('timetable_prediction')}'}
              </div>
              {location?.isLive && (
                <div className="text-emerald-700 font-medium">
                  ✓ {t('fresh_observation')}
                </div>
              )}
              {!location?.isLive && (
                <div className="text-yatriwarm-500">
                  {t('scheduled_location_note')}
                </div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 pt-2">
            <div className="p-3 bg-yatriwarm-50 rounded-xl border border-yatriwarm-200 text-center">
              <div className="text-[11px] text-yatriwarm-500 font-medium">{t('route_distance')}</div>
              <div className="text-base font-bold text-yatriwarm-900 mt-0.5">{route.distanceKm} km</div>
            </div>
            <div className="p-3 bg-yatriwarm-50 rounded-xl border border-yatriwarm-200 text-center">
              <div className="text-[11px] text-yatriwarm-500 font-medium">{t('typical_duration')}</div>
              <div className="text-base font-bold text-yatriwarm-900 mt-0.5">{route.typicalDurationMinutes} min</div>
            </div>
          </div>
        </div>
      </div>

      {/* Interactive Map View */}
      <div className="space-y-2">
        <h3 className="text-xs font-bold uppercase tracking-wider text-yatriwarm-700">
          {t('route_map_stops')}
        </h3>
        <MapView
          stops={route.stops}
          geometry={route.geometry}
          busLocation={location}
          className="w-full h-80 rounded-3xl overflow-hidden border border-yatriwarm-200 shadow-card"
        />
      </div>

      {/* Stop Sequence & ETA Timeline */}
      <div className="bg-white rounded-3xl p-5 sm:p-7 border border-yatriwarm-200 shadow-card space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-yatriwarm-200">
          <div>
            <h3 className="text-base font-bold text-yatriwarm-900">
              {t('ordered_stop_sequence')}
            </h3>
            <p className="text-xs text-yatriwarm-500">
              {t('eta_explanation')}
            </p>
          </div>
          <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-yatriwarm-100 text-yatriwarm-700">
            {route.stops.length} {t('stops_label')}
          </span>
        </div>

        <div className="relative pl-6 space-y-6 before:absolute before:left-2.5 before:top-3 before:bottom-3 before:w-0.5 before:bg-yatriwarm-200">
          {route.stops.map((stop, idx) => {
            const eta = stopETAs.find(e => e.stopId === stop.stopId);
            const isTerminus = idx === 0 || idx === route.stops.length - 1;

            return (
              <div key={stop.id} className="relative flex items-start justify-between gap-4">
                {/* Timeline node */}
                <div
                  className={`absolute -left-6 top-1 w-3.5 h-3.5 rounded-full border-2 border-white shadow-xs ${
                    isTerminus ? 'bg-yatribrand-900' : 'bg-emerald-500'
                  }`}
                />

                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-yatriwarm-400">#{stop.stopSequence}</span>
                    <h4 className="text-sm font-semibold text-yatriwarm-900">{stop.stopName}</h4>
                  </div>
                  <div className="text-[11px] text-yatriwarm-500 mt-0.5">
                    {stop.distanceFromStartKm} km from start
                  </div>
                </div>

                <div className="text-right shrink-0">
                  <div className="text-xs font-bold text-yatriwarm-900">
                    {eta?.predictedTime || stop.scheduledArrivalTime || '—'}
                  </div>
                  <div className="text-[10px] text-yatriwarm-500">
                    {eta?.calculationType === 'OBSERVATION_BASED' ? (
                      <span className="text-emerald-700 font-semibold">Live ETA</span>
                    ) : (
                      <span>Scheduled</span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Community Actions */}
      <div className="p-4 rounded-2xl bg-yatriwarm-100 border border-yatriwarm-200 flex flex-wrap items-center justify-between gap-3 text-xs">
        <span className="text-yatriwarm-700 font-medium">
          Noticed an incorrect schedule or temporary diversion on this bus?
        </span>

        <div className="flex items-center gap-2">
          <Link
            to={`/contribute?routeId=${route.id}&type=CORRECT_TIMETABLE`}
            className="px-3 py-1.5 bg-white hover:bg-yatribrand-50 text-yatribrand-900 font-semibold rounded-xl border border-yatriwarm-300 transition-colors flex items-center gap-1.5"
          >
            <Edit3 className="w-3.5 h-3.5 text-yatribrand-700" />
            Suggest Correction
          </Link>
          <Link
            to={`/contribute?routeId=${route.id}&type=REPORT_CHANGED_ROUTE`}
            className="px-3 py-1.5 bg-white hover:bg-rose-50 text-rose-700 font-semibold rounded-xl border border-yatriwarm-300 transition-colors flex items-center gap-1.5"
          >
            <Flag className="w-3.5 h-3.5 text-rose-600" />
            Report Issue
          </Link>
        </div>
      </div>
    </div>
  );
};
