import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { repository } from '../../../backend/src/db/repository.js';
import { DuplicateCandidate } from '@shared/types/contribution.js';
import { ArrowLeft, GitMerge, Check, X, ShieldAlert } from 'lucide-react';

export const AdminDuplicatesPage: React.FC = () => {
  const [candidates, setCandidates] = useState<DuplicateCandidate[]>([]);
  const [message, setMessage] = useState('');

  const loadCandidates = () => {
    // If no candidates exist in repo, seed a realistic candidate for preview
    let list = repository.listDuplicateCandidates();
    if (list.length === 0) {
      repository.addDuplicateCandidate({
        id: 'dup-demo-1',
        entityType: 'STOP',
        primaryEntityId: 'place-delhi-isbt-kg',
        secondaryEntityId: 'ISBT Kashmere Gate Old Terminal',
        similarityScore: 88,
        matchingFactors: [
          'Spatial distance within 45 meters',
          'Token similarity score 85%',
          'Same municipal transit zone (North Delhi)',
        ],
        status: 'PENDING',
        createdAt: new Date().toISOString(),
      });
      list = repository.listDuplicateCandidates();
    }
    setCandidates(list);
  };

  useEffect(() => {
    loadCandidates();
  }, []);

  const handleResolve = (id: string, resolution: 'MERGED' | 'REJECTED_DIFFERENT') => {
    repository.resolveDuplicateCandidate(id, resolution, 'admin-default');
    repository.createAuditLog({
      id: `audit-${Date.now()}`,
      entityType: 'DUPLICATE_CANDIDATE',
      entityId: id,
      action: resolution === 'MERGED' ? 'MERGE' : 'UPDATE',
      actorId: 'admin-default',
      actorRole: 'SUPER_ADMIN',
      reason: `Resolved duplicate candidate as ${resolution}`,
      timestamp: new Date().toISOString(),
    });

    setMessage(`Duplicate candidate successfully marked as ${resolution}`);
    loadCandidates();
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
      <div className="flex items-center gap-3">
        <Link
          to="/admin/dashboard"
          className="p-2 rounded-xl bg-white hover:bg-yatriwarm-100 border border-yatriwarm-200 text-yatriwarm-700 transition-colors shadow-subtle"
        >
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-xl font-bold text-yatriwarm-950">Duplicate Transit Records Resolver</h1>
          <p className="text-xs text-yatriwarm-500">
            Review and resolve potential duplicate bus stops, routes, and operator listings detected by the spatial scanner.
          </p>
        </div>
      </div>

      {message && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 flex items-center justify-between">
          <span>{message}</span>
          <button onClick={() => setMessage('')} className="text-emerald-600 font-bold">×</button>
        </div>
      )}

      <div className="space-y-4">
        {candidates.map(cand => (
          <div key={cand.id} className="bg-white rounded-3xl p-5 border border-yatriwarm-200 shadow-card space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-yatriwarm-100">
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-yatribrand-100 text-yatribrand-800">
                  {cand.entityType} Duplicate
                </span>
                <span className="text-xs font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200">
                  {cand.similarityScore}% Match
                </span>
              </div>

              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                cand.status === 'MERGED'
                  ? 'bg-emerald-100 text-emerald-800'
                  : cand.status === 'REJECTED_DIFFERENT'
                  ? 'bg-yatriwarm-200 text-yatriwarm-700'
                  : 'bg-amber-100 text-amber-800'
              }`}>
                {cand.status}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div className="p-3 bg-yatriwarm-50 rounded-xl border border-yatriwarm-200">
                <div className="text-yatriwarm-400 font-medium">Primary Entity</div>
                <div className="font-bold text-yatriwarm-900 mt-1">{cand.primaryEntityId}</div>
              </div>

              <div className="p-3 bg-yatriwarm-50 rounded-xl border border-yatriwarm-200">
                <div className="text-yatriwarm-400 font-medium">Candidate Duplicate</div>
                <div className="font-bold text-yatriwarm-900 mt-1">{cand.secondaryEntityId}</div>
              </div>
            </div>

            <div>
              <div className="text-xs font-semibold text-yatriwarm-700 mb-1.5">Matching Signals:</div>
              <ul className="list-disc pl-5 text-xs text-yatriwarm-600 space-y-1">
                {cand.matchingFactors.map((f, i) => (
                  <li key={i}>{f}</li>
                ))}
              </ul>
            </div>

            {cand.status === 'PENDING' && (
              <div className="flex items-center gap-2 pt-2 border-t border-yatriwarm-100">
                <button
                  type="button"
                  onClick={() => handleResolve(cand.id, 'MERGED')}
                  className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow-subtle transition-colors"
                >
                  <GitMerge className="w-4 h-4" />
                  Merge Records (Preserve Historical IDs)
                </button>
                <button
                  type="button"
                  onClick={() => handleResolve(cand.id, 'REJECTED_DIFFERENT')}
                  className="px-4 py-2 bg-yatriwarm-100 hover:bg-yatriwarm-200 text-yatriwarm-700 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors"
                >
                  <X className="w-4 h-4" />
                  Mark as Distinct Entities
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};
