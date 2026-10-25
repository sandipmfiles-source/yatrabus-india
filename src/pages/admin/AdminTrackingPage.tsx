import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { repository } from '../../../backend/src/db/repository.js';
import { ArrowLeft, Radio, ShieldCheck, MapPin, Activity, AlertCircle } from 'lucide-react';
import { ConfidenceBadge } from '../../components/ConfidenceBadge.js';

export const AdminTrackingPage: React.FC = () => {
  const [buses, setBuses] = useState<any[]>([]);

  useEffect(() => {
    const list = repository.getAllRoutes().map(r => {
      const bList = repository.getBusesForRoute(r.id);
      const b = bList[0];
      const loc = b ? repository.getBusLocation(b.id) : null;
      return {
        route: r,
        bus: b,
        location: loc,
      };
    });
    setBuses(list);
  }, []);

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
          <h1 className="text-xl font-bold text-yatriwarm-950">Active Bus Tracking & GPS Monitor</h1>
          <p className="text-xs text-yatriwarm-500">
            Real-time status of passenger-assisted GPS corridors, confidence scores, and privacy-shielded bus aggregates.
          </p>
        </div>
      </div>

      <div className="p-4 bg-emerald-50 rounded-2xl border border-emerald-200 text-xs text-emerald-900 flex items-center gap-3">
        <ShieldCheck className="w-5 h-5 shrink-0 text-emerald-700" />
        <span>
          <strong>Privacy Guardrail Active:</strong> Individual passenger paths are stripped of identifiers before ingestion. This monitor displays bus-level aggregated states only.
        </span>
      </div>

      <div className="bg-white rounded-3xl p-6 border border-yatriwarm-200 shadow-card space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-yatriwarm-200">
          <h3 className="text-sm font-bold text-yatriwarm-900 uppercase tracking-wider">
            Monitored Bus Services
          </h3>
          <span className="text-xs text-yatriwarm-500">{buses.length} active corridors</span>
        </div>

        <div className="divide-y divide-yatriwarm-100">
          {buses.map(({ route, bus, location }) => (
            <div key={route.id} className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-yatribrand-900">{route.routeNumber}</span>
                  <span className="text-xs text-yatriwarm-600 font-medium">({route.originStopName} → {route.destinationStopName})</span>
                  <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-yatriwarm-100 text-yatriwarm-700">
                    {route.operatorName}
                  </span>
                </div>
                <div className="text-yatriwarm-500 text-[11px] mt-1 flex items-center gap-2">
                  <span>Confidence: <strong>{location?.confidenceScore || 0}%</strong></span>
                  <span>•</span>
                  <span>{location?.statusExplanation || 'Timetable pace prediction'}</span>
                </div>
              </div>

              <div className="flex items-center gap-3 shrink-0">
                <ConfidenceBadge displayState={location?.displayState || 'ESTIMATED'} />
                <Link
                  to={`/routes/${route.id}`}
                  className="px-3 py-1.5 rounded-xl bg-yatriwarm-50 hover:bg-yatribrand-50 text-yatribrand-900 font-semibold border border-yatriwarm-200 transition-colors"
                >
                  View Map
                </Link>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
