import React, { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../../services/api.js';
import { CommunitySubmission } from '@shared/types/contribution.js';
import { ArrowLeft, CheckCircle, XCircle, ShieldCheck, RefreshCw } from 'lucide-react';

export const AdminSubmissionsPage: React.FC = () => {
  const navigate = useNavigate();
  const token = localStorage.getItem('yatribus_admin_token') || '';
  const [submissions, setSubmissions] = useState<CommunitySubmission[]>([]);
  const [selectedSub, setSelectedSub] = useState<CommunitySubmission | null>(null);
  const [decisionReason, setDecisionReason] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const loadSubmissions = useCallback(async () => {
    if (!token) { navigate('/admin'); return; }
    setLoading(true);
    setError('');
    try {
      const result = await api.getAdminSubmissions(token);
      setSubmissions(result.submissions || []);
    } catch (loadError: any) {
      setError(loadError.message || 'Could not load submissions.');
      localStorage.removeItem('yatribus_admin_token');
      navigate('/admin');
    } finally {
      setLoading(false);
    }
  }, [token, navigate]);

  useEffect(() => { void loadSubmissions(); }, [loadSubmissions]);

  const handleReview = async (decision: 'ADMIN_VERIFIED' | 'COMMUNITY_CORROBORATED' | 'REJECTED') => {
    if (!selectedSub || !token) return;
    setLoading(true);
    setError('');
    setMessage('');
    try {
      const result = await api.reviewSubmission(token, selectedSub.id, decision, decisionReason || `Reviewed as ${decision}`);
      const published = result.publishedEntity ? ` • Published ${result.publishedEntity.type} ${result.publishedEntity.id}` : '';
      setMessage(`Submission ${selectedSub.referenceId} marked as ${decision}.${published}`);
      setSelectedSub(null);
      setDecisionReason('');
      await loadSubmissions();
    } catch (reviewError: any) {
      setError(reviewError.message || 'Review could not be saved.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 space-y-6">
      <div className="flex items-center gap-3">
        <Link to="/admin/dashboard" className="p-2 rounded-xl bg-white hover:bg-yatriwarm-100 border border-yatriwarm-200 text-yatriwarm-700 transition-colors shadow-subtle">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div className="flex-1">
          <h1 className="text-xl font-bold text-yatriwarm-950">Community Submissions Moderation</h1>
          <p className="text-xs text-yatriwarm-500">Review bus, route and timetable submissions before they appear in public search.</p>
        </div>
        <button onClick={() => void loadSubmissions()} disabled={loading} className="p-2 rounded-xl border border-yatriwarm-200 text-yatriwarm-700 disabled:opacity-50" aria-label="Refresh submissions">
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {message && <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800">{message}</div>}
      {error && <div role="alert" className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800">{error}</div>}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-1 bg-white rounded-3xl p-4 border border-yatriwarm-200 shadow-card space-y-2">
          <div className="text-xs font-bold uppercase tracking-wider text-yatriwarm-500 pb-2 border-b border-yatriwarm-100">Submissions ({submissions.length})</div>
          {loading && submissions.length === 0 ? <p className="p-4 text-xs text-yatriwarm-500">Loading submissions…</p> : (
            <div className="space-y-2 max-h-[600px] overflow-y-auto">
              {submissions.map(sub => (
                <button key={sub.id} type="button" onClick={() => setSelectedSub(sub)} className={`w-full text-left p-3 rounded-2xl border text-xs transition-all ${selectedSub?.id === sub.id ? 'border-yatribrand-800 bg-yatribrand-50' : 'border-yatriwarm-200 hover:bg-yatriwarm-50'}`}>
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono font-bold text-yatribrand-900">{sub.referenceId}</span>
                    <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-yatriwarm-100 text-yatriwarm-700">{sub.status.replaceAll('_', ' ')}</span>
                  </div>
                  <div className="font-medium text-yatriwarm-800 mt-1">{sub.submissionType}</div>
                  <div className="text-[11px] text-yatriwarm-500 line-clamp-1">{sub.contributorNote || 'No notes'}</div>
                </button>
              ))}
              {submissions.length === 0 && <p className="p-4 text-xs text-yatriwarm-500">No submissions in the review queue.</p>}
            </div>
          )}
        </div>

        <div className="md:col-span-2 bg-white rounded-3xl p-6 border border-yatriwarm-200 shadow-card">
          {selectedSub ? (
            <div className="space-y-5">
              <div className="flex items-center justify-between pb-3 border-b border-yatriwarm-200">
                <div>
                  <h3 className="text-base font-bold text-yatriwarm-900">Reference: <span className="font-mono text-yatribrand-900">{selectedSub.referenceId}</span></h3>
                  <div className="text-xs text-yatriwarm-500 mt-0.5">Type: {selectedSub.submissionType} • Submitted: {new Date(selectedSub.createdAt).toLocaleString()}</div>
                </div>
                <span className="px-3 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-800 border border-amber-200">{selectedSub.status}</span>
              </div>
              <div>
                <h4 className="text-xs font-bold text-yatriwarm-700 uppercase tracking-wider mb-2">Proposed Payload</h4>
                <pre className="p-3 bg-yatriwarm-50 rounded-xl border border-yatriwarm-200 text-xs font-mono text-yatriwarm-800 overflow-x-auto">{JSON.stringify(selectedSub.proposedData, null, 2)}</pre>
              </div>
              {selectedSub.contributorNote && <div><h4 className="text-xs font-bold text-yatriwarm-700 uppercase tracking-wider mb-1">Contributor Note</h4><p className="text-xs text-yatriwarm-700 p-3 bg-yatriwarm-50 rounded-xl border border-yatriwarm-200">{selectedSub.contributorNote}</p></div>}
              {typeof selectedSub.proposedData?.evidenceUrl === 'string' && /^https?:\/\//i.test(selectedSub.proposedData.evidenceUrl) && <div><h4 className="text-xs font-bold text-yatriwarm-700 uppercase tracking-wider mb-1">Evidence link</h4><a href={selectedSub.proposedData.evidenceUrl} target="_blank" rel="noreferrer" className="text-xs text-yatribrand-900 underline break-all">Open submitted timetable / operator evidence</a></div>}
              <div className="space-y-3 pt-4 border-t border-yatriwarm-200">
                <label className="block text-xs font-medium text-yatriwarm-700">Verification Note / Reason for Decision
                  <textarea rows={2} value={decisionReason} onChange={e => setDecisionReason(e.target.value)} placeholder="e.g. Checked against the operator's official timetable or depot notice." className="mt-1 w-full px-3 py-2 bg-yatriwarm-50 border border-yatriwarm-200 rounded-xl text-xs" />
                </label>
                <div className="flex flex-wrap gap-2">
                  <button type="button" disabled={loading} onClick={() => void handleReview('ADMIN_VERIFIED')} className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 text-white text-xs font-semibold rounded-xl flex items-center gap-1.5"><CheckCircle className="w-4 h-4" /> Approve & Publish</button>
                  <button type="button" disabled={loading} onClick={() => void handleReview('COMMUNITY_CORROBORATED')} className="px-4 py-2 bg-blue-700 hover:bg-blue-800 disabled:opacity-50 text-white text-xs font-semibold rounded-xl flex items-center gap-1.5"><ShieldCheck className="w-4 h-4" /> Corroborate</button>
                  <button type="button" disabled={loading} onClick={() => void handleReview('REJECTED')} className="px-4 py-2 bg-rose-700 hover:bg-rose-800 disabled:opacity-50 text-white text-xs font-semibold rounded-xl flex items-center gap-1.5"><XCircle className="w-4 h-4" /> Reject</button>
                </div>
                {selectedSub.entityType === 'ROUTE' && <p className="text-[11px] text-yatriwarm-500">A route can be published only when origin, destination and every listed intermediate stop has valid GPS coordinates and the timetable has been checked.</p>}
              </div>
            </div>
          ) : <div className="h-full min-h-48 flex items-center justify-center text-xs text-yatriwarm-500">Select a submission to review.</div>}
        </div>
      </div>
    </div>
  );
};
