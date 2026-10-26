import React, { useState } from 'react';
import { ApiClient } from '../../services/apiClient';
import { SubmissionType } from '../../types';
import { PlusCircle, AlertCircle, CheckCircle2, X, Search, Shield, ArrowRight } from 'lucide-react';
import { t } from '../../i18n';

interface ContributionModalProps {
  isOpen: boolean;
  onClose: () => void;
  prefillRouteId?: string;
}

export const ContributionModal: React.FC<ContributionModalProps> = ({
  isOpen,
  onClose,
  prefillRouteId
}) => {
  const [activeTab, setActiveTab] = useState<SubmissionType>('add_bus');
  const [busName, setBusName] = useState('');
  const [operatorId, setOperatorId] = useState('op-dtc');
  const [vehicleType, setVehicleType] = useState('express');
  const [stopName, setStopName] = useState('');
  const [stateName, setStateName] = useState('Delhi');
  const [districtName, setDistrictName] = useState('Central Delhi');
  const [departureTime, setDepartureTime] = useState('08:00');
  const [arrivalTime, setArrivalTime] = useState('09:15');
  const [notes, setNotes] = useState('');

  const [loading, setLoading] = useState(false);
  const [submittedRefId, setSubmittedRefId] = useState<string | null>(null);
  const [duplicateWarning, setDuplicateWarning] = useState<any[] | null>(null);
  const [lookupId, setLookupId] = useState('');
  const [lookupResult, setLookupResult] = useState<any | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setDuplicateWarning(null);

    let proposedData: Record<string, any> = {};

    if (activeTab === 'add_bus') {
      proposedData = {
        name: busName,
        operatorId,
        vehicleType,
        features: ['charging_point']
      };
    } else if (activeTab === 'add_stop') {
      proposedData = {
        canonicalName: stopName,
        state: stateName,
        district: districtName
      };
    } else if (activeTab === 'correct_timetable') {
      proposedData = {
        routeId: prefillRouteId || 'rt-del-502',
        departureTime,
        arrivalTime
      };
    } else if (activeTab === 'report_disruption') {
      proposedData = {
        routeId: prefillRouteId || 'rt-del-502',
        disruptionType: 'route_diverted_or_delay',
        details: notes
      };
    }

    try {
      const response = await ApiClient.submitContribution(
        activeTab,
        proposedData,
        notes
      );

      if (response.success && response.data) {
        setSubmittedRefId(response.data.id);
        if (response.meta?.hasDuplicates) {
          setDuplicateWarning(response.meta.duplicateCandidates);
        }
      }
    } catch (err) {
      console.error('Error submitting contribution:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleLookupStatus = async () => {
    if (!lookupId) return;
    try {
      const res = await ApiClient.getContributionStatus(lookupId.trim());
      if (res.success) {
        setLookupResult(res.data);
      } else {
        setLookupResult({ error: 'Reference ID not found' });
      }
    } catch (err) {
      setLookupResult({ error: 'Network error looking up ID' });
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in overflow-y-auto">
      <div className="w-full max-w-lg bg-white rounded-3xl p-6 shadow-2xl border border-surface-border text-slate-800 relative my-8">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition"
          aria-label="Close"
        >
          <X className="w-5 h-5" />
        </button>

        {submittedRefId ? (
          <div className="text-center py-4">
            <div className="w-16 h-16 rounded-3xl bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto mb-4 border border-emerald-200">
              <CheckCircle2 className="w-8 h-8" />
            </div>

            <h3 className="text-xl font-bold text-slate-900">Thank You for Your Contribution!</h3>
            <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
              Your submission has been queued for community and administrator verification. No registration needed.
            </p>

            <div className="my-6 p-4 rounded-2xl bg-surface-subtle border border-surface-border text-center">
              <span className="text-xs uppercase font-bold text-slate-400 tracking-wider">
                {t('ref_id_label')}
              </span>
              <div className="text-2xl font-mono font-bold text-brand-900 mt-1">
                {submittedRefId}
              </div>
              <p className="text-[11px] text-slate-500 mt-2">
                Save this Reference ID to track review status anytime on this portal.
              </p>
            </div>

            {duplicateWarning && duplicateWarning.length > 0 && (
              <div className="mb-4 p-3 rounded-xl bg-amber-50 border border-amber-200 text-left text-xs text-amber-900">
                <div className="flex items-center space-x-1.5 font-bold mb-1">
                  <AlertCircle className="w-4 h-4 text-amber-600" />
                  <span>{t('dup_warning_title')}</span>
                </div>
                <p className="text-amber-800">{t('dup_warning_desc')}</p>
                <div className="mt-2 space-y-1">
                  {duplicateWarning.map((cand, idx) => (
                    <div key={idx} className="bg-white/80 p-1.5 rounded font-medium text-[11px]">
                      • {cand.name} ({cand.similarity}% match)
                    </div>
                  ))}
                </div>
              </div>
            )}

            <button
              onClick={() => {
                setSubmittedRefId(null);
                onClose();
              }}
              className="w-full py-3 rounded-xl bg-brand-900 hover:bg-brand-950 font-semibold text-white shadow-md transition"
            >
              Done
            </button>
          </div>
        ) : (
          <div>
            <div className="flex items-center space-x-2 mb-1">
              <PlusCircle className="w-5 h-5 text-brand-900" />
              <h3 className="text-lg font-bold text-slate-900">{t('contrib_title')}</h3>
            </div>
            <p className="text-xs text-slate-500 mb-4">{t('contrib_subtitle')}</p>

            {/* Contribution Type Tabs */}
            <div className="grid grid-cols-2 gap-1.5 p-1 bg-surface-subtle rounded-2xl border border-surface-border mb-4 text-xs font-semibold">
              <button
                onClick={() => setActiveTab('add_bus')}
                className={`py-2 px-2.5 rounded-xl transition ${activeTab === 'add_bus' ? 'bg-white shadow text-brand-900' : 'text-slate-600 hover:text-slate-900'}`}
              >
                {t('contrib_tab_add_bus')}
              </button>
              <button
                onClick={() => setActiveTab('add_stop')}
                className={`py-2 px-2.5 rounded-xl transition ${activeTab === 'add_stop' ? 'bg-white shadow text-brand-900' : 'text-slate-600 hover:text-slate-900'}`}
              >
                {t('contrib_tab_add_stop')}
              </button>
              <button
                onClick={() => setActiveTab('correct_timetable')}
                className={`py-2 px-2.5 rounded-xl transition ${activeTab === 'correct_timetable' ? 'bg-white shadow text-brand-900' : 'text-slate-600 hover:text-slate-900'}`}
              >
                {t('contrib_tab_timetable')}
              </button>
              <button
                onClick={() => setActiveTab('report_disruption')}
                className={`py-2 px-2.5 rounded-xl transition ${activeTab === 'report_disruption' ? 'bg-white shadow text-brand-900' : 'text-slate-600 hover:text-slate-900'}`}
              >
                {t('contrib_tab_disruption')}
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-3.5 text-xs">
              {activeTab === 'add_bus' && (
                <>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">{t('form_bus_name')}</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. DTC 502 / BEST 203 / Express"
                      value={busName}
                      onChange={e => setBusName(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-surface-border focus:ring-2 focus:ring-brand-900 focus:outline-none"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">{t('form_operator')}</label>
                      <select
                        value={operatorId}
                        onChange={e => setOperatorId(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl border border-surface-border focus:ring-2 focus:ring-brand-900 focus:outline-none bg-white"
                      >
                        <option value="op-dtc">Delhi Transport Corp (DTC)</option>
                        <option value="op-best">BEST Mumbai</option>
                        <option value="op-wbtc">WBTC Kolkata</option>
                        <option value="op-bmtc">BMTC Bengaluru</option>
                        <option value="op-msrtc">MSRTC Maharashtra</option>
                        <option value="op-upsrtc">UPSRTC Uttar Pradesh</option>
                      </select>
                    </div>
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">Vehicle Type</label>
                      <select
                        value={vehicleType}
                        onChange={e => setVehicleType(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl border border-surface-border focus:ring-2 focus:ring-brand-900 focus:outline-none bg-white"
                      >
                        <option value="ordinary">Ordinary / Standard</option>
                        <option value="express">Express</option>
                        <option value="electric">Electric Bus</option>
                        <option value="ac_volvo">AC Volvo</option>
                      </select>
                    </div>
                  </div>
                </>
              )}

              {activeTab === 'add_stop' && (
                <>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">{t('form_stop_name')}</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Rajghat Crossing / Sector 18"
                      value={stopName}
                      onChange={e => setStopName(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-surface-border focus:ring-2 focus:ring-brand-900 focus:outline-none"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">{t('form_state')}</label>
                      <input
                        type="text"
                        required
                        value={stateName}
                        onChange={e => setStateName(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl border border-surface-border focus:ring-2 focus:ring-brand-900 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">{t('form_district')}</label>
                      <input
                        type="text"
                        required
                        value={districtName}
                        onChange={e => setDistrictName(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl border border-surface-border focus:ring-2 focus:ring-brand-900 focus:outline-none"
                      />
                    </div>
                  </div>
                </>
              )}

              {activeTab === 'correct_timetable' && (
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">{t('form_departure_time')}</label>
                    <input
                      type="time"
                      value={departureTime}
                      onChange={e => setDepartureTime(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-surface-border focus:ring-2 focus:ring-brand-900 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">{t('form_arrival_time')}</label>
                    <input
                      type="time"
                      value={arrivalTime}
                      onChange={e => setArrivalTime(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-surface-border focus:ring-2 focus:ring-brand-900 focus:outline-none"
                    />
                  </div>
                </div>
              )}

              <div>
                <label className="block font-semibold text-slate-700 mb-1">{t('form_notes')}</label>
                <textarea
                  rows={2}
                  placeholder="Optional context, photo link, or timetable board details..."
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-surface-border focus:ring-2 focus:ring-brand-900 focus:outline-none"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 rounded-xl bg-brand-900 hover:bg-brand-950 font-semibold text-white shadow-md transition disabled:opacity-50 mt-2"
              >
                {loading ? 'Validating...' : t('btn_submit_contrib')}
              </button>
            </form>

            {/* Check Submission Status Accordion */}
            <div className="mt-5 pt-4 border-t border-surface-border">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-2">
                Already submitted? Track your contribution:
              </span>
              <div className="flex space-x-2">
                <input
                  type="text"
                  placeholder="SUB-2026-XXXX"
                  value={lookupId}
                  onChange={e => setLookupId(e.target.value)}
                  className="flex-1 px-3 py-1.5 rounded-xl border border-surface-border text-xs uppercase font-mono focus:ring-2 focus:ring-brand-900 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={handleLookupStatus}
                  className="px-3 py-1.5 rounded-xl bg-slate-800 text-white font-medium text-xs hover:bg-slate-900 transition flex items-center space-x-1"
                >
                  <Search className="w-3.5 h-3.5" />
                  <span>Check</span>
                </button>
              </div>

              {lookupResult && (
                <div className="mt-2.5 p-3 rounded-xl bg-surface-subtle border border-surface-border text-xs">
                  {lookupResult.error ? (
                    <span className="text-red-600">{lookupResult.error}</span>
                  ) : (
                    <div>
                      <div className="flex justify-between font-bold text-slate-900">
                        <span>Status:</span>
                        <span className="capitalize text-brand-900">{lookupResult.status.replace('_', ' ')}</span>
                      </div>
                      <div className="text-[11px] text-slate-500 mt-1">
                        Submitted: {new Date(lookupResult.submittedAt).toLocaleDateString()}
                      </div>
                      {lookupResult.reviewRemarks && (
                        <div className="text-[11px] text-slate-700 mt-1 italic">
                          "{lookupResult.reviewRemarks}"
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
