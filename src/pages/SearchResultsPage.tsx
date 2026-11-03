import React, { useState, useEffect } from 'react';
import { useLanguage } from '../context/LanguageContext.js';
import { useSearchParams, Link, useNavigate } from 'react-router-dom';
import { api } from '../services/api.js';
import { JourneyCandidate } from '@shared/types/bus.js';
import { estimateDailyTripCount } from '@shared/engine/routeGraph.js';
import { planJourneys } from '@shared/engine/journeyPlanner.js';
import { phase4 } from '../services/phase4.js';
import { BusCard } from '../components/BusCard.js';
import { ArrowLeft, AlertCircle, PlusCircle, Clock3, MapPin, CalendarDays, BusFront } from 'lucide-react';

function localServiceDate() {
  const now = new Date();
  return new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}

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
  const [returnJourneys, setReturnJourneys] = useState<JourneyCandidate[]>([]);
  const [offlineMode, setOfflineMode] = useState(false);
  const [serviceDate, setServiceDate] = useState(() => searchParams.get('date') || localServiceDate());
  const [gtfsLoading, setGtfsLoading] = useState(false);
  const [gtfsResults, setGtfsResults] = useState<any[]>([]);
  const [gtfsStatus, setGtfsStatus] = useState('');
  const [gtfsError, setGtfsError] = useState('');
  const [expandedGtfsRoute, setExpandedGtfsRoute] = useState('');
  const [gtfsRouteDetails, setGtfsRouteDetails] = useState<Record<string, any>>({});
  const [gtfsRouteLoading, setGtfsRouteLoading] = useState('');
  const [gtfsRouteErrors, setGtfsRouteErrors] = useState<Record<string, string>>({});


  useEffect(() => {
    if (!from || !to) {
      setIsLoading(false);
      return;
    }
    let cancelled = false;
    setIsLoading(true);
    Promise.all([api.searchRoutes(from, to), api.searchRoutes(to, from).catch(() => null)])
      .then(([res, reverse]) => {
        if (cancelled) return;
        setDirectRoutes(res.directRoutes || []);
        setTransferRoutes(res.transferRoutes || []);
        setReturnJourneys(reverse ? [...(reverse.directRoutes || []), ...(reverse.transferRoutes || [])] : []);
        setOfflineMode(false);
        void phase4.cacheVerifiedRoutes([...(res.directRoutes || []), ...(res.transferRoutes || [])].map((item: JourneyCandidate) => item.route)).catch(() => undefined);
        setIsLoading(false);
      })
      .catch(async () => {
        if (cancelled) return;
        try {
          const cached = await phase4.getOfflineRoutes();
          const planned = planJourneys(from, to, cached, { currentTimeIso: new Date().toISOString(), maximumTransfers: 0, maximumResults: 8 });
          const reverse = planJourneys(to, from, cached, { currentTimeIso: new Date().toISOString(), maximumTransfers: 0, maximumResults: 8 });
          if (!cancelled) {
            setDirectRoutes(planned.directRoutes || []);
            setTransferRoutes([]);
            setReturnJourneys(reverse.directRoutes || []);
            setOfflineMode(true);
          }
        } catch { if (!cancelled) { setDirectRoutes([]); setTransferRoutes([]); setReturnJourneys([]); } }
        if (!cancelled) setIsLoading(false);
      });
    return () => { cancelled = true; };
  }, [from, to]);

  useEffect(() => {
    if (!from || !to || !serviceDate) {
      setGtfsResults([]);
      setGtfsStatus('');
      return;
    }
    let cancelled = false;
    setGtfsLoading(true);
    setGtfsError('');
    setGtfsStatus('LOADING');
    api.searchPublicTimetable(from, to, serviceDate, 30).then(data => {
      if (cancelled) return;
      setGtfsResults(data.results || []);
      setGtfsStatus(data.timetableStatus || 'UNAVAILABLE');
      if (data.httpStatus === 503) setGtfsError(data.error || 'Validated public timetable data is not installed on the server.');
    }).catch(error => {
      if (cancelled) return;
      setGtfsResults([]);
      setGtfsStatus('ERROR');
      setGtfsError(error instanceof Error ? error.message : 'Public timetable search is unavailable.');
    }).finally(() => {
      if (!cancelled) setGtfsLoading(false);
    });
    return () => { cancelled = true; };
  }, [from, to, serviceDate]);

  const toggleGtfsRouteDetails = async (item: any) => {
    const key = `${item.feedId}:${item.routeId}:${serviceDate}`;
    if (expandedGtfsRoute === key) {
      setExpandedGtfsRoute('');
      return;
    }
    setExpandedGtfsRoute(key);
    if (gtfsRouteDetails[key]) return;
    setGtfsRouteLoading(key);
    setGtfsRouteErrors(previous => ({ ...previous, [key]: '' }));
    try {
      const data = await api.getPublicRouteDetails(item.routeId, item.feedId, serviceDate);
      if (data.httpStatus === 503) {
        setGtfsRouteErrors(previous => ({ ...previous, [key]: data.error || 'Route timetable snapshot is not installed.' }));
      } else {
        setGtfsRouteDetails(previous => ({ ...previous, [key]: data }));
      }
    } catch (error) {
      setGtfsRouteErrors(previous => ({ ...previous, [key]: error instanceof Error ? error.message : 'Could not load route details.' }));
    } finally {
      setGtfsRouteLoading('');
    }
  };

  const allJourneys = [...directRoutes, ...transferRoutes];

  const timetablePanel = (journey: JourneyCandidate) => {
    if (!journey.isDirect) return null;
    const route = journey.route;
    if (route.timetableDataStatus === 'UNAVAILABLE') {
      return (
        <section key={journey.id + '-timetable'} className="mt-3 rounded-2xl border border-amber-200 bg-amber-50/60 p-4 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-sm font-bold text-yatriwarm-900">{t('timetable_panel_title')}</h3>
            <span className="text-[10px] rounded-full px-2 py-1 font-semibold bg-slate-100 text-slate-700">UNAVAILABLE</span>
          </div>
          <p className="text-xs text-yatriwarm-700">No source-verified timetable is loaded for this route. Earlier sample times are hidden to avoid misleading passengers.</p>
          {route.timetableSourceUrl && <a href={route.timetableSourceUrl} target="_blank" rel="noreferrer" className="text-[11px] underline text-yatribrand-800">{route.timetableSource || 'Timetable source'}</a>}
          {route.timetableVerifiedAt && <p className="text-[10px] text-yatriwarm-500">Last verified: {route.timetableVerifiedAt}</p>}
        </section>
      );
    }
    const departures = (route.departures || []).filter(item => !item.isCancelled)
      .slice().sort((a, b) => ((a.departureDayOffset || 0) * 1440 + Number(a.departureTime.slice(0, 2)) * 60 + Number(a.departureTime.slice(3))) -
        ((b.departureDayOffset || 0) * 1440 + Number(b.departureTime.slice(0, 2)) * 60 + Number(b.departureTime.slice(3))));
    const exactTimes = (route.departureTimes || []).slice().sort();
    const verifiedExactDepartures = departures.filter(item => !item.isFrequencyBased || item.exactTimes === true);
    const exactDepartures = verifiedExactDepartures.length > 0 || exactTimes.length > 0;
    const estimate = estimateDailyTripCount(route.firstDepartureTime, route.lastDepartureTime, route.frequencyMinutes);
    const dayCounts = (route.operatingDays || []).map(day =>
      verifiedExactDepartures.filter(item => !item.operatingDays?.length || item.operatingDays.includes(day)).length
    );
    const exactCount = exactDepartures
      ? verifiedExactDepartures.length
        ? (dayCounts.length ? { min: Math.min(...dayCounts), max: Math.max(...dayCounts) } : { min: verifiedExactDepartures.length, max: verifiedExactDepartures.length })
        : { min: exactTimes.length, max: exactTimes.length }
      : null;
    const countLabel = exactTimes.length
      ? String(exactTimes.length)
      : estimate !== undefined
        ? `~${estimate}`
        : exactCount
          ? (exactCount.min === exactCount.max ? String(exactCount.min) : `${exactCount.min}–${exactCount.max}`)
          : t('not_verified');
    const departureSlots = departures.length
      ? departures.slice(0, 30).map(item => ({ key: item.id, time: item.departureTime, dayOffset: item.departureDayOffset || 0, approximate: item.isFrequencyBased === true && item.exactTimes !== true, busIdentifier: item.busIdentifier || '', tripId: item.tripId || '', days: item.operatingDays?.join(', ') || '' }))
      : exactTimes.slice(0, 30).map((time, index) => ({ key: `exact-time-${index}`, time, dayOffset: 0, approximate: false, busIdentifier: '', tripId: '', days: route.operatingDays?.join(', ') || '' }));
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
          <div className="text-[11px] font-semibold text-yatriwarm-700">{t('scheduled_departures')}</div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {departureSlots.map(item => <span key={item.key} className="rounded-lg bg-yatriwarm-100 px-2 py-1 text-[11px] tabular-nums text-yatriwarm-800">
              {item.time}{item.busIdentifier ? ` · ${item.busIdentifier}` : ''}{item.days ? <span className="ml-1 text-[9px] text-yatriwarm-500">({item.days})</span> : ''}
            </span>)}
          </div>
          {exactDepartures && (departures.length || exactTimes.length) > 30 && <p className="mt-1 text-[10px] text-yatriwarm-500">{t('showing_first')} 30 {t('of_total')} {departures.length || exactTimes.length} {t('departures')}</p>}
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
  const filteredReturnJourneys = returnJourneys.filter(j => {
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

      {from && to && <section className="rounded-2xl border border-yatriwarm-200 bg-white p-4 sm:p-5 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-bold text-yatriwarm-900">बस समय-सारणी · বাসের সময়সূচি · Public bus timetable</h3>
            <p className="text-[11px] text-yatriwarm-500">Published static schedules, not live GPS / प्रकाशित समय-सारणी, लाइव लोकेशन नहीं / প্রকাশিত সময়সূচি, লাইভ GPS নয়</p>
          </div>
          <label className="flex items-center gap-2 text-xs font-semibold text-yatriwarm-700">
            <span>Travel date / यात्रा की तारीख / যাত্রার তারিখ</span>
            <input type="date" value={serviceDate} onChange={event => setServiceDate(event.target.value)} className="rounded-lg border border-yatriwarm-300 bg-white px-2 py-1.5 text-xs" />
          </label>
        </div>
        {gtfsLoading && <p role="status" className="text-xs text-yatriwarm-600">Checking published timetables for {serviceDate}…</p>}
        {!gtfsLoading && gtfsError && <p role="status" className="rounded-xl bg-amber-50 p-3 text-xs text-amber-900">{gtfsError} / अभी इस सर्वर पर सत्यापित GTFS snapshot उपलब्ध नहीं है।</p>}
        {!gtfsLoading && !gtfsError && gtfsStatus === 'NO_SERVICE_FOUND' && <p className="text-xs text-yatriwarm-600">No matching published departure was found for this travel date. This does not prove that no bus service exists.</p>}
        {!gtfsLoading && gtfsResults.length > 0 && <div className="space-y-2">
          {gtfsResults.map((item, index) => <article key={item.feedId + ':' + item.tripId + ':' + index} className="rounded-xl border border-yatriwarm-200 bg-yatriwarm-50/70 p-3 space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="font-bold text-sm text-yatriwarm-900">{item.routeName}</div>
              <span className="rounded-full bg-amber-100 px-2 py-1 text-[10px] font-bold text-amber-900">UNVERIFIED · अप्रूव नहीं</span>
            </div>
            <div className="grid grid-cols-[1fr,auto,1fr] items-center gap-2">
              <div><div className="text-lg font-extrabold tabular-nums text-yatribrand-900">{item.departureTime}</div><div className="text-xs text-yatriwarm-700">{item.fromStop?.name}</div>{item.departureDayOffset > 0 && <div className="text-[10px] text-yatriwarm-500">+{item.departureDayOffset} day</div>}</div>
              <div className="text-yatriwarm-400">→</div>
              <div className="text-right"><div className="text-lg font-extrabold tabular-nums text-yatribrand-900">{item.arrivalTime}</div><div className="text-xs text-yatriwarm-700">{item.toStop?.name}</div>{item.arrivalDayOffset > 0 && <div className="text-[10px] text-yatriwarm-500">+{item.arrivalDayOffset} day</div>}</div>
            </div>
            <div className="flex flex-wrap justify-between gap-2 text-[10px] text-yatriwarm-500">
              <span>{item.feedName} · {item.region || 'India'} · {item.timezone || 'Timezone unknown'}</span>
              <span>{item.sourceType === 'OFFICIAL_PUBLISHER' ? 'Publisher feed' : 'Community-derived feed'}</span>
            </div>
            {item.attribution && <p className="text-[10px] text-yatriwarm-500">{item.attribution}</p>}
            {item.sourceUrl && <a href={item.sourceUrl} target="_blank" rel="noreferrer" className="inline-block text-[10px] font-semibold text-yatribrand-800 underline">View data source</a>}
            <button type="button" onClick={() => void toggleGtfsRouteDetails(item)} aria-expanded={expandedGtfsRoute === `${item.feedId}:${item.routeId}:${serviceDate}`} className="w-full rounded-lg border border-yatribrand-200 bg-white px-3 py-2 text-xs font-semibold text-yatribrand-900 hover:bg-yatriwarm-100">
              {expandedGtfsRoute === `${item.feedId}:${item.routeId}:${serviceDate}` ? 'Hide full route timetable' : 'View all stops & timings'}
            </button>
            {expandedGtfsRoute === `${item.feedId}:${item.routeId}:${serviceDate}` && <div className="rounded-lg border border-yatriwarm-200 bg-white p-3 space-y-2">
              {gtfsRouteLoading === `${item.feedId}:${item.routeId}:${serviceDate}` && <p role="status" className="text-xs text-yatriwarm-600">Loading stops for {serviceDate}…</p>}
              {gtfsRouteErrors[`${item.feedId}:${item.routeId}:${serviceDate}`] && <p role="status" className="text-xs text-amber-800">{gtfsRouteErrors[`${item.feedId}:${item.routeId}:${serviceDate}`]}</p>}
              {gtfsRouteDetails[`${item.feedId}:${item.routeId}:${serviceDate}`] && <>
                <div className="flex flex-wrap justify-between gap-2 text-[10px] text-yatriwarm-500">
                  <span>{gtfsRouteDetails[`${item.feedId}:${item.routeId}:${serviceDate}`].route?.longName || gtfsRouteDetails[`${item.feedId}:${item.routeId}:${serviceDate}`].route?.shortName || item.routeName}</span>
                  <span>{gtfsRouteDetails[`${item.feedId}:${item.routeId}:${serviceDate}`].serviceDate} · {gtfsRouteDetails[`${item.feedId}:${item.routeId}:${serviceDate}`].timetableStatus || 'UNVERIFIED'}</span>
                </div>
                {gtfsRouteDetails[`${item.feedId}:${item.routeId}:${serviceDate}`].trips?.length ? gtfsRouteDetails[`${item.feedId}:${item.routeId}:${serviceDate}`].trips.map((trip: any) => <div key={trip.tripId} className="border-t border-yatriwarm-100 pt-2">
                  <div className="mb-2 text-xs font-bold text-yatriwarm-800">{trip.headsign || item.routeName} · <span className="font-normal">{trip.tripId}</span></div>
                  <ol className="space-y-2">
                    {trip.stopTimes?.map((stop: any) => <li key={stop.stopId + ':' + stop.stopSequence} className="flex items-start justify-between gap-3 text-xs">
                      <span className="min-w-0 text-yatriwarm-800">{stop.stopSequence}. {stop.stopName}</span>
                      <span className="shrink-0 text-right tabular-nums text-yatriwarm-600">{stop.arrivalTime || '—'}{stop.arrivalDayOffset > 0 ? ` (+${stop.arrivalDayOffset}d)` : ''}{stop.departureTime && stop.departureTime !== stop.arrivalTime ? ` / ${stop.departureTime}` : ''}{stop.departureDayOffset > 0 ? ` (+${stop.departureDayOffset}d)` : ''}</span>
                    </li>)}
                  </ol>
                </div>) : <p className="text-xs text-yatriwarm-600">No scheduled trips for this route on the selected date.</p>}
                <p className="text-[10px] text-amber-700">Static published timetable · UNVERIFIED · Not live GPS. Times use {gtfsRouteDetails[`${item.feedId}:${item.routeId}:${serviceDate}`].agencyTimezone || item.timezone || 'the feed timezone'}.</p>
              </>}
            </div>}
          </article>)}
        </div>}
      </section>}
      {offlineMode && <div role="status" className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900">Offline mode: showing only previously saved, source-verified timetable routes. Cached schedules may be out of date; confirm with the operator before travel. Live GPS and fresh delay alerts are unavailable offline.</div>}

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

      {!isLoading && filteredReturnJourneys.length > 0 && (
        <section className="space-y-3 pt-3">
          <div className="flex items-center gap-2"><BusFront className="w-5 h-5 text-yatribrand-800" /><h3 className="text-base font-bold text-yatriwarm-900">{t('return_buses')}: {to} → {from}</h3></div>
          {filteredReturnJourneys.map(j => <div key={'return-' + j.id}><BusCard journey={j} />{timetablePanel(j)}</div>)}
        </section>
      )}

      {/* Empty State */}
      {!isLoading && filteredJourneys.length === 0 && filteredReturnJourneys.length === 0 && (
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
