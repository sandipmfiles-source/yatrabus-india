import React, { useState, useEffect } from 'react';
import { useSearchParams, Link, useNavigate } from 'react-router-dom';
import { api } from '../services/api.js';
import { JourneyCandidate } from '@shared/types/bus.js';
import { BusCard } from '../components/BusCard.js';
import { ArrowLeft, Filter, AlertCircle, PlusCircle, RefreshCw } from 'lucide-react';

export const SearchResultsPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

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
