import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Download, WifiOff } from 'lucide-react';
import { phase4 } from '../services/phase4.js';
import type { Route } from '@shared/types/bus.js';

export const OfflineTimetablePage: React.FC = () => {
  const [routes, setRoutes] = useState<Route[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const load = async () => {
    setLoading(true); setError('');
    try { setRoutes(await phase4.getOfflineRoutes()); }
    catch (e) { setError(e instanceof Error ? e.message : 'Offline timetable storage is unavailable.'); }
    finally { setLoading(false); }
  };
  useEffect(() => { void load(); }, []);
  return <div className="max-w-4xl mx-auto px-4 py-8 space-y-5">
    <div className="flex items-center gap-3"><WifiOff className="h-6 w-6"/><div><h1 className="text-2xl font-extrabold">Offline timetables</h1><p className="text-sm text-yatriwarm-600">Only source-verified schedules saved on this device are shown.</p></div></div>
    {error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-800">{error}</p>}
    {loading ? <p>Loading saved timetables…</p> : !routes.length ? <div className="rounded-2xl border bg-white p-6 text-sm text-yatriwarm-600">No verified timetable is saved yet. Open a route while online; verified schedules can then be cached for offline use.</div> : routes.map(route => <article key={route.id} className="rounded-2xl border border-yatriwarm-200 bg-white p-4">
      <div className="flex flex-wrap justify-between gap-2"><h2 className="font-bold">{route.routeName}</h2><span className="text-xs rounded-full bg-emerald-50 px-2 py-1 text-emerald-800">SCHEDULED · VERIFIED SOURCE</span></div>
      <p className="text-sm">{route.originStopName} → {route.destinationStopName}</p>
      <p className="mt-1 text-xs text-yatriwarm-600">Source: {route.timetableSource} · Verified: {route.timetableVerifiedAt ? new Date(route.timetableVerifiedAt).toLocaleDateString() : 'Unknown'}</p>
      <p className="text-xs text-yatriwarm-600">Departures: {(route.departures || []).filter(x => !x.isCancelled && x.dataStatus === 'SCHEDULED').map(x => x.departureTime).join(', ') || 'No verified departure times in cache'}</p>
      <Link to={`/routes/${encodeURIComponent(route.id)}`} className="inline-block mt-3 text-sm font-semibold text-yatribrand-900">Open saved route →</Link>
    </article>)}
    <button onClick={() => void load()} className="rounded-xl border px-4 py-2 text-sm font-semibold"><Download className="inline h-4 w-4 mr-2"/>Refresh offline list</button>
  </div>;
};
