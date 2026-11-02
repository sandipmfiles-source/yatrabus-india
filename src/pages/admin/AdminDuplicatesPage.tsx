import React, { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { DuplicateCandidate } from '@shared/types/contribution.js';
import { api } from '../../services/api.js';
import { ArrowLeft, GitMerge, X } from 'lucide-react';

export const AdminDuplicatesPage: React.FC = () => {
  const navigate = useNavigate();
  const [candidates, setCandidates] = useState<DuplicateCandidate[]>([]);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const loadCandidates = useCallback(async () => {
    const token = localStorage.getItem('yatribus_admin_token');
    if (!token) { navigate('/admin'); return; }
    try { const data = await api.adminGetDuplicates(token); setCandidates(data.candidates || []); setError(''); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Unable to load duplicates.'); }
    finally { setLoading(false); }
  }, [navigate]);
  useEffect(() => { void loadCandidates(); }, [loadCandidates]);

  const handleResolve = async (id: string, resolution: 'MERGED' | 'REJECTED_DIFFERENT') => {
    const token = localStorage.getItem('yatribus_admin_token');
    if (!token) { navigate('/admin'); return; }
    try {
      await api.adminResolveDuplicate(token, id, resolution);
      setMessage(`Duplicate candidate successfully marked as ${resolution}`);
      await loadCandidates();
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Unable to resolve duplicate.'); }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
      <div className="flex items-center gap-3"><Link to="/admin/dashboard" className="p-2 rounded-xl bg-white hover:bg-yatriwarm-100 border border-yatriwarm-200 text-yatriwarm-700 transition-colors shadow-subtle"><ArrowLeft className="w-5 h-5" /></Link><div><h1 className="text-xl font-bold text-yatriwarm-950">Duplicate Transit Records Resolver</h1><p className="text-xs text-yatriwarm-500">Review duplicate candidates stored by the hosted backend. No preview/demo records are created.</p></div></div>
      {message && <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800">{message}</div>}
      {error && <div role="alert" className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-800">{error}</div>}
      {loading ? <p className="text-xs text-yatriwarm-500">Loading duplicate candidates…</p> : candidates.length === 0 ? <div className="bg-white rounded-2xl border border-yatriwarm-200 p-6 text-xs text-yatriwarm-500">No duplicate candidates are waiting for review.</div> : (
        <div className="space-y-4">{candidates.map(cand => <div key={cand.id} className="bg-white rounded-3xl p-5 border border-yatriwarm-200 shadow-card space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-yatriwarm-100"><div className="flex items-center gap-2"><span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-yatribrand-100 text-yatribrand-800">{cand.entityType} Duplicate</span><span className="text-xs font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200">{cand.similarityScore}% Match</span></div><span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800">{cand.status}</span></div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs"><div className="p-3 bg-yatriwarm-50 rounded-xl border border-yatriwarm-200"><div className="text-yatriwarm-400 font-medium">Primary Entity</div><div className="font-bold text-yatriwarm-900 mt-1">{cand.primaryEntityId}</div></div><div className="p-3 bg-yatriwarm-50 rounded-xl border border-yatriwarm-200"><div className="text-yatriwarm-400 font-medium">Candidate Duplicate</div><div className="font-bold text-yatriwarm-900 mt-1">{cand.secondaryEntityId}</div></div></div>
          <div><div className="text-xs font-semibold text-yatriwarm-700 mb-1.5">Matching Signals:</div><ul className="list-disc pl-5 text-xs text-yatriwarm-600 space-y-1">{cand.matchingFactors.map((factor,i)=><li key={i}>{factor}</li>)}</ul></div>
          {cand.status === 'PENDING' && <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-yatriwarm-100"><button type="button" onClick={() => void handleResolve(cand.id,'MERGED')} className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5"><GitMerge className="w-4 h-4" />Merge Records</button><button type="button" onClick={() => void handleResolve(cand.id,'REJECTED_DIFFERENT')} className="px-4 py-2 bg-yatriwarm-100 hover:bg-yatriwarm-200 text-yatriwarm-700 rounded-xl text-xs font-semibold flex items-center gap-1.5"><X className="w-4 h-4" />Mark as Distinct</button></div>}
        </div>)}</div>
      )}
    </div>
  );
};
