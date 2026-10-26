import React, { useState, useEffect } from 'react';
import { Place, Route } from '../../types';
import { ApiClient } from '../../services/apiClient';
import { CustomBusIllustration } from '../common/CustomBusIllustration';
import {
  Search,
  ArrowUpDown,
  MapPin,
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
  onSelectRoute: (route: Route) => void;
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
  const [recentSearches, setRecentSearches] = useState<{ origin: string; dest: string }[]>([]);
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

    // Check user location for nearby stops (without hardcoding Delhi or any specific city)
    if (typeof navigator !== 'undefined' && 'geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        pos => {
          ApiClient.getNearbyPlaces(pos.coords.latitude, pos.coords.longitude, 10).then(res => {
            if (res.success) setNearbyStops(res.data.slice(0, 4));
          });
        },
        () => {
          // No location permission - do not fabricate default locations
          setNearbyStops([]);
        },
        { maximumAge: 60000, timeout: 5000 }
      );
    }
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
      const res = await ApiClient.searchRoutes(originPlace.id, destinationPlace.id);
      if (res.success) {
        setSearchResults(res.data);

        // Save recent search
        const updated = [
          { origin: originPlace.canonicalName, dest: destinationPlace.canonicalName },
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

  const clearRecentSearches = () => {
    setRecentSearches([]);
    localStorage.removeItem('yatrabus_recent_searches');
  };

  return (
    <div className="max-w-4xl mx-auto p-4 sm:p-6 space-y-6">
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

      {/* Hero Brand Banner */}
      <div className="p-6 sm:p-8 rounded-3xl bg-gradient-to-r from-brand-900 to-brand-800 text-white shadow-xl relative overflow-hidden">
        <div className="absolute right-0 top-0 bottom-0 w-1/3 opacity-10 pointer-events-none flex items-center justify-end pr-6">
          <CustomBusIllustration className="h-48 w-48" />
        </div>

        <div className="relative z-10 max-w-xl">
          <div className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full bg-white/10 backdrop-blur-md border border-white/20 text-xs font-semibold mb-3">
            <Sparkles className="w-3.5 h-3.5 text-amber-300" />
            <span>Community-Powered Transport Directory</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
            Discover Buses & Live Tracking Across India
          </h1>
          <p className="text-xs sm:text-sm text-brand-100 mt-2">
            No mandatory login. Verified timetables, intelligent fuzzy search, and consent-based live tracking.
          </p>
        </div>
      </div>

      {/* Route Search Card */}
      <div className="p-5 sm:p-7 rounded-3xl bg-white border border-surface-border shadow-md">
        <form onSubmit={handleSearch} className="space-y-4">
          <div className="relative space-y-3">
            {/* Origin Input */}
            <div className="relative">
              <label className="block text-xs font-bold text-slate-700 mb-1">
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
                  className="w-full pl-10 pr-10 py-3 rounded-2xl border border-surface-border text-sm focus:ring-2 focus:ring-brand-900 focus:outline-none bg-surface-subtle"
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
                          {p.district}, {p.state} • {p.placeType.replace('_', ' ')}
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
            <div className="flex justify-center -my-1">
              <button
                type="button"
                onClick={handleSwap}
                className="p-2 rounded-full bg-surface-subtle hover:bg-brand-50 border border-surface-border text-slate-600 hover:text-brand-900 transition shadow-sm"
                title={t('swap_btn')}
              >
                <ArrowUpDown className="w-4 h-4" />
              </button>
            </div>

            {/* Destination Input */}
            <div className="relative">
              <label className="block text-xs font-bold text-slate-700 mb-1">
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
                  className="w-full pl-10 pr-10 py-3 rounded-2xl border border-surface-border text-sm focus:ring-2 focus:ring-brand-900 focus:outline-none bg-surface-subtle"
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
                          {p.district}, {p.state} • {p.placeType.replace('_', ' ')}
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
                  onClick={() => {
                    setOriginQuery(item.origin);
                    setDestinationQuery(item.dest);
                  }}
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
            Available Bus Routes ({searchResults.directRoutes.length} Direct, {searchResults.transferRoutes.length} Transfer)
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
                  onClick={() => onSelectRoute(item.route)}
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
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-100 text-emerald-800">
                          {t('badge_admin_verified')}
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
                        Every {item.route.frequencyMinutes || 15} min
                      </div>
                      <span className="text-[11px] text-slate-400">
                        {item.route.firstDepartureTime} - {item.route.lastDepartureTime}
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
                      ~12 min wait buffer
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

      {/* Popular Verified Routes Section */}
      <div className="space-y-3">
        <h2 className="text-sm font-bold text-slate-900">{t('popular_routes_title')}</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {popularRoutes.map(route => (
            <div
              key={route.id}
              onClick={() => onSelectRoute(route)}
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

      {/* Nearby Bus Stops */}
      {nearbyStops.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm font-bold text-slate-900">{t('nearby_stops_title')}</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {nearbyStops.map(stop => (
              <div
                key={stop.id}
                onClick={() => {
                  setOriginPlace(stop);
                  setOriginQuery(stop.canonicalName);
                }}
                className="p-3.5 rounded-2xl bg-white border border-surface-border shadow-sm hover:border-brand-900 cursor-pointer transition text-xs"
              >
                <MapPin className="w-4 h-4 text-brand-900 mb-1" />
                <div className="font-bold text-slate-900 line-clamp-1">{stop.canonicalName}</div>
                <span className="text-[10px] text-slate-500 capitalize">{stop.placeType.replace('_', ' ')}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
