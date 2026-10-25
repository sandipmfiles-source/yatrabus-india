import React, { useState } from 'react';
import { api } from '../services/api.js';
import { Building2, ShieldCheck, CheckCircle } from 'lucide-react';

export const OperatorClaimPage: React.FC = () => {
  const [operatorName, setOperatorName] = useState('');
  const [claimantName, setClaimantName] = useState('');
  const [claimantRole, setClaimantRole] = useState('Depot Manager');
  const [officialEmail, setOfficialEmail] = useState('');
  const [contactNumber, setContactNumber] = useState('');
  const [proofNote, setProofNote] = useState('');
  const [isSubmitted, setIsSubmitted] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await api.submitOperatorClaim({
      operatorName,
      claimantName,
      claimantRole,
      officialEmail,
      contactNumber,
      proofDocumentNote: proofNote,
    });
    setIsSubmitted(true);
  };

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">
      <div className="text-center space-y-2">
        <div className="w-12 h-12 rounded-2xl bg-yatribrand-50 text-yatribrand-900 flex items-center justify-center mx-auto border border-yatribrand-200">
          <Building2 className="w-6 h-6" />
        </div>
        <h1 className="text-2xl font-bold text-yatriwarm-950">Bus Operator & Fleet Verification Portal</h1>
        <p className="text-xs text-yatriwarm-600 max-w-md mx-auto">
          State road transport corporations (SRTCs), municipal operators, and private bus fleet managers can verify schedules and manage public listings at ₹0 cost.
        </p>
      </div>

      <div className="bg-white rounded-3xl p-6 sm:p-8 border border-yatriwarm-200 shadow-card">
        {isSubmitted ? (
          <div className="text-center py-6 space-y-3">
            <CheckCircle className="w-12 h-12 text-emerald-600 mx-auto" />
            <h3 className="text-lg font-bold text-yatriwarm-900">Verification Request Submitted</h3>
            <p className="text-xs text-yatriwarm-600 max-w-sm mx-auto">
              Our regional transit verifier will review your operator credentials and contact you via your official phone/email.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200 text-xs text-emerald-900 flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 shrink-0 text-emerald-700" />
              <span><strong>Zero Listing Fee:</strong> Listing bus routes on YatriBus is completely free and community-oriented.</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-yatriwarm-700 mb-1">
                  Agency / Operator Name
                </label>
                <input
                  type="text"
                  required
                  value={operatorName}
                  onChange={e => setOperatorName(e.target.value)}
                  placeholder="e.g. DTC, BEST, UPSRTC, Private Fleet"
                  className="w-full px-3 py-2 bg-yatriwarm-50 border border-yatriwarm-200 rounded-xl text-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-yatriwarm-700 mb-1">
                  Representative Name
                </label>
                <input
                  type="text"
                  required
                  value={claimantName}
                  onChange={e => setClaimantName(e.target.value)}
                  placeholder="e.g. Ramesh Kumar"
                  className="w-full px-3 py-2 bg-yatriwarm-50 border border-yatriwarm-200 rounded-xl text-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-yatriwarm-700 mb-1">
                  Designation / Role
                </label>
                <select
                  value={claimantRole}
                  onChange={e => setClaimantRole(e.target.value)}
                  className="w-full px-3 py-2 bg-yatriwarm-50 border border-yatriwarm-200 rounded-xl text-xs"
                >
                  <option value="Depot Manager">Depot Manager</option>
                  <option value="Transport Officer">Transport Officer</option>
                  <option value="Fleet Owner">Fleet Owner</option>
                  <option value="Operations Coordinator">Operations Coordinator</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-yatriwarm-700 mb-1">
                  Contact Phone / Helpline
                </label>
                <input
                  type="tel"
                  required
                  value={contactNumber}
                  onChange={e => setContactNumber(e.target.value)}
                  placeholder="+91 98765 43210"
                  className="w-full px-3 py-2 bg-yatriwarm-50 border border-yatriwarm-200 rounded-xl text-xs"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-yatriwarm-700 mb-1">
                Official Agency Email (Optional)
              </label>
              <input
                type="email"
                value={officialEmail}
                onChange={e => setOfficialEmail(e.target.value)}
                placeholder="operations@transport.gov.in"
                className="w-full px-3 py-2 bg-yatriwarm-50 border border-yatriwarm-200 rounded-xl text-xs"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-yatriwarm-700 mb-1">
                Depot / Authorization Proof Details
              </label>
              <textarea
                rows={3}
                value={proofNote}
                onChange={e => setProofNote(e.target.value)}
                placeholder="Mention depot address, permit registration, or official authority link..."
                className="w-full px-3 py-2 bg-yatriwarm-50 border border-yatriwarm-200 rounded-xl text-xs"
              />
            </div>

            <button
              type="submit"
              className="w-full py-3 bg-yatribrand-900 hover:bg-yatribrand-950 text-white font-bold text-xs rounded-xl shadow-subtle transition-colors"
            >
              Submit Operator Claim for Verification
            </button>
          </form>
        )}
      </div>
    </div>
  );
};
