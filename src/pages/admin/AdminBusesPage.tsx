import React, { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../../services/api.js';
import { Bus, Route } from '@shared/types/bus.js';
import { ArrowLeft, BusFront, RefreshCw, Save, Search, ShieldCheck } from 'lucide-react';

type BusRecord = { bus: Bus; routes: Route[] };

export const AdminBusesPage: React.FC = () => {
  const navigate = useNavigate();
  const token = localStorage.getItem('yatribus_admin_token') || '';
  const [query, setQuery] = useState('');
  const [records, setRecords] = useState<BusRecord[]>([]);
  const [selected, setSelected] = useState<BusRecord | null>(null);
  const [busJson, setBusJson] = useState('');
  const [routeJson, setRouteJson] = useState('');
  const [selectedRouteId, setSelectedRouteId] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const load = useCallback(async () => {
    if (!token) { navigate('/admin'); return; }
    setLoading(true);
    setError('');
    try {
      const data = await api.adminGetBuses(token, query);
      setRecords(data.buses || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load bus records');
    } finally { setLoading(false); }
  }, [token, query, navigate]);

  useEffect(() => { void load(); }, [load]);

  const selectRecord = (record: BusRecord) => {
    setSelected(record);
    setBusJson(JSON.stringify(record.bus, null, 2));
    const route = record.routes[0];
    setSelectedRouteId(route?.id || '');
    setRouteJson(route ? JSON.stringify(route, null, 2) : '');
    setMessage('');
    setError('');
  };

  const selectRoute = (routeId: string) => {
    setSelectedRouteId(routeId);
    const route = selected?.routes.find(item => item.id === routeId);
    setRouteJson(route ? JSON.stringify(route, null, 2) : '');
  };

  const saveBus = async () => {
    if (!selected || !token) return;
    setSaving(true); setError(''); setMessage('');
    try {
      const updated = JSON.parse(busJson) as Bus;
      await api.adminUpdateBus(token, selected.bus.id, updated);
      setMessage('Bus details saved.');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Invalid bus JSON or save failed');
    } finally { setSaving(false); }
  };

  const saveRoute = async () => {
    if (!selected || !selectedRouteId || !token) return;
    setSaving(true); setError(''); setMessage('');
    try {
      const updated = JSON.parse(routeJson) as Route;
      await api.adminUpdateRoute(token, selectedRouteId, updated);
      setMessage('Route, stops and timetable saved.');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Invalid route JSON or save failed');
    } finally { setSaving(false); }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link to="/admin/dashboard" className="p-2 rounded-xl bg-white border border-yatriwarm-200 text-yatriwarm-700"><ArrowLeft className="w-5 h-5" /></Link>
          <div><h1 className="text-xl font-bold text-yatriwarm-950">Bus & Route Management</h1><p className="text-xs text-yatriwarm-500">Search any active bus and edit its details, route, stop order and timetable.</p></div>
        </div>
        <button type="button" onClick={() => void load()} disabled={loading} className="px-3 py-2 rounded-xl border border-yatriwarm-200 text-xs flex items-center gap-2"><RefreshCw className="w-4 h-4" />Refresh</button>
      </div>

      {error && <div role="alert" className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-800">{error}</div>}
      {message && <div role="status" className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-800">{message}</div>}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <section className="bg-white rounded-3xl p-4 border border-yatriwarm-200 shadow-card space-y-3">
          <form onSubmit={event => { event.preventDefault(); void load(); }} className="flex gap-2">
            <input value={query} onChange={event => setQuery(event.target.value)} placeholder="Search bus, owner, route number…" className="min-w-0 flex-1 px-3 py-2 rounded-xl border border-yatriwarm-200 text-xs" />
            <button type="submit" className="px-3 py-2 rounded-xl bg-yatribrand-900 text-white"><Search className="w-4 h-4" /></button>
          </form>
          <div className="text-xs font-bold uppercase tracking-wider text-yatriwarm-500">Active buses ({records.length})</div>
          {loading ? <p className="text-xs text-yatriwarm-500 p-4">Loading…</p> : records.length === 0 ? <p className="text-xs text-yatriwarm-500 p-4">No active buses found.</p> : <div className="space-y-2 max-h-[680px] overflow-y-auto">
            {records.map(record => <button type="button" key={record.bus.id} onClick={() => selectRecord(record)} className={`w-full text-left p-3 rounded-xl border transition-colors ${selected?.bus.id === record.bus.id ? 'border-yatribrand-800 bg-yatribrand-50' : 'border-yatriwarm-200 hover:bg-yatriwarm-50'}`}>
              <div className="flex items-center gap-2"><BusFront className="w-4 h-4 text-yatribrand-800" /><span className="text-sm font-bold text-yatriwarm-900">{record.bus.publicIdentifier}</span></div>
              <div className="text-[11px] text-yatriwarm-500 mt-1">{record.bus.operatorName || record.bus.operatorId}</div>
              <div className="text-[10px] text-yatriwarm-500 mt-1">{record.routes.map(route => route.routeNumber).join(', ') || 'No route linked'}</div>
            </button>)}
          </div>}
        </section>

        <section className="lg:col-span-2 space-y-5">
          {!selected ? <div className="bg-white rounded-3xl p-10 border border-yatriwarm-200 text-center text-xs text-yatriwarm-500"><ShieldCheck className="w-8 h-8 mx-auto mb-2" />Select a bus to edit its record and connected routes.</div> : <>
            <div className="bg-white rounded-3xl p-5 border border-yatriwarm-200 shadow-card space-y-3">
              <div><h2 className="text-sm font-bold text-yatriwarm-900">Edit bus record</h2><p className="text-[11px] text-yatriwarm-500">JSON editor: public name, operator, vehicle type, status and active state.</p></div>
              <textarea value={busJson} onChange={event => setBusJson(event.target.value)} rows={12} spellCheck={false} className="w-full p-3 rounded-xl border border-yatriwarm-200 bg-yatriwarm-50 font-mono text-[11px]" />
              <button type="button" disabled={saving} onClick={() => void saveBus()} className="px-4 py-2 rounded-xl bg-yatribrand-900 text-white text-xs font-semibold flex items-center gap-2"><Save className="w-4 h-4" />Save bus</button>
            </div>

            <div className="bg-white rounded-3xl p-5 border border-yatriwarm-200 shadow-card space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2"><div><h2 className="text-sm font-bold text-yatriwarm-900">Edit route, stops and timetable</h2><p className="text-[11px] text-yatriwarm-500">Edit stop names, sequence, coordinates, arrival/departure times and route departures.</p></div>
                <select value={selectedRouteId} onChange={event => selectRoute(event.target.value)} className="px-3 py-2 rounded-xl border border-yatriwarm-200 text-xs bg-white"><option value="">Select route</option>{selected.routes.map(route => <option key={route.id} value={route.id}>{route.routeNumber} · {route.routeName}</option>)}</select>
              </div>
              {selectedRouteId ? <><textarea value={routeJson} onChange={event => setRouteJson(event.target.value)} rows={22} spellCheck={false} className="w-full p-3 rounded-xl border border-yatriwarm-200 bg-yatriwarm-50 font-mono text-[11px]" /><button type="button" disabled={saving} onClick={() => void saveRoute()} className="px-4 py-2 rounded-xl bg-yatribrand-900 text-white text-xs font-semibold flex items-center gap-2"><Save className="w-4 h-4" />Save route and timetable</button></> : <p className="text-xs text-yatriwarm-500">No connected route is available for this bus.</p>}
            </div>
          </>}
        </section>
      </div>
    </div>
  );
};
