import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Place } from '@shared/types/places.js';
import { api } from '../../services/api.js';
import { ArrowLeft, Search, CheckCircle } from 'lucide-react';

export const AdminPlacesPage: React.FC = () => {
  const navigate = useNavigate();
  const [places, setPlaces] = useState<Place[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('yatribus_admin_token');
    if (!token) { navigate('/admin'); return; }
    let cancelled = false;
    const timer = window.setTimeout(() => {
      setLoading(true);
      api.adminSearchPlaces(token, searchQuery).then(data => {
        if (!cancelled) { setPlaces(data.places || []); setError(''); }
      }).catch((reason: unknown) => {
        if (!cancelled) setError(reason instanceof Error ? reason.message : 'Unable to load backend places.');
      }).finally(() => { if (!cancelled) setLoading(false); });
    }, 250);
    return () => { cancelled = true; window.clearTimeout(timer); };
  }, [searchQuery, navigate]);

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-6">
      <div className="flex items-center gap-3">
        <Link to="/admin/dashboard" className="p-2 rounded-xl bg-white hover:bg-yatriwarm-100 border border-yatriwarm-200 text-yatriwarm-700 transition-colors shadow-subtle"><ArrowLeft className="w-5 h-5" /></Link>
        <div><h1 className="text-xl font-bold text-yatriwarm-950">Places & Transit Terminals Directory</h1><p className="text-xs text-yatriwarm-500">Live backend directory search across the bundled India LGD catalogue and verified transit places.</p></div>
      </div>
      <div className="bg-white rounded-3xl p-6 border border-yatriwarm-200 shadow-card space-y-4">
        <div className="flex items-center justify-between gap-4">
          <div className="relative flex-1 max-w-md"><Search className="w-4 h-4 text-yatriwarm-400 absolute left-3.5 top-3" /><input type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Search places by name, district, state..." className="w-full pl-10 pr-4 py-2 bg-yatriwarm-50 border border-yatriwarm-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-yatribrand-800 focus:bg-white" /></div>
          <span className="text-xs text-yatriwarm-500">{places.length} Results</span>
        </div>
        {error && <div role="alert" className="text-xs text-red-700 bg-red-50 rounded-xl p-3">{error}</div>}
        {loading ? <p className="text-xs text-yatriwarm-500">Loading backend directory…</p> : places.length === 0 ? <p className="text-xs text-yatriwarm-500">No matching places found.</p> : (
          <div className="divide-y divide-yatriwarm-100">
            {places.map(p => <div key={p.id} className="py-3.5 flex items-center justify-between gap-4 text-xs">
              <div><div className="flex items-center gap-2"><span className="font-bold text-yatriwarm-900">{p.canonicalName}</span><span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-yatribrand-50 text-yatribrand-800 border border-yatribrand-200">{p.placeType.replace('_', ' ')}</span></div>
                <div className="text-yatriwarm-500 text-[11px] mt-0.5">{p.district ? `${p.district}, ` : ''}{p.state} • Coordinates: {p.latitude?.toFixed(4) ?? '—'}, {p.longitude?.toFixed(4) ?? '—'}</div>
                {p.aliases?.length ? <div className="text-[10px] text-yatriwarm-400 mt-0.5">Aliases: {p.aliases.join(', ')}</div> : null}
                <div className="text-[10px] text-yatriwarm-400 mt-0.5">Source: {p.sourceDataset}{p.sourceSnapshotDate ? ` · Snapshot ${p.sourceSnapshotDate}` : ''}{p.sourceVerifiedAt ? ` · Verified ${p.sourceVerifiedAt}` : ''}</div>
                {p.sourceUrl && <a href={p.sourceUrl} target="_blank" rel="noreferrer" className="text-[10px] text-yatribrand-800 underline">Open source record</a>}
              </div>
              <span className={`inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full border ${p.verificationStatus === 'ADMIN_VERIFIED' ? 'text-emerald-700 bg-emerald-50 border-emerald-200' : p.verificationStatus === 'COMMUNITY_VERIFIED' ? 'text-sky-700 bg-sky-50 border-sky-200' : 'text-amber-800 bg-amber-50 border-amber-200'}`}><CheckCircle className="w-3 h-3" />{p.verificationStatus.replace('_', ' ')}</span>
            </div>)}
          </div>
        )}
      </div>
    </div>
  );
};
