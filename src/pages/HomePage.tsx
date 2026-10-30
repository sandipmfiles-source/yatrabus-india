import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '../context/LanguageContext.js';
import { storage, RecentSearchItem } from '../services/storage.js';
import { api } from '../services/api.js';
import { PlaceSearchResult } from '@shared/types/places.js';
import { Search, ArrowUpDown, Clock, BusFront, PlusCircle, ShieldCheck, Sparkles, Navigation } from 'lucide-react';

export const HomePage: React.FC = () => {
  const { t } = useLanguage();
  const navigate = useNavigate();

  const [fromQuery, setFromQuery] = useState('');
  const [toQuery, setToQuery] = useState('');
  const [fromSuggestions, setFromSuggestions] = useState<PlaceSearchResult[]>([]);
  const [toSuggestions, setToSuggestions] = useState<PlaceSearchResult[]>([]);
  const [isFromFocused, setIsFromFocused] = useState(false);
  const [isToFocused, setIsToFocused] = useState(false);
  const [recentSearches, setRecentSearches] = useState<RecentSearchItem[]>([]);
  const [nearbyStops, setNearbyStops] = useState<{ place: any; distanceMeters: number }[]>([]);
  const [isLocating, setIsLocating] = useState(false);

  useEffect(() => {
    setRecentSearches(storage.getRecentSearches());
  }, []);

  // Autocomplete debounced search for origin
  useEffect(() => {
    if (fromQuery.trim().length >= 2) {
      const timer = setTimeout(async () => {
        const res = await api.searchPlaces(fromQuery, 5);
        setFromSuggestions(res);
      }, 200);
      return () => clearTimeout(timer);
    } else {
      setFromSuggestions([]);
    }
  }, [fromQuery]);

  // Autocomplete debounced search for destination
  useEffect(() => {
    if (toQuery.trim().length >= 2) {
      const timer = setTimeout(async () => {
        const res = await api.searchPlaces(toQuery, 5);
        setToSuggestions(res);
      }, 200);
      return () => clearTimeout(timer);
    } else {
      setToSuggestions([]);
    }
  }, [toQuery]);

  const handleSwap = () => {
    const temp = fromQuery;
    setFromQuery(toQuery);
    setToQuery(temp);
  };

  const handleSearch = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!fromQuery.trim() || !toQuery.trim()) return;

    storage.addRecentSearch(fromQuery.trim(), toQuery.trim());
    navigate(`/search?from=${encodeURIComponent(fromQuery.trim())}&to=${encodeURIComponent(toQuery.trim())}`);
  };

  const handleSelectRecent = (item: RecentSearchItem) => {
    setFromQuery(item.from);
    setToQuery(item.to);
    navigate(`/search?from=${encodeURIComponent(item.from)}&to=${encodeURIComponent(item.to)}`);
  };

  const handleClearHistory = () => {
    storage.clearRecentSearches();
    setRecentSearches([]);
  };

  const handleFindNearbyStops = () => {
    if (!('geolocation' in navigator)) {
      alert('Geolocation is not supported by your browser.');
      return;
    }

    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      async pos => {
        const stops = await api.getNearbyStops(pos.coords.latitude, pos.coords.longitude, 4000);
        setNearbyStops(stops);
        setIsLocating(false);
      },
      err => {
        // Respectful error handling without guilt
        setIsLocating(false);
        // Fallback to default central Delhi stops for demo preview
        api.getNearbyStops(28.6469, 77.3160, 5000).then(stops => setNearbyStops(stops));
      },
      { timeout: 8000 }
    );
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-8">
      {/* Hero Banner */}
      <div className="text-center space-y-3">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-yatribrand-100 text-yatribrand-900 text-xs font-semibold">
          <Sparkles className="w-3.5 h-3.5 text-yatribrand-700" />
          <span>India-Wide Smart Bus Directory</span>
        </div>
        <h1 className="text-3xl sm:text-4xl font-extrabold text-yatriwarm-950 tracking-tight">
          Find Buses, Routes & Live GPS Tracking
        </h1>
        <p className="text-sm sm:text-base text-yatriwarm-600 max-w-xl mx-auto">
          Community-powered public transport across Indian cities and states. Discover timetables, stops, and live passenger observations with zero account required.
        </p>
      </div>

      {/* Route Search Card */}
      <div className="bg-white rounded-3xl p-5 sm:p-7 shadow-elevated border border-yatriwarm-200 relative z-20">
        <form onSubmit={handleSearch} className="space-y-4">
          <div className="relative grid grid-cols-1 md:grid-cols-[1fr,auto,1fr] gap-3 items-center">
            {/* Origin Input */}
            <div className="relative">
              <label htmlFor="from-input" className="block text-xs font-bold text-yatriwarm-700 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                <BusFront className="w-4 h-4 text-yatribrand-700" />
                From / Origin
              </label>
              <input
                id="from-input"
                type="text"
                value={fromQuery}
                onChange={e => setFromQuery(e.target.value)}
                onFocus={() => setIsFromFocused(true)}
                onBlur={() => setTimeout(() => setIsFromFocused(false), 250)}
                placeholder={t('search_placeholder_from')}
                className="w-full px-4 py-3 bg-yatriwarm-50 border border-yatriwarm-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-yatribrand-800 focus:bg-white transition-all"
                autoComplete="off"
              />

              {/* Suggestions dropdown */}
              {isFromFocused && fromSuggestions.length > 0 && (
                <div className="absolute left-0 right-0 top-full mt-1.5 bg-white rounded-xl shadow-elevated border border-yatriwarm-200 overflow-hidden z-30 divide-y divide-yatriwarm-100">
                  {fromSuggestions.map(item => (
                    <button
                      key={item.place.id}
                      type="button"
                      onMouseDown={() => {
                        setFromQuery(item.place.canonicalName);
                        setFromSuggestions([]);
                      }}
                      className="w-full px-4 py-2.5 text-left text-xs hover:bg-yatribrand-50 transition-colors flex items-center justify-between"
                    >
                      <div>
                        <div className="font-semibold text-yatriwarm-900">{item.displayLabel}</div>
                        <div className="text-[11px] text-yatriwarm-500">{item.subtitle}</div>
                      </div>
                      <span className="text-[10px] uppercase font-bold text-yatribrand-700 bg-yatribrand-100 px-1.5 py-0.5 rounded">
                        {item.matchType}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Swap Button */}
            <div className="flex justify-center -my-1 md:my-0 md:pt-6">
              <button
                type="button"
                onClick={handleSwap}
                className="p-2.5 rounded-full bg-yatriwarm-100 hover:bg-yatribrand-100 text-yatriwarm-700 hover:text-yatribrand-900 border border-yatriwarm-200 transition-colors shadow-subtle"
                title={t('swap_direction')}
                aria-label={t('swap_direction')}
              >
                <ArrowUpDown className="w-4 h-4 md:rotate-90" />
              </button>
            </div>

            {/* Destination Input */}
            <div className="relative">
              <label htmlFor="to-input" className="block text-xs font-bold text-yatriwarm-700 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                <BusFront className="w-4 h-4 text-yatribrand-700" />
                To / Destination
              </label>
              <input
                id="to-input"
                type="text"
                value={toQuery}
                onChange={e => setToQuery(e.target.value)}
                onFocus={() => setIsToFocused(true)}
                onBlur={() => setTimeout(() => setIsToFocused(false), 250)}
                placeholder={t('search_placeholder_to')}
                className="w-full px-4 py-3 bg-yatriwarm-50 border border-yatriwarm-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-yatribrand-800 focus:bg-white transition-all"
                autoComplete="off"
              />

              {/* Suggestions dropdown */}
              {isToFocused && toSuggestions.length > 0 && (
                <div className="absolute left-0 right-0 top-full mt-1.5 bg-white rounded-xl shadow-elevated border border-yatriwarm-200 overflow-hidden z-30 divide-y divide-yatriwarm-100">
                  {toSuggestions.map(item => (
                    <button
                      key={item.place.id}
                      type="button"
                      onMouseDown={() => {
                        setToQuery(item.place.canonicalName);
                        setToSuggestions([]);
                      }}
                      className="w-full px-4 py-2.5 text-left text-xs hover:bg-yatribrand-50 transition-colors flex items-center justify-between"
                    >
                      <div>
                        <div className="font-semibold text-yatriwarm-900">{item.displayLabel}</div>
                        <div className="text-[11px] text-yatriwarm-500">{item.subtitle}</div>
                      </div>
                      <span className="text-[10px] uppercase font-bold text-yatribrand-700 bg-yatribrand-100 px-1.5 py-0.5 rounded">
                        {item.matchType}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Search Button */}
          <button
            type="submit"
            className="w-full py-3.5 px-6 bg-yatribrand-900 hover:bg-yatribrand-950 text-white font-bold text-base rounded-2xl shadow-card transition-all flex items-center justify-center gap-2"
          >
            <Search className="w-5 h-5" />
            {t('search_button')}
          </button>
        </form>

        {/* Feature Guarantees */}
        <div className="mt-4 pt-4 border-t border-yatriwarm-100 flex flex-wrap items-center justify-center gap-4 text-xs text-yatriwarm-500">
          <span className="flex items-center gap-1">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
            No account required
          </span>
          <span>•</span>
          <span className="flex items-center gap-1">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
            Transparent GPS confidence
          </span>
          <span>•</span>
          <span className="flex items-center gap-1">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
            ₹0 Paid AI APIs
          </span>
        </div>
      </div>

      {/* Recent Searches (stored on user's device) */}
      {recentSearches.length > 0 && (
        <div className="bg-white rounded-2xl p-5 border border-yatriwarm-200 shadow-subtle">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs font-bold text-yatriwarm-700 uppercase tracking-wider flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-yatriwarm-400" />
              {t('recent_searches')}
            </h3>
            <button
              onClick={handleClearHistory}
              className="text-xs text-yatriwarm-400 hover:text-rose-600 transition-colors"
            >
              {t('clear_recent')}
            </button>
          </div>

          <div className="flex flex-wrap gap-2">
            {recentSearches.map(item => (
              <button
                key={item.id}
                onClick={() => handleSelectRecent(item)}
                className="px-3 py-1.5 rounded-xl bg-yatriwarm-100 hover:bg-yatribrand-50 hover:text-yatribrand-900 border border-yatriwarm-200 text-xs text-yatriwarm-700 font-medium transition-colors flex items-center gap-1.5"
              >
                <span>{item.from}</span>
                <span className="text-yatriwarm-400">→</span>
                <span>{item.to}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Nearby Bus Stops Widget */}
      <div className="bg-white rounded-2xl p-5 border border-yatriwarm-200 shadow-subtle">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="text-sm font-bold text-yatriwarm-900 flex items-center gap-1.5">
              <Navigation className="w-4 h-4 text-yatribrand-800" />
              {t('nearby_stops')}
            </h3>
            <p className="text-xs text-yatriwarm-500">
              Locate verified bus terminals and stops near your current location.
            </p>
          </div>

          <button
            onClick={handleFindNearbyStops}
            disabled={isLocating}
            className="px-3 py-1.5 bg-yatribrand-50 hover:bg-yatribrand-100 text-yatribrand-900 text-xs font-semibold rounded-xl border border-yatribrand-200 transition-colors flex items-center gap-1 shrink-0"
          >
            <Navigation className={`w-3.5 h-3.5 ${isLocating ? 'animate-spin' : ''}`} />
            {isLocating ? 'Locating...' : t('find_nearby_stops')}
          </button>
        </div>

        {nearbyStops.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-3 pt-3 border-t border-yatriwarm-100">
            {nearbyStops.map(item => (
              <div
                key={item.place.id}
                onClick={() => setFromQuery(item.place.canonicalName)}
                className="p-2.5 rounded-xl bg-yatriwarm-50 hover:bg-yatribrand-50 cursor-pointer border border-yatriwarm-200/80 transition-colors flex items-center justify-between"
              >
                <div>
                  <div className="text-xs font-semibold text-yatriwarm-900">{item.place.canonicalName}</div>
                  <div className="text-[11px] text-yatriwarm-500">{item.place.district}, {item.place.state}</div>
                </div>
                <span className="text-[11px] font-bold text-yatribrand-800 bg-yatribrand-100 px-2 py-0.5 rounded-md">
                  ~{Math.round(item.distanceMeters / 100) / 10} km
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Popular Corridors */}
      <div className="space-y-3">
        <h3 className="text-xs font-bold text-yatriwarm-700 uppercase tracking-wider">
          {t('popular_routes')}
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
          {[
            { from: 'Anand Vihar ISBT', to: 'Mehrauli Terminal', tag: 'DTC 534 • Delhi' },
            { from: 'ISBT Kashmere Gate', to: 'Dhaula Kuan', tag: 'DTC 429 • Delhi' },
            { from: 'Dadar TT Circle', to: 'Vashi Bus Station', tag: 'BEST AC-105 • Mumbai' },
            { from: 'Swargate Bus Stand', to: 'Dadar TT Circle', tag: 'MSRTC Shivneri' },
            { from: 'Howrah Station', to: 'Salt Lake Sector V', tag: 'WBTC S-12 • Kolkata' },
            { from: 'Kempegowda Bus Station', to: 'Whitefield TTMC', tag: 'BMTC 335E • Bengaluru' },
          ].map(c => (
            <button
              key={`${c.from}-${c.to}`}
              onClick={() => {
                setFromQuery(c.from);
                setToQuery(c.to);
                navigate(`/search?from=${encodeURIComponent(c.from)}&to=${encodeURIComponent(c.to)}`);
              }}
              className="p-3.5 bg-white hover:bg-yatribrand-50/60 rounded-2xl border border-yatriwarm-200 hover:border-yatribrand-300 text-left transition-all shadow-subtle group"
            >
              <div className="text-[10px] font-bold uppercase tracking-wider text-yatribrand-700 mb-1">
                {c.tag}
              </div>
              <div className="text-xs font-bold text-yatriwarm-900 group-hover:text-yatribrand-900">
                {c.from} → {c.to}
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Community Contribution Invite */}
      <div className="bg-gradient-to-r from-yatribrand-900 to-yatribrand-950 text-white rounded-3xl p-6 sm:p-8 shadow-elevated flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="space-y-2 text-center md:text-left">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-yatribrand-800 text-emerald-300 text-xs font-semibold">
            <PlusCircle className="w-3.5 h-3.5" />
            <span>Community-Powered Transport</span>
          </div>
          <h3 className="text-xl font-bold">{t('contribute_title')}</h3>
          <p className="text-xs sm:text-sm text-emerald-100 max-w-lg leading-relaxed">
            {t('contribute_desc')}
          </p>
        </div>

        <button
          onClick={() => navigate('/contribute')}
          className="px-6 py-3 bg-emerald-500 hover:bg-emerald-400 text-yatribrand-950 font-bold text-sm rounded-xl transition-colors shadow-card shrink-0"
        >
          {t('add_bus_button')}
        </button>
      </div>
    </div>
  );
};
