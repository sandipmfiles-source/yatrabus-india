import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { repository } from '../../../backend/src/db/repository.js';
import { CommunitySubmission } from '@shared/types/contribution.js';
import { ArrowLeft, CheckCircle, XCircle, ShieldCheck } from 'lucide-react';

export const AdminSubmissionsPage: React.FC = () => {
  const [submissions, setSubmissions] = useState<CommunitySubmission[]>([]);
  const [selectedSub, setSelectedSub] = useState<CommunitySubmission | null>(null);
  const [decisionReason, setDecisionReason] = useState('');
  const [message, setMessage] = useState('');

  const loadSubmissions = () => {
    const list = repository.listSubmissions();
    setSubmissions(list);
  };

  useEffect(() => {
    loadSubmissions();
  }, []);

  const handleReview = (decision: 'ADMIN_VERIFIED' | 'COMMUNITY_CORROBORATED' | 'REJECTED') => {
    if (!selectedSub) return;

    repository.updateSubmissionReview(
      selectedSub.id,
      decision,
      decisionReason || `Reviewed as ${decision}`,
      'admin-default'
    );

    repository.createAuditLog({
      id: `audit-${Date.now()}`,
      entityType: 'SUBMISSION',
      entityId: selectedSub.id,
      action: decision === 'REJECTED' ? 'DELETE' : 'VERIFY',
      actorId: 'admin-default',
      actorRole: 'SUPER_ADMIN',
      reason: decisionReason,
      timestamp: new Date().toISOString(),
    });

    setMessage(`Submission ${selectedSub.referenceId} marked as ${decision}`);
    setSelectedSub(null);
    setDecisionReason('');
    loadSubmissions();
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 space-y-6">
      <div className="flex items-center gap-3">
        <Link
          to="/admin/dashboard"
          className="p-2 rounded-xl bg-white hover:bg-yatriwarm-100 border border-yatriwarm-200 text-yatriwarm-700 transition-colors shadow-subtle"
        >
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-xl font-bold text-yatriwarm-950">Community Submissions Moderation</h1>
          <p className="text-xs text-yatriwarm-500">
            Review user-submitted bus schedules, stops, and route diversion alerts.
          </p>
        </div>
      </div>

      {message && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 flex items-center justify-between">
          <span>{message}</span>
          <button onClick={() => setMessage('')} className="text-emerald-600 font-bold">×</button>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Left column: List of submissions */}
        <div className="md:col-span-1 bg-white rounded-3xl p-4 border border-yatriwarm-200 shadow-card space-y-2">
          <div className="text-xs font-bold uppercase tracking-wider text-yatriwarm-500 pb-2 border-b border-yatriwarm-100">
            Submissions ({submissions.length})
          </div>

          <div className="space-y-2 max-h-[600px] overflow-y-auto">
            {submissions.map(sub => (
              <div
                key={sub.id}
                onClick={() => setSelectedSub(sub)}
                className={`p-3 rounded-2xl border text-xs cursor-pointer transition-all ${
                  selectedSub?.id === sub.id
                    ? 'border-yatribrand-800 bg-yatribrand-50'
                    : 'border-yatriwarm-200 hover:bg-yatriwarm-50'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono font-bold text-yatribrand-900">{sub.referenceId}</span>
                  <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-yatriwarm-100 text-yatriwarm-700">
                    {sub.status.replace('_', ' ')}
                  </span>
                </div>
                <div className="font-medium text-yatriwarm-800 mt-1">{sub.submissionType}</div>
                <div className="text-[11px] text-yatriwarm-500 line-clamp-1">{sub.contributorNote || 'No notes'}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Right column: Selected Submission Detail & Review Controls */}
        <div className="md:col-span-2 bg-white rounded-3xl p-6 border border-yatriwarm-200 shadow-card">
          {selectedSub ? (
            <div className="space-y-5">
              <div className="flex items-center justify-between pb-3 border-b border-yatriwarm-200">
                <div>
                  <h3 className="text-base font-bold text-yatriwarm-900 flex items-center gap-2">
                    <span>Reference:</span>
                    <span className="font-mono text-yatribrand-900">{selectedSub.referenceId}</span>
                  </h3>
                  <div className="text-xs text-yatriwarm-500 mt-0.5">
                    Type: {selectedSub.submissionType} • Submitted: {new Date(selectedSub.createdAt).toLocaleString()}
                  </div>
                </div>

                <span className="px-3 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-800 border border-amber-200">
                  {selectedSub.status}
                </span>
              </div>

              {/* Proposed Payload */}
              <div>
                <h4 className="text-xs font-bold text-yatriwarm-700 uppercase tracking-wider mb-2">
                  Proposed Payload
                </h4>
                <pre className="p-3 bg-yatriwarm-50 rounded-xl border border-yatriwarm-200 text-xs font-mono text-yatriwarm-800 overflow-x-auto">
                  {JSON.stringify(selectedSub.proposedData, null, 2)}
                </pre>
              </div>

              {selectedSub.contributorNote && (
                <div>
                  <h4 className="text-xs font-bold text-yatriwarm-700 uppercase tracking-wider mb-1">
                    Contributor Note
                  </h4>
                  <p className="text-xs text-yatriwarm-700 p-3 bg-yatriwarm-50 rounded-xl border border-yatriwarm-200">
                    {selectedSub.contributorNote}
                  </p>
                </div>
              )}

              {/* Decision Box */}
              <div className="space-y-3 pt-4 border-t border-yatriwarm-200">
                <label className="block text-xs font-medium text-yatriwarm-700">
                  Verification Note / Reason for Decision
                </label>
                <textarea
                  rows={2}
                  value={decisionReason}
                  onChange={e => setDecisionReason(e.target.value)}
                  placeholder="e.g. Schedule verified against official depot circular..."
                  className="w-full px-3 py-2 bg-yatriwarm-50 border border-yatriwarm-200 rounded-xl text-xs"
                />

                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => handleReview('ADMIN_VERIFIED')}
                    className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold rounded-xl flex items-center gap-1.5 shadow-subtle transition-colors"
                  >
                    <CheckCircle className="w-4 h-4" />
                    Approve (Admin Verified)
                  </button>

                  <button
                    type="button"
                    onClick={() => handleReview('COMMUNITY_CORROBORATED')}
                    className="px-4 py-2 bg-blue-700 hover:bg-blue-800 text-white text-xs font-semibold rounded-xl flex items-center gap-1.5 shadow-subtle transition-colors"
                  >
                    <ShieldCheck className="w-4 h-4" />
                    Accept (Community Corroborated)
                  </button>

                  <button
                    type="button"
                    onClick={() => handleReview('REJECTED')}
                    className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold rounded-xl flex items-center gap-1.5 shadow-subtle transition-colors"
                  >
                    <XCircle className="w-4 h-4" />
                    Reject
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-20 text-xs text-yatriwarm-400">
              Select a submission from the list on the left to inspect and review.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
