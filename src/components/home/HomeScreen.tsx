import React, { useState, useEffect } from 'react';
import { Place, Route } from '../../types';
import { ApiClient } from '../../services/apiClient';
import { BusIllustration } from '../../assets/BusIllustration';
import {
  Search,
  ArrowUpDown,
  MapPin,
  Navigation,
  Clock,
  Sparkles,
  ShieldCheck,
  ChevronRight,
  Radio,
  PlusCircle,
  X,
  History,
  AlertCircle
} from 'lucide-react';
import { t } from '../../i18n';

interface HomeScreenProps {
  onSelectRoute: (route: Route, serviceDate?: string) => void;
  onOpenContribution: (prefillRouteId?: string) => void;
  activeJourneySessionId: string | null;
  onStopTracking: () => void;
}

export const HomeScreen: React.FC<HomeScreenProps> = ({
  onSelectRoute,
  onOpenContribution,
  activeJourneySessionId,
  onStopTracking
}) => {
  const [originQuery, setOriginQuery] = useState('');
  const [destinationQuery, setDestinationQuery] = useState('');
  const [originPlace, setOriginPlace] = useState<Place | null>(null);
  const [destinationPlace, setDestinationPlace] = useState<Place | null>(null);

  const [originSuggestions, setOriginSuggestions] = useState<Place[]>([]);
  const [destSuggestions, setDestSuggestions] = useState<Place[]>([]);
  const [activeInput, setActiveInput] = useState<'origin' | 'dest' | null>(null);

  const [searchResults, setSearchResults] = useState<any | null>(null);
  const [popularRoutes, setPopularRoutes] = useState<Route[]>([]);
  const [nearbyStops, setNearbyStops] = useState<Place[]>([]);
  const [isLocating, setIsLocating] = useState(false);
  const [nearbyError, setNearbyError] = useState('');
  const [recentSearches, setRecentSearches] = useState<{ origin: string; dest: string; originId?: string; destId?: string; date?: string }[]>([]);
  const [travelDate, setTravelDate] = useState(() => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date()));
  const [loading, setLoading] = useState(false);

  // Load recent searches from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('yatrabus_recent_searches');
    if (saved) {
      try {
        setRecentSearches(JSON.parse(saved));
      } catch {
        /* ignore invalid cached searches */
      }
    }

    // Load initial popular routes and nearby stops
    ApiClient.getAllRoutes().then(res => {
      if (res.success) setPopularRoutes(res.data.slice(0, 4));
    });

  }, []);

  // Place Autocomplete for Origin
  useEffect(() => {
    if (originQuery.trim().length > 0 && !originPlace) {
      const timer = setTimeout(() => {
        ApiClient.searchPlaces(originQuery, 6).then(res => {
          if (res.success) setOriginSuggestions(res.data);
        });
      }, 150);
      return () => clearTimeout(timer);
    } else {
      setOriginSuggestions([]);
    }
  }, [originQuery, originPlace]);

  // Place Autocomplete for Destination
  useEffect(() => {
    if (destinationQuery.trim().length > 0 && !destinationPlace) {
      const timer = setTimeout(() => {
        ApiClient.searchPlaces(destinationQuery, 6).then(res => {
          if (res.success) setDestSuggestions(res.data);
        });
      }, 150);
      return () => clearTimeout(timer);
    } else {
      setDestSuggestions([]);
    }
  }, [destinationQuery, destinationPlace]);

  const handleFindNearbyStops = () => {
    setNearbyError('');
    if (typeof navigator === 'undefined' || !('geolocation' in navigator)) {
      setNearbyError(t('nearby_location_unavailable'));
      return;
    }
    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      position => {
        ApiClient.getNearbyPlaces(position.coords.latitude, position.coords.longitude, 10)
          .then(res => {
            if (res.success) setNearbyStops(res.data.slice(0, 6));
            else {
              setNearbyStops([]);
              setNearbyError(res.error || t('nearby_search_failed'));
            }
          })
          .catch(() => {
            setNearbyStops([]);
            setNearbyError(t('nearby_search_failed'));
          })
          .finally(() => setIsLocating(false));
      },
      () => {
        setNearbyStops([]);
        setNearbyError(t('nearby_permission_needed'));
        setIsLocating(false);
      },
      { maximumAge: 60000, timeout: 8000 }
    );
  };

  const handleSwap = () => {
    const tempP = originPlace;
    const tempQ = originQuery;
    setOriginPlace(destinationPlace);
    setOriginQuery(destinationQuery);
    setDestinationPlace(tempP);
    setDestinationQuery(tempQ);
  };

  const handleSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!originPlace || !destinationPlace) return;

    setLoading(true);
    try {
      const res = await ApiClient.searchRoutes(originPlace.id, destinationPlace.id, travelDate);
      if (res.success) {
        setSearchResults(res.data);

        // Save recent search
        const updated = [
          { origin: originPlace.canonicalName, dest: destinationPlace.canonicalName, originId: originPlace.id, destId: destinationPlace.id, date: travelDate },
          ...recentSearches.filter(
            s => !(s.origin === originPlace.canonicalName && s.dest === destinationPlace.canonicalName)
          )
        ].slice(0, 5);

        setRecentSearches(updated);
        localStorage.setItem('yatrabus_recent_searches', JSON.stringify(updated));
      }
    } catch (err) {
      console.error('Search error:', err);
    } finally {
      setLoading(false);
    }
  };

  const selectRecentSearch = async (item: { origin: string; dest: string; originId?: string; destId?: string; date?: string }) => {
    setOriginQuery(item.origin);
    setDestinationQuery(item.dest);
    const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
    setTravelDate(item.date && item.date >= today ? item.date : today);
    setSearchResults(null);
    try {
      const [originResult, destinationResult] = item.originId && item.destId
        ? await Promise.all([ApiClient.getPlaceById(item.originId), ApiClient.getPlaceById(item.destId)])
        : await Promise.all([ApiClient.searchPlaces(item.origin, 8), ApiClient.searchPlaces(item.dest, 8)]);
      const resolvePlace = (result: any, name: string) => {
        if (!result?.success) return null;
        if (result.data && !Array.isArray(result.data)) return result.data;
        const rows = Array.isArray(result.data) ? result.data : [];
        return rows.find((place: Place) => place.canonicalName.toLowerCase() === name.toLowerCase()) || null;
      };
      setOriginPlace(resolvePlace(originResult, item.origin));
      setDestinationPlace(resolvePlace(destinationResult, item.dest));
    } catch {
      setOriginPlace(null);
      setDestinationPlace(null);
    }
  };

  const clearRecentSearches = () => {
    setRecentSearches([]);
    localStorage.removeItem('yatrabus_recent_searches');
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-8">
      {/* Active Live Tracking Banner if enabled */}
      {activeJourneySessionId && (
        <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-950 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-sm animate-fade-in">
          <div className="flex items-center space-x-3">
            <span className="w-3 h-3 rounded-full bg-emerald-500 animate-ping" />
            <p className="text-xs font-semibold">
              {t('tracking_active_banner')}
            </p>
          </div>
          <button
            onClick={onStopTracking}
            className="px-3 py-1.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-bold transition shadow-sm"
          >
            {t('btn_stop_sharing')}
          </button>
        </div>
      )}

      {/* Original YatraBus home heading */}
      <div className="text-center space-y-3">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-yatribrand-100 text-yatribrand-900 text-xs font-semibold">
          <Sparkles className="w-3.5 h-3.5 text-yatribrand-700" />
          <span>India Bus Travel Directory</span>
        </div>
        <h1 className="text-[clamp(0.78rem,4.2vw,2rem)] whitespace-nowrap font-extrabold text-yatriwarm-950 tracking-tight">
          {t('home_tagline')}
        </h1>
        <p className="text-[10px] sm:text-xs leading-tight text-yatriwarm-600 max-w-2xl mx-auto">
          {t('home_coverage_notice')}
        </p>
      </div>

      {/* Route Search Card */}
      <div className="p-5 sm:p-7 rounded-3xl bg-white border border-yatriwarm-200 shadow-elevated relative z-20">
        <form onSubmit={handleSearch} className="space-y-4">
          <div className="relative grid grid-cols-1 md:grid-cols-[1fr,auto,1fr] gap-y-3.5 gap-x-3 items-center">
            {/* Origin Input */}
            <div className="relative">
              <label className="block text-xs font-bold text-yatriwarm-700 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                <BusIllustration variant="icon" className="w-4 h-4" />
                {t('search_from_label')}
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-brand-900">
                  <MapPin className="w-4 h-4" />
                </div>
                <input
                  type="text"
                  placeholder="e.g. Mehrauli, Kashmiri Gate, Borivali, Esplanade..."
                  value={originQuery}
                  onFocus={() => setActiveInput('origin')}
                  onChange={e => {
                    setOriginQuery(e.target.value);
                    setOriginPlace(null);
                  }}
                  className="w-full px-4 py-3 bg-yatriwarm-50 border border-yatriwarm-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-yatribrand-800 focus:bg-white transition-all"
                />
                {originQuery && (
                  <button
                    type="button"
                    onClick={() => {
                      setOriginQuery('');
                      setOriginPlace(null);
                    }}
                    className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>

              {/* Origin Autocomplete Suggestions Dropdown */}
              {activeInput === 'origin' && originSuggestions.length > 0 && (
                <div className="absolute left-0 right-0 top-full mt-1.5 bg-white border border-surface-border rounded-2xl shadow-xl z-30 overflow-hidden divide-y divide-surface-border">
                  {originSuggestions.map(p => (
                    <div
                      key={p.id}
                      onClick={() => {
                        setOriginPlace(p);
                        setOriginQuery(p.canonicalName);
                        setActiveInput(null);
                      }}
                      className="p-3 hover:bg-brand-50 cursor-pointer flex items-center justify-between text-xs transition"
                    >
                      <div>
                        <div className="font-bold text-slate-900">{p.canonicalName}</div>
                        <span className="text-[11px] text-slate-500">
                          {p.district}, {p.state} • {p.placeType.replace('_', ' ')}{p.busServiceVerified === false ? ' • ' + t('location_only_unverified') : ''}
                        </span>
                      </div>
                      <span className="text-[10px] text-brand-900 font-bold uppercase bg-brand-100 px-2 py-0.5 rounded-full">
                        Select
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Swap Origin & Destination Button */}
            <div className="absolute left-1/2 top-1/2 z-10 flex -translate-x-1/2 -translate-y-1/2 justify-center md:static md:translate-x-0 md:translate-y-0 md:pt-6">
              <button
                type="button"
                onClick={handleSwap}
                className="h-9 w-9 p-2 rounded-full bg-white hover:bg-yatribrand-100 text-yatribrand-900 border-2 border-yatriwarm-200 transition-colors shadow-md"
                title={t('swap_btn')}
              >
                <ArrowUpDown className="w-4 h-4 md:rotate-90" />
              </button>
            </div>

            {/* Destination Input */}
            <div className="relative">
              <label className="block text-xs font-bold text-yatriwarm-700 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                <BusIllustration variant="icon" className="w-4 h-4" />
                {t('search_to_label')}
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-red-600">
                  <MapPin className="w-4 h-4" />
                </div>
                <input
                  type="text"
                  placeholder="e.g. Old Delhi Station, Dadar, Kolkata Airport..."
                  value={destinationQuery}
                  onFocus={() => setActiveInput('dest')}
                  onChange={e => {
                    setDestinationQuery(e.target.value);
                    setDestinationPlace(null);
                  }}
                  className="w-full px-4 py-3 bg-yatriwarm-50 border border-yatriwarm-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-yatribrand-800 focus:bg-white transition-all"
                />
                {destinationQuery && (
                  <button
                    type="button"
                    onClick={() => {
                      setDestinationQuery('');
                      setDestinationPlace(null);
                    }}
                    className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>

              {/* Destination Autocomplete Suggestions Dropdown */}
              {activeInput === 'dest' && destSuggestions.length > 0 && (
                <div className="absolute left-0 right-0 top-full mt-1.5 bg-white border border-surface-border rounded-2xl shadow-xl z-30 overflow-hidden divide-y divide-surface-border">
                  {destSuggestions.map(p => (
                    <div
                      key={p.id}
                      onClick={() => {
                        setDestinationPlace(p);
                        setDestinationQuery(p.canonicalName);
                        setActiveInput(null);
                      }}
                      className="p-3 hover:bg-brand-50 cursor-pointer flex items-center justify-between text-xs transition"
                    >
                      <div>
                        <div className="font-bold text-slate-900">{p.canonicalName}</div>
                        <span className="text-[11px] text-slate-500">
                          {p.district}, {p.state} • {p.placeType.replace('_', ' ')}{p.busServiceVerified === false ? ' • ' + t('location_only_unverified') : ''}
                        </span>
                      </div>
                      <span className="text-[10px] text-brand-900 font-bold uppercase bg-brand-100 px-2 py-0.5 rounded-full">
                        Select
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center justify-between gap-3 rounded-2xl bg-surface-subtle border border-surface-border px-3 py-2.5">
            <label htmlFor="yatrabus-travel-date" className="text-xs font-bold text-slate-700">{t('travel_date')}</label>
            <input
              id="yatrabus-travel-date"
              type="date"
              required
              min={new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())}
              value={travelDate}
              onChange={event => {
                setTravelDate(event.target.value);
                setSearchResults(null);
              }}
              className="rounded-xl border border-surface-border bg-white px-3 py-2 text-xs font-semibold text-slate-800"
            />
          </div>

          <button
            type="submit"
            disabled={!originPlace || !destinationPlace || loading}
            className="w-full py-3.5 px-4 rounded-2xl bg-brand-900 hover:bg-brand-950 text-white font-bold text-sm shadow-md transition disabled:opacity-50 flex items-center justify-center space-x-2"
          >
            <Search className="w-4 h-4" />
            <span>{loading ? 'Searching Routes...' : t('search_btn')}</span>
          </button>
        </form>

        {/* Recent Searches */}
        {recentSearches.length > 0 && (
          <div className="mt-5 pt-4 border-t border-surface-border">
            <div className="flex items-center justify-between text-xs text-slate-500 mb-2">
              <span className="flex items-center space-x-1 font-semibold">
                <History className="w-3.5 h-3.5" />
                <span>{t('recent_searches')}</span>
              </span>
              <button
                onClick={clearRecentSearches}
                className="text-[11px] hover:text-slate-800 transition"
              >
                {t('clear_recent')}
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              {recentSearches.map((item, idx) => (
                <div
                  key={idx}
                  onClick={() => { void selectRecentSearch(item); }}
                  className="px-3 py-1.5 rounded-xl bg-surface-subtle border border-surface-border text-xs text-slate-700 hover:bg-brand-50 hover:border-brand-300 cursor-pointer transition flex items-center space-x-1"
                >
                  <span>{item.origin}</span>
                  <span className="text-slate-400">➔</span>
                  <span>{item.dest}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Search Results Display */}
      {searchResults && (
        <div className="space-y-4 animate-fade-in">
          <h2 className="text-base font-bold text-slate-900">
            Available Bus Routes ({searchResults.directRoutes.length} Direct, {searchResults.transferRoutes.length} Transfer) · {travelDate}
          </h2>

          {searchResults.directRoutes.length === 0 && searchResults.transferRoutes.length === 0 ? (
            <div className="p-6 rounded-3xl bg-white border border-surface-border text-center space-y-3">
              <AlertCircle className="w-8 h-8 text-amber-500 mx-auto" />
              <p className="text-sm font-semibold text-slate-800">{t('no_results_found')}</p>
              <p className="text-xs text-slate-500 max-w-md mx-auto">{t('suggest_missing_prompt')}</p>
              <button
                onClick={() => onOpenContribution()}
                className="px-4 py-2.5 rounded-xl bg-brand-900 text-white font-semibold text-xs shadow transition inline-flex items-center space-x-1.5"
              >
                <PlusCircle className="w-4 h-4" />
                <span>Submit Missing Route</span>
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {searchResults.directRoutes.map((item: any) => (
                <div
                  key={item.route.id}
                  onClick={() => onSelectRoute(item.route, travelDate)}
                  className="p-4 sm:p-5 rounded-3xl bg-white border border-surface-border shadow-sm hover:border-brand-900 cursor-pointer transition flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                >
                  <div className="flex items-center space-x-3">
                    <div className="w-12 h-12 rounded-2xl bg-brand-50 border border-brand-200 text-brand-900 flex flex-col items-center justify-center shrink-0">
                      <span className="text-[10px] font-bold uppercase">Route</span>
                      <span className="text-xs font-extrabold">{item.route.routeNumber}</span>
                    </div>

                    <div>
                      <div className="flex items-center space-x-2">
                        <h3 className="font-bold text-sm text-slate-900">{item.route.name}</h3>
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${item.route.verificationStatus === 'admin_verified' ? 'bg-emerald-100 text-emerald-800' : item.route.verificationStatus === 'community_corroborated' ? 'bg-sky-100 text-sky-800' : 'bg-amber-100 text-amber-900'}`}>
                          {t(item.route.verificationStatus === 'admin_verified' ? 'badge_admin_verified' : item.route.verificationStatus === 'community_corroborated' ? 'badge_community' : item.route.verificationStatus === 'published_unverified' ? 'badge_published_unverified' : 'badge_unverified')}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 mt-1">
                        Board at stop #{item.boardStopSequence} • {item.stopsCount} stops total • ~{item.estimatedMinutes} mins
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between sm:justify-end space-x-4 shrink-0 pt-2 sm:pt-0 border-t sm:border-0 border-surface-border">
                    <div className="text-left sm:text-right">
                      <div className="font-bold text-brand-900 text-sm">
                        {item.route.frequencyMinutes ? `${t('frequency')} ${item.route.frequencyMinutes} min` : t('frequency_unavailable')}
                      </div>
                      <span className="text-[11px] text-slate-400">
                        {item.route.firstDepartureTime && item.route.lastDepartureTime ? `${item.route.firstDepartureTime} - ${item.route.lastDepartureTime}` : t('schedule_times_unavailable')}
                      </span>
                    </div>

                    <div className="w-8 h-8 rounded-full bg-surface-subtle flex items-center justify-center text-slate-400">
                      <ChevronRight className="w-4 h-4" />
                    </div>
                  </div>
                </div>
              ))}

              {/* Transfer Routes Display */}
              {searchResults.transferRoutes && searchResults.transferRoutes.map((tr: any, idx: number) => (
                <div
                  key={`transfer-${idx}`}
                  className="p-4 sm:p-5 rounded-3xl bg-surface-subtle border border-surface-border shadow-sm space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <span className="px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[10px] font-bold uppercase">
                      1 Transfer Connection
                    </span>
                    <span className="text-xs font-bold text-slate-700">
                      Total: ~{tr.totalEstimatedMinutes} mins
                    </span>
                  </div>

                  {/* Step 1: First Bus */}
                  <div className="flex items-start space-x-3 text-xs">
                    <div className="w-6 h-6 rounded-full bg-brand-900 text-white flex items-center justify-center font-bold text-[10px] shrink-0 mt-0.5">
                      1
                    </div>
                    <div className="flex-1">
                      <div className="font-bold text-slate-900">
                        Board Route {tr.firstRoute.routeNumber} ({tr.firstRoute.name})
                      </div>
                      <span className="text-slate-500 text-[11px]">
                        From: {tr.firstRoute.originName}
                      </span>
                    </div>
                  </div>

                  {/* Step 2: Transfer Point */}
                  <div className="pl-9 pr-3 py-2 bg-white rounded-xl border border-dashed border-amber-300 text-xs text-amber-950 flex items-center justify-between">
                    <span>
                      Transfer at <b>{tr.transferPlace.canonicalName}</b>
                    </span>
                    <span className="text-[11px] font-semibold text-amber-800">
                      ~{tr.transferBufferMinutes || 15} min {t('transfer_buffer')}
                    </span>
                  </div>

                  {/* Step 3: Second Bus */}
                  <div className="flex items-start space-x-3 text-xs">
                    <div className="w-6 h-6 rounded-full bg-emerald-700 text-white flex items-center justify-center font-bold text-[10px] shrink-0 mt-0.5">
                      2
                    </div>
                    <div className="flex-1">
                      <div className="font-bold text-slate-900">
                        Board Route {tr.secondRoute.routeNumber} ({tr.secondRoute.name})
                      </div>
                      <span className="text-slate-500 text-[11px]">
                        To Destination: {tr.secondRoute.destinationName}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Routes with published source data */}
      <div className="space-y-3">
        <h2 className="text-sm font-bold text-slate-900">{t('popular_routes_title')}</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {popularRoutes.map(route => (
            <div
              key={route.id}
              onClick={() => onSelectRoute(route, travelDate)}
              className="p-4 rounded-2xl bg-white border border-surface-border shadow-sm hover:border-brand-900 cursor-pointer transition flex items-center justify-between"
            >
              <div>
                <div className="flex items-center space-x-2">
                  <span className="px-2 py-0.5 rounded-full bg-brand-900 text-white font-mono text-[10px] font-bold">
                    {route.routeNumber}
                  </span>
                  <span className="font-bold text-xs text-slate-900">{route.name}</span>
                </div>
                <div className="text-[11px] text-slate-500 mt-1">
                  {route.distanceKm} km • {route.durationMinutes} mins • {route.stops.length} stops
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />
            </div>
          ))}
        </div>
      </div>

      {/* Nearby bus stands and bus stops: location is requested only after the user taps */}
      <section className="yb-nearby-stop-panel rounded-2xl p-5 border shadow-subtle">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-bold flex items-center gap-1.5">
              <Navigation className="w-4 h-4" />
              {t('nearby_stops_title')}
            </h2>
            <p className="text-xs text-yatriwarm-600 mt-1">{t('nearby_stops_description')}</p>
          </div>
          <button
            type="button"
            onClick={handleFindNearbyStops}
            disabled={isLocating}
            className="yb-nearby-stop-button px-3 py-2 text-white text-xs font-bold rounded-xl border transition-all flex items-center gap-1.5 shrink-0 shadow-sm"
          >
            <Navigation className={`w-3.5 h-3.5 ${isLocating ? 'animate-spin' : ''}`} />
            {isLocating ? t('nearby_searching') : t('find_stops_near_me')}
          </button>
        </div>
        {nearbyError && <p role="status" className="text-xs text-rose-700 mt-3">{nearbyError}</p>}
        {nearbyStops.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-3 pt-3 border-t border-emerald-200">
            {nearbyStops.map(stop => (
              <button
                type="button"
                key={stop.id}
                onClick={() => {
                  setOriginPlace(stop);
                  setOriginQuery(stop.canonicalName);
                  setActiveInput(null);
                }}
                className="p-2.5 rounded-xl bg-white/80 hover:bg-white cursor-pointer border border-emerald-200 transition-colors flex items-center justify-between text-left"
              >
                <span>
                  <span className="block text-xs font-semibold text-yatriwarm-900">{stop.canonicalName}</span>
                  <span className="block text-[11px] text-yatriwarm-600">{stop.district}, {stop.state}</span>
                </span>
                <span className="text-[10px] font-bold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-md capitalize">{stop.placeType.replace('_', ' ')}</span>
              </button>
            ))}
          </div>
        )}
      </section>
    </div>
  );
};
