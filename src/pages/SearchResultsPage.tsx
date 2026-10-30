import React, { useState, useEffect } from 'react';
import { useSearchParams, Link, useNavigate } from 'react-router-dom';
import { api } from '../services/api.js';
import { JourneyCandidate } from '@shared/types/bus.js';
import { BusCard } from '../components/BusCard.js';
import { ArrowLeft, AlertCircle, PlusCircle, Clock3, MapPin, CalendarDays, BusFront } from 'lucide-react';

export const SearchResultsPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const from = searchParams.get('from') || '';
  const to = searchParams.get('to') || '';

  const [isLoading, setIsLoading] = useState(true);
  const [directRoutes, setDirectRoutes] = useState<JourneyCandidate[]>([]);
  const [transferRoutes, setTransferRoutes] = useState<JourneyCandidate[]>([]);
  const [filterType, setFilterType] = useState<'ALL' | 'DIRECT' | 'LIVE'>('ALL');
  const [returnJourneys, setReturnJourneys] = useState<JourneyCandidate[]>([]);

  useEffect(() => {
    if (!from || !to) return;

    setIsLoading(true);
    Promise.all([api.searchRoutes(from, to), api.searchRoutes(to, from)]).then(([res, reverse]) => {
      setDirectRoutes(res.directRoutes || []);
      setTransferRoutes(res.transferRoutes || []);
      setReturnJourneys([...(reverse.directRoutes || []), ...(reverse.transferRoutes || [])]);
      setIsLoading(false);
    }).catch(() => setIsLoading(false));
  }, [from, to]);

  const allJourneys = [...directRoutes, ...transferRoutes];

  const timetablePanel = (journey: JourneyCandidate) => {
    const route = journey.route;
    const first = route.stops.findIndex(stop => stop.id === journey.boardingStop.id);
    const last = route.stops.findIndex(stop => stop.id === journey.alightingStop.id);
    const segmentStops = first >= 0 && last >= first ? route.stops.slice(first, last + 1) : [journey.boardingStop, journey.alightingStop];
    const toMinutes = (value: string) => { const [h, m] = value.split(':').map(Number); return h * 60 + m; };
    const frequency = route.frequencyMinutes;
    const span = toMinutes(route.lastDepartureTime) - toMinutes(route.firstDepartureTime);
    const trips = frequency && frequency > 0 && span >= 0 ? Math.floor(span / frequency) + 1 : null;
    return <section key={journey.id + '-timetable'} className="mt-3 rounded-2xl border border-yatriwarm-200 bg-white p-4">
      <div className="flex items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 text-sm font-bold text-yatriwarm-900"><Clock3 className="w-4 h-4 text-yatribrand-800" /> Bus timetable</h3>
        <span className={`text-[10px] rounded-full px-2 py-1 font-semibold ${route.verificationStatus === 'ADMIN_VERIFIED' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-800'}`}>{route.verificationStatus === 'ADMIN_VERIFIED' ? 'Admin verified' : 'Awaiting verification'}</span>
      </div>
      <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-2">
        <div className="rounded-xl bg-yatriwarm-50 p-2"><div className="text-[10px] text-yatriwarm-500">First bus</div><div className="text-sm font-bold text-yatriwarm-900">{route.firstDepartureTime}</div></div>
        <div className="rounded-xl bg-yatriwarm-50 p-2"><div className="text-[10px] text-yatriwarm-500">Last bus</div><div className="text-sm font-bold text-yatriwarm-900">{route.lastDepartureTime}</div></div>
        <div className="rounded-xl bg-yatriwarm-50 p-2"><div className="text-[10px] text-yatriwarm-500">Frequency</div><div className="text-sm font-bold text-yatriwarm-900">{frequency ? `Every ${frequency} min` : 'Not provided'}</div></div>
        <div className="rounded-xl bg-yatriwarm-50 p-2"><div className="text-[10px] text-yatriwarm-500">Trips / day</div><div className="text-sm font-bold text-yatriwarm-900">{trips === null ? 'Not verified' : `~${trips}`}</div></div>
      </div>
      <p className="mt-2 flex items-center gap-1 text-[11px] text-yatriwarm-500"><CalendarDays className="w-3.5 h-3.5" /> Operating days: {route.operatingDays?.join(', ') || 'Not provided'} {trips !== null ? '• Trip count calculated from frequency, not a live count' : ''}</p>
      <div className="mt-4">
        <div className="mb-2 flex items-center gap-2 text-xs font-bold text-yatriwarm-800"><MapPin className="w-3.5 h-3.5 text-yatribrand-800" /> Stops from {journey.boardingStop.stopName} to {journey.alightingStop.stopName}</div>
        <ol className="relative ml-2 border-l-2 border-yatribrand-200 pl-4 space-y-3">
          {segmentStops.map((stop, index) => <li key={stop.id} className="relative"><span className="absolute -left-[21px] top-1 w-2.5 h-2.5 rounded-full border-2 border-yatribrand-700 bg-white" /><div className="flex items-center justify-between gap-3"><span className="text-xs font-medium text-yatriwarm-800">{stop.stopName}</span><span className="text-[11px] tabular-nums text-yatriwarm-500">{stop.scheduledArrivalTime || stop.scheduledDepartureTime || 'Time not listed'}</span></div></li>)}
        </ol>
      </div>
      <p className="mt-3 text-[10px] text-yatriwarm-500">{route.verificationStatus === 'ADMIN_VERIFIED' ? 'Schedule verified by YatriBus administrator.' : 'Community schedule is not yet verified. Please confirm timings locally before travel.'}</p>
    </section>;
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
          aria-label="Back to search"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>

        <div className="flex-1">
          <div className="text-xs font-semibold text-yatriwarm-500 uppercase tracking-wider">
            Route Search Results
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
            All Buses ({allJourneys.length})
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
            Direct ({directRoutes.length})
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
            Live GPS ({allJourneys.filter(j => j.locationStatus === 'LIVE').length})
          </button>
        </div>

        <span className="text-xs text-yatriwarm-500">
          Showing {filteredJourneys.length} candidate services
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
            <BusCard key={j.id} journey={j} />
          ))}
        </div>
      )}

      {!isLoading && returnJourneys.length > 0 && (
        <section className="space-y-3 pt-3">
          <div className="flex items-center gap-2"><BusFront className="w-5 h-5 text-yatribrand-800" /><h3 className="text-base font-bold text-yatriwarm-900">Return buses: {to} → {from}</h3></div>
          {returnJourneys.map(j => <div key={'return-' + j.id}><BusCard journey={j} />{timetablePanel(j)}</div>)}
        </section>
      )}

      {/* Empty State */}
      {!isLoading && filteredJourneys.length === 0 && (
        <div className="bg-white rounded-3xl p-8 border border-yatriwarm-200 shadow-card text-center space-y-4">
          <div className="w-12 h-12 rounded-full bg-amber-100 text-amber-800 flex items-center justify-center mx-auto">
            <AlertCircle className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-base font-bold text-yatriwarm-900">
              No verified bus found for this route yet
            </h3>
            <p className="text-xs text-yatriwarm-600 max-w-md mx-auto mt-1">
              YatriBus is community-powered. You can help fellow commuters by submitting a bus, route, or schedule that runs on this corridor without creating an account.
            </p>
          </div>

          <div className="pt-2 flex justify-center gap-3">
            <Link
              to="/contribute"
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-yatribrand-900 hover:bg-yatribrand-950 text-white text-xs font-semibold rounded-xl shadow-subtle transition-colors"
            >
              <PlusCircle className="w-4 h-4" />
              Add Missing Bus / Route
            </Link>
            <Link
              to="/"
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-yatriwarm-100 hover:bg-yatriwarm-200 text-yatriwarm-800 text-xs font-medium rounded-xl transition-colors"
            >
              Search Different Stops
            </Link>
          </div>
        </div>
      )}
    </div>
  );
};
