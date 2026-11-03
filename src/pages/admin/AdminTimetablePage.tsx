import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../../services/api.js';
import { ArrowLeft, Search, ShieldCheck, ExternalLink, AlertTriangle, CheckCircle2, Clock3 } from 'lucide-react';

type RouteRecord = {
  id: string; routeNumber: string; routeName: string; operatorName?: string;
  originStopName: string; destinationStopName: string; stops: Array<{ stopName: string }>;
  timetableSource?: string; timetableSourceUrl?: string; timetableVerifiedAt?: string;
  timetableDataStatus?: 'LIVE_GPS' | 'ESTIMATED' | 'SCHEDULED' | 'UNAVAILABLE';
  verificationStatus: string;
};

export const AdminTimetablePage: React.FC = () => {
  const navigate = useNavigate();
  const [routes, setRoutes] = useState<RouteRecord[]>([]);
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState('');
  const [source, setSource] = useState('');
  const [sourceUrl, setSourceUrl] = useState('');
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const token = () => localStorage.getItem('yatribus_admin_token');
  const load = async (search = query) => {
    const adminToken = token();
    if (!adminToken) { navigate('/admin'); return; }
    setLoading(true);
    try {
      const result = await api.adminGetRoutes(adminToken, search);
      setRoutes(result.routes || []);
      setError('');
    } catch (e) { setError(e instanceof Error ? e.message : 'Unable to load routes.'); }
    finally { setLoading(false); }
  };

  useEffect(() => { void load(''); }, []);
  useEffect(() => {
    const timer = window.setTimeout(() => { void load(query); }, 250);
    return () => window.clearTimeout(timer);
  }, [query]);

  const selected = useMemo(() => routes.find(route => route.id === selectedId), [routes, selectedId]);

  const choose = (route: RouteRecord) => {
    setSelectedId(route.id);
    setSource(route.timetableSource || '');
    setSourceUrl(route.timetableSourceUrl || '');
    setReason('');
    setNotice('');
    setError('');
  };

  const verify = async () => {
    const adminToken = token();
    if (!adminToken || !selected) { navigate('/admin'); return; }
    if (!source.trim() || !/^https:\/\//i.test(sourceUrl.trim()) || reason.trim().length < 10) {
      setError('Enter a source name, an HTTPS source URL, and a reason of at least 10 characters.');
      return;
    }
    if (!window.confirm('Verify this timetable against the cited source? This will mark the route schedule as SCHEDULED and record your Super Admin verification in the audit log.')) return;
    setBusy(true); setError(''); setNotice('');
    try {
      await api.adminUpdateRoute(adminToken, selected.id, {
        timetableSource: source.trim(),
        timetableSourceUrl: sourceUrl.trim(),
        confirmTimetableVerification: true,
        verificationReason: reason.trim(),
      });
      setNotice('Timetable marked SCHEDULED and verification audit recorded.');
      await load(query);
    } catch (e) { setError(e instanceof Error ? e.message : 'Timetable verification failed.'); }
    finally { setBusy(false); }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 space-y-6">
      <div className="flex items-center gap-3">
        <Link to="/admin/dashboard" className="p-2 rounded-xl bg-white border border-yatriwarm-200 text-yatriwarm-700"><ArrowLeft className="w-5 h-5" /></Link>
        <div><h1 className="text-xl font-bold text-yatriwarm-950">Timetable Source & Verification</h1><p className="text-xs text-yatriwarm-500">Only source-backed schedules can be promoted to SCHEDULED.</p></div>
      </div>

      <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4 text-xs text-blue-900 flex gap-2">
        <ShieldCheck className="w-5 h-5 shrink-0" />
        <p>Review the official operator publication before verification. A source URL alone does not prove that a route or departure exists. Verification is recorded with your Super Admin identity and timestamp.</p>
      </div>

      <label className="relative block"><Search className="absolute left-3.5 top-3 w-4 h-4 text-yatriwarm-400" /><input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search route number, town, operator…" className="w-full rounded-xl border border-yatriwarm-200 bg-white py-2.5 pl-10 pr-4 text-sm" /></label>

      {error && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-800">{error}</div>}
      {notice && <div role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-800 flex gap-2"><CheckCircle2 className="w-4 h-4 shrink-0" />{notice}</div>}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <section className="rounded-2xl border border-yatriwarm-200 bg-white p-4 space-y-3">
          <div className="flex items-center justify-between"><h2 className="text-sm font-bold text-yatriwarm-900">Routes awaiting review</h2><span className="text-[10px] text-yatriwarm-500">{routes.length} records</span></div>
          {loading ? <p className="text-xs text-yatriwarm-500">Loading routes…</p> : routes.length === 0 ? <p className="text-xs text-yatriwarm-500">No matching routes.</p> : (
            <div className="max-h-[620px] overflow-y-auto divide-y divide-yatriwarm-100">
              {routes.map(route => <button key={route.id} type="button" onClick={() => choose(route)} className={`w-full text-left py-3 px-2 rounded-xl transition-colors ${selectedId === route.id ? 'bg-yatribrand-50 ring-1 ring-yatribrand-200' : 'hover:bg-yatriwarm-50'}`}>
                <div className="flex items-start justify-between gap-2"><span className="text-xs font-bold text-yatriwarm-900">{route.routeNumber} · {route.routeName}</span><span className={`shrink-0 text-[9px] font-bold rounded-full px-2 py-1 ${route.timetableDataStatus === 'SCHEDULED' ? 'bg-emerald-50 text-emerald-800' : 'bg-slate-100 text-slate-700'}`}>{route.timetableDataStatus || 'UNAVAILABLE'}</span></div>
                <p className="text-[10px] text-yatriwarm-500 mt-1">{route.originStopName} → {route.destinationStopName} · {route.operatorName || 'Operator not listed'}</p>
                {route.timetableVerifiedAt && <p className="text-[10px] text-emerald-700 mt-1">Verified {route.timetableVerifiedAt}</p>}
              </button>)}
            </div>
          )}
        </section>

        <section className="rounded-2xl border border-yatriwarm-200 bg-white p-4 space-y-4">
          <h2 className="text-sm font-bold text-yatriwarm-900">Source review</h2>
          {!selected ? <p className="text-xs text-yatriwarm-500">Select a route to review its timetable source.</p> : <>
            <div className="rounded-xl bg-yatriwarm-50 p-3 space-y-1">
              <div className="text-xs font-bold text-yatriwarm-900">{selected.routeNumber} · {selected.routeName}</div>
              <div className="text-[10px] text-yatriwarm-600">{selected.originStopName} → {selected.destinationStopName}</div>
              <div className="text-[10px] text-yatriwarm-500">{selected.stops.length} listed stops · {selected.verificationStatus}</div>
              <div className="text-[10px] text-yatriwarm-500">Current data status: {selected.timetableDataStatus || 'UNAVAILABLE'}</div>
            </div>
            <label className="block space-y-1"><span className="text-xs font-semibold text-yatriwarm-800">Timetable source name</span><input value={source} onChange={e => setSource(e.target.value)} placeholder="e.g. Official operator timetable notice" className="w-full rounded-xl border border-yatriwarm-200 px-3 py-2 text-xs" /></label>
            <label className="block space-y-1"><span className="text-xs font-semibold text-yatriwarm-800">Official HTTPS source URL</span><input value={sourceUrl} onChange={e => setSourceUrl(e.target.value)} placeholder="https://…" className="w-full rounded-xl border border-yatriwarm-200 px-3 py-2 text-xs" /></label>
            {sourceUrl.startsWith('https://') && <a href={sourceUrl} target="_blank" rel="noreferrer" className="text-[10px] text-yatribrand-800 underline inline-flex items-center gap-1">Open source <ExternalLink className="w-3 h-3" /></a>}
            <label className="block space-y-1"><span className="text-xs font-semibold text-yatriwarm-800">Verification reason / what was checked</span><textarea value={reason} onChange={e => setReason(e.target.value)} rows={4} placeholder="Explain which official publication was checked, the service corridor and effective date…" className="w-full rounded-xl border border-yatriwarm-200 px-3 py-2 text-xs" /></label>
            <div className="flex items-start gap-2 text-[10px] text-amber-900 bg-amber-50 rounded-xl p-3"><AlertTriangle className="w-4 h-4 shrink-0" /><p>Do not verify from search snippets, old third-party timetables, or guessed departure times. Use the operator's official current publication.</p></div>
            <button type="button" disabled={busy || selected.timetableDataStatus === 'SCHEDULED'} onClick={() => void verify()} className="w-full rounded-xl bg-yatribrand-900 px-4 py-3 text-xs font-bold text-white disabled:opacity-50">
              {busy ? 'Saving verification…' : selected.timetableDataStatus === 'SCHEDULED' ? 'Already verified' : 'Verify and mark SCHEDULED'}
            </button>
          </>}
        </section>
      </div>
      <div className="text-[10px] text-yatriwarm-500 flex items-center gap-2"><Clock3 className="w-3.5 h-3.5" />Verification timestamp is generated by the backend, not entered manually.</div>
    </div>
  );
};

export default AdminTimetablePage;
