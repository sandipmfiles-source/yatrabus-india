import React, { useState, useEffect } from 'react';
import { useLanguage } from '../context/LanguageContext.js';
import { useSearchParams, Link, useNavigate } from 'react-router-dom';
import { api } from '../services/api.js';
import { JourneyCandidate } from '@shared/types/bus.js';
import { estimateDailyTripCount } from '@shared/engine/routeGraph.js';
import { BusCard } from '../components/BusCard.js';
import { ArrowLeft, Filter, AlertCircle, PlusCircle, RefreshCw } from 'lucide-react';

export const SearchResultsPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { t } = useLanguage();

  const from = searchParams.get('from') || '';
  const to = searchParams.get('to') || '';

  const [isLoading, setIsLoading] = useState(true);
  const [directRoutes, setDirectRoutes] = useState<JourneyCandidate[]>([]);
  const [transferRoutes, setTransferRoutes] = useState<JourneyCandidate[]>([]);
  const [filterType, setFilterType] = useState<'ALL' | 'DIRECT' | 'LIVE'>('ALL');

  useEffect(() => {
    if (!from || !to) return;

    setIsLoading(true);
    api.searchRoutes(from, to).then(res => {
      setDirectRoutes(res.directRoutes || []);
      setTransferRoutes(res.transferRoutes || []);
      setIsLoading(false);
    });
  }, [from, to]);

  const allJourneys = [...directRoutes, ...transferRoutes];

  const timetablePanel = (journey: JourneyCandidate) => {
    const route = journey.route;
    const departures = (route.departures || []).filter(item => !item.isCancelled)
      .slice().sort((a, b) => a.departureTime.localeCompare(b.departureTime));
    const exactDepartures = departures.length > 0;
    const estimate = estimateDailyTripCount(route.firstDepartureTime, route.lastDepartureTime, route.frequencyMinutes);
    const dayCounts = (route.operatingDays || []).map(day =>
      departures.filter(item => !item.operatingDays?.length || item.operatingDays.includes(day)).length
    );
    const exactCount = exactDepartures
      ? (dayCounts.length ? { min: Math.min(...dayCounts), max: Math.max(...dayCounts) } : { min: departures.length, max: departures.length })
      : null;
    const countLabel = exactCount
      ? (exactCount.min === exactCount.max ? String(exactCount.min) : `${exactCount.min}–${exactCount.max}`)
      : estimate !== undefined ? `~${estimate}` : t('not_verified');
    const estimatedSlots = estimate && route.frequencyMinutes
      ? Array.from({ length: Math.min(estimate, 30) }, (_, index) => {
          const [hours, minutes] = route.firstDepartureTime.split(':').map(Number);
          const total = hours * 60 + minutes + index * route.frequencyMinutes!;
          return { key: `estimated-${index}`, time: `${String(Math.floor(total / 60) % 24).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`, busIdentifier: '' };
        })
      : [];
    const departureSlots = exactDepartures
      ? departures.slice(0, 30).map(item => ({ key: item.id, time: item.departureTime, busIdentifier: item.busIdentifier || '' }))
      : estimatedSlots;
    const firstIndex = route.stops.findIndex(stop => stop.id === journey.boardingStop.id);
    const lastIndex = route.stops.findIndex(stop => stop.id === journey.alightingStop.id);
    const segmentStops = firstIndex >= 0 && lastIndex >= firstIndex
      ? route.stops.slice(firstIndex, lastIndex + 1)
      : [journey.boardingStop, journey.alightingStop];
    const scheduleVerified = route.verificationStatus === 'ADMIN_VERIFIED' && route.serviceStatus !== 'SCHEDULE_UNVERIFIED';

    return (
      <section key={journey.id + '-timetable'} className="mt-3 rounded-2xl border border-yatriwarm-200 bg-white p-4 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h3 className="flex items-center gap-2 text-sm font-bold text-yatriwarm-900"><Clock3 className="w-4 h-4 text-yatribrand-800" />{t('timetable_panel_title')}</h3>
          <span className={`text-[10px] rounded-full px-2 py-1 font-semibold ${scheduleVerified ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-800'}`}>
            {scheduleVerified ? t('verified') : t('unverified')}
          </span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <div className="rounded-xl bg-yatriwarm-50 p-2"><div className="text-[10px] text-yatriwarm-500">{t('first_bus')}</div><div className="text-sm font-bold text-yatriwarm-900">{route.firstDepartureTime || t('not_provided')}</div></div>
          <div className="rounded-xl bg-yatriwarm-50 p-2"><div className="text-[10px] text-yatriwarm-500">{t('last_bus')}</div><div className="text-sm font-bold text-yatriwarm-900">{route.lastDepartureTime || t('not_provided')}</div></div>
          <div className="rounded-xl bg-yatriwarm-50 p-2"><div className="text-[10px] text-yatriwarm-500">{t('frequency')}</div><div className="text-sm font-bold text-yatriwarm-900">{route.frequencyMinutes ? `${t('every')} ${route.frequencyMinutes} ${t('minutes')}` : t('not_provided')}</div></div>
          <div className="rounded-xl bg-yatriwarm-50 p-2"><div className="text-[10px] text-yatriwarm-500">{t('trips_per_day')}</div><div className="text-sm font-bold text-yatriwarm-900">{countLabel}</div></div>
        </div>
        <p className="flex items-center gap-1 text-[11px] text-yatriwarm-500"><CalendarDays className="w-3.5 h-3.5" />{t('operating_days')}: {route.operatingDays?.join(', ') || t('not_provided')}</p>
        {departureSlots.length > 0 && <div>
          <div className="text-[11px] font-semibold text-yatriwarm-700">{exactDepartures ? t('scheduled_departures') : t('estimated_departures')}</div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {departureSlots.map(item => <span key={item.key} className="rounded-lg bg-yatriwarm-100 px-2 py-1 text-[11px] tabular-nums text-yatriwarm-800">
              {item.time}{item.busIdentifier ? ` · ${item.busIdentifier}` : ''}
            </span>)}
          </div>
          {(exactDepartures ? departures.length : estimate || 0) > 30 && <p className="mt-1 text-[10px] text-yatriwarm-500">{t('showing_first')} 30 {exactDepartures ? t('of_total') : t('of_approximately')} {exactDepartures ? departures.length : estimate} {t('departures')}</p>}
        </div>}
        <div>
          <div className="mb-2 flex items-center gap-2 text-xs font-bold text-yatriwarm-800"><MapPin className="w-3.5 h-3.5 text-yatribrand-800" />{t('stops_between')} {journey.boardingStop.stopName} → {journey.alightingStop.stopName}</div>
          <ol className="relative ml-2 border-l-2 border-yatribrand-200 pl-4 space-y-2">
            {segmentStops.map(stop => <li key={stop.id} className="relative">
              <span className="absolute -left-[21px] top-1 w-2.5 h-2.5 rounded-full border-2 border-yatribrand-700 bg-white" />
              <div className="flex items-center justify-between gap-3"><span className="text-xs font-medium text-yatriwarm-800">{stop.stopName}</span><span className="text-[11px] tabular-nums text-yatriwarm-500">{stop.scheduledArrivalTime || stop.scheduledDepartureTime || t('time_not_listed')}</span></div>
            </li>)}
          </ol>
        </div>
        <p className="text-[10px] text-yatriwarm-500">{scheduleVerified ? t('verified_schedule') : t('unverified_schedule')}</p>
      </section>
    );
  };

  const filteredJourneys = allJourneys.filter(j => {
    if (filterType === 'DIRECT') return j.isDirect;
    if (filterType === 'LIVE') return j.locationStatus === 'LIVE';
    return true;
  });

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
      {/* Top Bar with back button & query summary */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate('/')}
          className="p-2 rounded-xl bg-white hover:bg-yatriwarm-100 border border-yatriwarm-200 text-yatriwarm-700 transition-colors shadow-subtle"
          aria-label={t('back_to_search')}
        >
          <ArrowLeft className="w-5 h-5" />
        </button>

        <div className="flex-1">
          <div className="text-xs font-semibold text-yatriwarm-500 uppercase tracking-wider">
            {t('route_search_results')}
          </div>
          <h2 className="text-lg sm:text-xl font-bold text-yatriwarm-900 line-clamp-1">
            {from} <span className="text-yatribrand-800">→</span> {to}
          </h2>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-2 border-b border-yatriwarm-200">
        <div className="flex items-center gap-1.5 bg-white p-1 rounded-xl border border-yatriwarm-200 text-xs">
          <button
            type="button"
            onClick={() => setFilterType('ALL')}
            className={`px-3 py-1.5 rounded-lg font-medium transition-colors ${
              filterType === 'ALL'
                ? 'bg-yatribrand-900 text-white shadow-xs'
                : 'text-yatriwarm-700 hover:bg-yatriwarm-100'
            }`}
          >
            {t('filter_all_buses')} ({allJourneys.length})
          </button>
          <button
            type="button"
            onClick={() => setFilterType('DIRECT')}
            className={`px-3 py-1.5 rounded-lg font-medium transition-colors ${
              filterType === 'DIRECT'
                ? 'bg-yatribrand-900 text-white shadow-xs'
                : 'text-yatriwarm-700 hover:bg-yatriwarm-100'
            }`}
          >
            {t('filter_direct')} ({directRoutes.length})
          </button>
          <button
            type="button"
            onClick={() => setFilterType('LIVE')}
            className={`px-3 py-1.5 rounded-lg font-medium transition-colors ${
              filterType === 'LIVE'
                ? 'bg-yatribrand-900 text-white shadow-xs'
                : 'text-yatriwarm-700 hover:bg-yatriwarm-100'
            }`}
          >
            {t('filter_live_gps')} ({allJourneys.filter(j => j.locationStatus === 'LIVE').length})
          </button>
        </div>

        <span className="text-xs text-yatriwarm-500">
          {t('showing_services')}: {filteredJourneys.length}
        </span>
      </div>

      {/* Loading Skeleton */}
      {isLoading && (
        <div className="space-y-4">
          {[1, 2].map(n => (
            <div key={n} className="bg-white rounded-2xl p-6 border border-yatriwarm-200 shadow-card animate-pulse space-y-4">
              <div className="h-6 bg-yatriwarm-200 rounded w-1/4"></div>
              <div className="h-16 bg-yatriwarm-100 rounded-xl"></div>
              <div className="h-4 bg-yatriwarm-100 rounded w-1/3"></div>
            </div>
          ))}
        </div>
      )}

      {/* Results List */}
      {!isLoading && filteredJourneys.length > 0 && (
        <div className="space-y-4">
          {filteredJourneys.map(j => (
            <div key={j.id}><BusCard journey={j} />{timetablePanel(j)}</div>
          ))}
        </div>
      )}

      {!isLoading && returnJourneys.length > 0 && (
        <section className="space-y-3 pt-3">
          <div className="flex items-center gap-2"><BusFront className="w-5 h-5 text-yatribrand-800" /><h3 className="text-base font-bold text-yatriwarm-900">{t('return_buses')}: {to} → {from}</h3></div>
          {returnJourneys.map(j => <div key={'return-' + j.id}><BusCard journey={j} />{timetablePanel(j)}</div>)}
        </section>
      )}

      {/* Empty State */}
      {!isLoading && filteredJourneys.length === 0 && returnJourneys.length === 0 && (
        <div className="bg-white rounded-3xl p-8 border border-yatriwarm-200 shadow-card text-center space-y-4">
          <div className="w-12 h-12 rounded-full bg-amber-100 text-amber-800 flex items-center justify-center mx-auto">
            <AlertCircle className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-base font-bold text-yatriwarm-900">
              {t('no_verified_bus')}
            </h3>
            <p className="text-xs text-yatriwarm-600 max-w-md mx-auto mt-1">
              {t('no_verified_bus_desc')}
            </p>
          </div>

          <div className="pt-2 flex justify-center gap-3">
            <Link
              to="/contribute"
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-yatribrand-900 hover:bg-yatribrand-950 text-white text-xs font-semibold rounded-xl shadow-subtle transition-colors"
            >
              <PlusCircle className="w-4 h-4" />
              {t('add_missing_bus_route')}
            </Link>
            <Link
              to="/"
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-yatriwarm-100 hover:bg-yatriwarm-200 text-yatriwarm-800 text-xs font-medium rounded-xl transition-colors"
            >
              {t('search_different_stops')}
            </Link>
          </div>
        </div>
      )}
    </div>
  );
};
