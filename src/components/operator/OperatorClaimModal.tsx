import React, { useState } from 'react';
import { ApiClient } from '../../services/apiClient';
import { OperatorClaimRequest } from '../../../backend/src/services/operatorClaimService';
import { Briefcase, CheckCircle2, X, Shield, FileText } from 'lucide-react';

interface OperatorClaimModalProps {
  isOpen: boolean;
  onClose: () => void;
  operatorId?: string;
}

export const OperatorClaimModal: React.FC<OperatorClaimModalProps> = ({
  isOpen,
  onClose,
  operatorId = 'op-dtc'
}) => {
  const [claimantName, setClaimantName] = useState('');
  const [claimantDesignation, setClaimantDesignation] = useState('Depot Manager');
  const [officialPhone, setOfficialPhone] = useState('');
  const [officialEmail, setOfficialEmail] = useState('');
  const [notes, setNotes] = useState('');
  const [submittedClaim, setSubmittedClaim] = useState<OperatorClaimRequest | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await ApiClient.submitOperatorClaim({
      operatorId,
      claimantName,
      claimantDesignation,
      officialPhone,
      officialEmail,
      notes
    });
    if (res.success && res.data) {
      setSubmittedClaim(res.data);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in overflow-y-auto">
      <div className="w-full max-w-md bg-white rounded-3xl p-6 shadow-2xl border border-surface-border text-slate-800 relative my-6">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition"
          aria-label="Close"
        >
          <X className="w-5 h-5" />
        </button>

        {submittedClaim ? (
          <div className="text-center py-4">
            <div className="w-16 h-16 rounded-3xl bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto mb-3 border border-emerald-200">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <h3 className="text-xl font-bold text-slate-900">Claim Request Submitted</h3>
            <p className="text-xs text-slate-500 mt-1">
              Your official listing claim has been queued for verification. No fees are required to manage listings.
            </p>

            <div className="my-5 p-4 rounded-2xl bg-surface-subtle border border-surface-border">
              <span className="text-[10px] uppercase font-bold text-slate-400">Claim Reference ID</span>
              <div className="text-xl font-mono font-bold text-brand-900 mt-1">{submittedClaim.id}</div>
              <p className="text-[11px] text-slate-500 mt-1">
                Our verification team will verify your official credentials via official email.
              </p>
            </div>

            <button
              onClick={() => {
                setSubmittedClaim(null);
                onClose();
              }}
              className="w-full py-2.5 rounded-xl bg-brand-900 text-white font-semibold text-xs shadow"
            >
              Close
            </button>
          </div>
        ) : (
          <div>
            <div className="flex items-center space-x-2.5 mb-2">
              <div className="w-10 h-10 rounded-2xl bg-brand-50 border border-brand-200 text-brand-900 flex items-center justify-center">
                <Briefcase className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900">Operator Listing Claim</h3>
                <span className="text-[11px] text-emerald-700 font-semibold">100% Free Public Verification</span>
              </div>
            </div>

            <p className="text-xs text-slate-500 mb-4 leading-relaxed">
              Are you an authorized depot manager, fleet operator, or owner? Request official listing management without paying any fees.
            </p>

            <form onSubmit={handleSubmit} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Your Full Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Rajesh Kumar"
                  value={claimantName}
                  onChange={e => setClaimantName(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-surface-border focus:ring-2 focus:ring-brand-900 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Designation</label>
                  <input
                    type="text"
                    required
                    value={claimantDesignation}
                    onChange={e => setClaimantDesignation(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-surface-border focus:ring-2 focus:ring-brand-900 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Official Phone</label>
                  <input
                    type="tel"
                    required
                    placeholder="+91..."
                    value={officialPhone}
                    onChange={e => setOfficialPhone(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-surface-border focus:ring-2 focus:ring-brand-900 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Official / Corporate Email</label>
                <input
                  type="email"
                  required
                  placeholder="depot@transport.gov.in"
                  value={officialEmail}
                  onChange={e => setOfficialEmail(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-surface-border focus:ring-2 focus:ring-brand-900 focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Fleet Details & Verification Notes</label>
                <textarea
                  rows={2}
                  placeholder="Depot location, fleet size, or official permit references..."
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-surface-border focus:ring-2 focus:ring-brand-900 focus:outline-none"
                />
              </div>

              <button
                type="submit"
                className="w-full py-3 rounded-xl bg-brand-900 hover:bg-brand-950 font-bold text-white shadow transition mt-2"
              >
                Submit Official Claim
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
};
