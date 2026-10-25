import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { repository } from '../../../backend/src/db/repository.js';
import { Place } from '@shared/types/places.js';
import { ArrowLeft, MapPin, Search, PlusCircle, CheckCircle } from 'lucide-react';

export const AdminPlacesPage: React.FC = () => {
  const [places, setPlaces] = useState<Place[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    // Get all seeded places
    const searchRes = repository.searchPlaces('', 100);
    setPlaces(searchRes.map(r => r.place));
  }, []);

  const filteredPlaces = places.filter(p =>
    p.canonicalName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.state.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (p.district && p.district.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-6">
      <div className="flex items-center gap-3">
        <Link
          to="/admin/dashboard"
          className="p-2 rounded-xl bg-white hover:bg-yatriwarm-100 border border-yatriwarm-200 text-yatriwarm-700 transition-colors shadow-subtle"
        >
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-xl font-bold text-yatriwarm-950">Places & Transit Terminals Directory</h1>
          <p className="text-xs text-yatriwarm-500">
            Manage Indian transit hierarchy, administrative jurisdictions, and geospatial bus stop coordinates.
          </p>
        </div>
      </div>

      <div className="bg-white rounded-3xl p-6 border border-yatriwarm-200 shadow-card space-y-4">
        <div className="flex items-center justify-between gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-yatriwarm-400 absolute left-3.5 top-3" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search places by name, district, state..."
              className="w-full pl-10 pr-4 py-2 bg-yatriwarm-50 border border-yatriwarm-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-yatribrand-800 focus:bg-white"
            />
          </div>

          <span className="text-xs text-yatriwarm-500">
            {filteredPlaces.length} Verified Locations
          </span>
        </div>

        <div className="divide-y divide-yatriwarm-100">
          {filteredPlaces.map(p => (
            <div key={p.id} className="py-3.5 flex items-center justify-between gap-4 text-xs">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-bold text-yatriwarm-900">{p.canonicalName}</span>
                  <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-yatribrand-50 text-yatribrand-800 border border-yatribrand-200">
                    {p.placeType.replace('_', ' ')}
                  </span>
                </div>
                <div className="text-yatriwarm-500 text-[11px] mt-0.5">
                  {p.district ? `${p.district}, ` : ''}{p.state} • Coordinates: {p.latitude?.toFixed(4)}, {p.longitude?.toFixed(4)}
                </div>
                {p.aliases && p.aliases.length > 0 && (
                  <div className="text-[10px] text-yatriwarm-400 mt-0.5">
                    Aliases: {p.aliases.join(', ')}
                  </div>
                )}
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                  <CheckCircle className="w-3 h-3" />
                  {p.verificationStatus.replace('_', ' ')}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
