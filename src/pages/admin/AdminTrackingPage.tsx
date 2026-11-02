import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../../services/api.js';
import { ArrowLeft, ShieldCheck } from 'lucide-react';
import { ConfidenceBadge } from '../../components/ConfidenceBadge.js';

export const AdminTrackingPage: React.FC = () => {
  const navigate = useNavigate();
  const [services, setServices] = useState<any[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('yatribus_admin_token');
    if (!token) { navigate('/admin'); return; }
    api.adminGetTracking(token).then(data => setServices(data.services || []))
      .catch((reason: unknown) => setError(reason instanceof Error ? reason.message : 'Unable to load backend tracking status.'))
      .finally(() => setLoading(false));
  }, [navigate]);

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-6">
      <div className="flex items-center gap-3"><Link to="/admin/dashboard" className="p-2 rounded-xl bg-white hover:bg-yatriwarm-100 border border-yatriwarm-200 text-yatriwarm-700 transition-colors shadow-subtle"><ArrowLeft className="w-5 h-5" /></Link><div><h1 className="text-xl font-bold text-yatriwarm-950">Active Bus Tracking & GPS Monitor</h1><p className="text-xs text-yatriwarm-500">Live backend bus-level aggregates across all active routes. Passenger traces are not exposed.</p></div></div>
      <div className="p-4 bg-emerald-50 rounded-2xl border border-emerald-200 text-xs text-emerald-900 flex items-center gap-3"><ShieldCheck className="w-5 h-5 shrink-0 text-emerald-700" /><span><strong>Privacy Guardrail Active:</strong> This monitor shows bus-level location states and confidence only, never individual passenger paths.</span></div>
      {error && <div role="alert" className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-800">{error}</div>}
      <div className="bg-white rounded-3xl p-6 border border-yatriwarm-200 shadow-card space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-yatriwarm-200"><h3 className="text-sm font-bold text-yatriwarm-900 uppercase tracking-wider">Monitored Bus Services</h3><span className="text-xs text-yatriwarm-500">{services.length} bus / route entries</span></div>
        {loading ? <p className="text-xs text-yatriwarm-500">Loading backend tracking status…</p> : services.length === 0 ? <p className="text-xs text-yatriwarm-500">No routes are currently configured.</p> : <div className="divide-y divide-yatriwarm-100">
          {services.map(({route,bus,location},index) => <div key={`${route.id}-${bus?.id || index}`} className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
            <div><div className="flex flex-wrap items-center gap-2"><span className="text-sm font-bold text-yatribrand-900">{route.routeNumber}</span><span className="text-xs text-yatriwarm-600 font-medium">({route.originStopName} → {route.destinationStopName})</span><span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-yatriwarm-100 text-yatriwarm-700">{bus?.publicIdentifier || 'No bus assigned'}</span></div>
              <div className="text-yatriwarm-500 text-[11px] mt-1"><span>Confidence: <strong>{location?.confidenceScore || 0}%</strong></span> • {location?.statusExplanation || 'No device observation; timetable estimate may be available to passengers.'}</div>
              {location?.lastObservedAt && <div className="text-[10px] text-yatriwarm-400 mt-1">Last observation: {new Date(location.lastObservedAt).toLocaleString()}</div>}
            </div>
            <div className="flex items-center gap-3 shrink-0"><ConfidenceBadge displayState={location?.displayState || 'UNAVAILABLE'} /><Link to={`/routes/${route.id}`} className="px-3 py-1.5 rounded-xl bg-yatriwarm-50 hover:bg-yatribrand-50 text-yatribrand-900 font-semibold border border-yatriwarm-200">View Map</Link></div>
          </div>)}
        </div>}
      </div>
    </div>
  );
};
