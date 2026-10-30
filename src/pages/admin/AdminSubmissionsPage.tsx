import React, { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../../services/api.js';
import { CommunitySubmission } from '@shared/types/contribution.js';
import { ArrowLeft, CheckCircle, XCircle, ShieldCheck, RefreshCw } from 'lucide-react';

export const AdminSubmissionsPage: React.FC = () => {
  const navigate = useNavigate();
  const [submissions, setSubmissions] = useState<CommunitySubmission[]>([]);
  const [selectedSub, setSelectedSub] = useState<CommunitySubmission | null>(null);
  const [decisionReason, setDecisionReason] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isReviewing, setIsReviewing] = useState(false);
  const [sourceCategory, setSourceCategory] = useState<'PUBLIC' | 'OPERATOR'>('PUBLIC');
  const token = localStorage.getItem('yatribus_admin_token');

  const loadSubmissions = useCallback(async () => {
    if (!token) { navigate('/admin'); return; }
    setIsLoading(true);
    setError('');
    try {
      const data = await api.getAdminSubmissions(token, 'PENDING_REVIEW', sourceCategory);
      setSubmissions(data.submissions || []);
      setSelectedSub(current => current ? (data.submissions || []).find((item: CommunitySubmission) => item.id === current.id) || null : null);
    } catch (err) {
      localStorage.removeItem('yatribus_admin_token');
      navigate('/admin');
    } finally {
      setIsLoading(false);
    }
  }, [token, navigate, sourceCategory]);

  useEffect(() => { void loadSubmissions(); }, [loadSubmissions]);

  const handleReview = async (decision: 'ADMIN_VERIFIED' | 'COMMUNITY_CORROBORATED' | 'REJECTED') => {
    if (!selectedSub || !token || isReviewing) return;
    setIsReviewing(true);
    setError('');
    setMessage('');
    try {
      const result = await api.reviewAdminSubmission(token, selectedSub.id, decision, decisionReason.trim());
      setMessage(result.message || `Submission ${selectedSub.referenceId} updated.`);
      setSelectedSub(null);
      setDecisionReason('');
      await loadSubmissions();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Review failed. Please try again.');
    } finally {
      setIsReviewing(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link to="/admin/dashboard" className="p-2 rounded-xl bg-white border border-yatriwarm-200 text-yatriwarm-700"><ArrowLeft className="w-5 h-5" /></Link>
          <div><h1 className="text-xl font-bold text-yatriwarm-950">Bus & Route Submissions</h1><p className="text-xs text-yatriwarm-500">Only you, as Super Admin, can review these requests.</p></div>
        </div>
        <div className="flex items-center gap-2"><select aria-label="Submission source" value={sourceCategory} onChange={e => setSourceCategory(e.target.value as 'PUBLIC' | 'OPERATOR')} className="px-3 py-2 rounded-xl border border-yatriwarm-200 text-xs bg-white"><option value="PUBLIC">Passenger submissions</option><option value="OPERATOR">Bus owner / driver submissions</option></select><button type="button" onClick={() => void loadSubmissions()} disabled={isLoading} className="px-3 py-2 rounded-xl border border-yatriwarm-200 text-xs flex items-center gap-2"><RefreshCw className="w-4 h-4" />Refresh</button></div>
      </div>

      {message && <div role="status" className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800">{message}</div>}
      {error && <div role="alert" className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800">{error}</div>}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <section className="md:col-span-1 bg-white rounded-3xl p-4 border border-yatriwarm-200 shadow-card space-y-2">
          <div className="text-xs font-bold uppercase tracking-wider text-yatriwarm-500 pb-2 border-b border-yatriwarm-100">Pending ({submissions.length})</div>
          {isLoading ? <p className="text-xs text-yatriwarm-500 p-4">Loading submissions…</p> : submissions.length === 0 ? <p className="text-xs text-yatriwarm-500 p-4">No pending submissions.</p> : (
            <div className="space-y-2 max-h-[600px] overflow-y-auto">
              {submissions.map(sub => <button type="button" key={sub.id} onClick={() => setSelectedSub(sub)} className={`w-full text-left p-3 rounded-2xl border text-xs transition-all ${selectedSub?.id === sub.id ? 'border-yatribrand-800 bg-yatribrand-50' : 'border-yatriwarm-200 hover:bg-yatriwarm-50'}`}>
                <div className="flex items-center justify-between gap-2"><span className="font-mono font-bold text-yatribrand-900">{sub.referenceId}</span><span className="text-[10px] font-semibold">{sub.status.replace('_', ' ')}</span></div>
                <div className="font-medium text-yatriwarm-800 mt-1">{sub.submissionType}</div><div className="text-[11px] text-yatriwarm-500 line-clamp-1">{sub.contributorNote || 'No notes'}</div>
              </button>)}
            </div>
          )}
        </section>

        <section className="md:col-span-2 bg-white rounded-3xl p-6 border border-yatriwarm-200 shadow-card">
          {selectedSub ? <div className="space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-yatriwarm-200"><div><h2 className="text-base font-bold text-yatriwarm-900">Reference: <span className="font-mono">{selectedSub.referenceId}</span></h2><p className="text-xs text-yatriwarm-500 mt-1">Type: {selectedSub.submissionType} • Source: {selectedSub.sourceCategory || 'PUBLIC'} • Submitted: {new Date(selectedSub.createdAt).toLocaleString()}</p></div><span className="px-3 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-800">{selectedSub.status}</span></div>
            <div><h3 className="text-xs font-bold text-yatriwarm-700 uppercase tracking-wider mb-2">Proposed Details</h3><pre className="p-3 bg-yatriwarm-50 rounded-xl border border-yatriwarm-200 text-xs font-mono text-yatriwarm-800 overflow-x-auto whitespace-pre-wrap">{JSON.stringify({ ...selectedSub.proposedData, communityVotes: selectedSub.communityVotes || {} }, null, 2)}</pre></div>
            {selectedSub.contributorNote && <div><h3 className="text-xs font-bold text-yatriwarm-700 uppercase tracking-wider mb-1">Contributor Note</h3><p className="text-xs text-yatriwarm-700 p-3 bg-yatriwarm-50 rounded-xl border border-yatriwarm-200">{selectedSub.contributorNote}</p></div>}
            {typeof selectedSub.proposedData?.evidenceUrl === 'string' && /^https?:\/\//i.test(selectedSub.proposedData.evidenceUrl) && <div><h3 className="text-xs font-bold text-yatriwarm-700 uppercase tracking-wider mb-1">Official timetable / operator evidence</h3><a href={selectedSub.proposedData.evidenceUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-yatribrand-900 underline break-all">Open submitted evidence link</a></div>}
            <div className="space-y-3 pt-4 border-t border-yatriwarm-200"><label className="block text-xs font-medium text-yatriwarm-700">Verification Note / Rejection Reason</label><textarea rows={3} value={decisionReason} onChange={e => setDecisionReason(e.target.value)} placeholder="Write how you verified this bus or why it is rejected…" className="w-full px-3 py-2 bg-yatriwarm-50 border border-yatriwarm-200 rounded-xl text-xs" />
              <div className="flex flex-wrap gap-2">
                <button type="button" disabled={isReviewing} onClick={() => void handleReview('ADMIN_VERIFIED')} className="px-4 py-2 bg-emerald-700 disabled:opacity-50 text-white text-xs font-semibold rounded-xl flex items-center gap-1.5"><CheckCircle className="w-4 h-4" />Approve & Verify</button>
                <button type="button" disabled={isReviewing} onClick={() => void handleReview('COMMUNITY_CORROBORATED')} className="px-4 py-2 bg-blue-700 disabled:opacity-50 text-white text-xs font-semibold rounded-xl flex items-center gap-1.5"><ShieldCheck className="w-4 h-4" />Community Corroborated</button>
                <button type="button" disabled={isReviewing} onClick={() => void handleReview('REJECTED')} className="px-4 py-2 bg-rose-600 disabled:opacity-50 text-white text-xs font-semibold rounded-xl flex items-center gap-1.5"><XCircle className="w-4 h-4" />Reject</button>
              </div>
              {isReviewing && <p className="text-xs text-yatriwarm-500">Saving review…</p>}
            </div>
          </div> : <div className="text-center py-20 text-xs text-yatriwarm-400">Select a pending submission to inspect and review.</div>}
        </section>
      </div>
    </div>
  );
};
