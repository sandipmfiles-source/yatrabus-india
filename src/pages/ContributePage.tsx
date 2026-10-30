import React, { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api } from '../services/api.js';
import { useLanguage } from '../context/LanguageContext.js';
import { SubmissionType } from '@shared/types/contribution.js';
import { PlusCircle, Search, CheckCircle, AlertTriangle, ShieldCheck, ArrowRight } from 'lucide-react';

export const ContributePage: React.FC = () => {
  const { t } = useLanguage();
  const [searchParams] = useSearchParams();
  const initialType = (searchParams.get('type') as SubmissionType) || 'ADD_BUS';

  const [activeTab, setActiveTab] = useState<'SUBMIT' | 'CHECK_STATUS'>('SUBMIT');
  const [submissionType, setSubmissionType] = useState<SubmissionType>(initialType);

  // Form State
  const [name, setName] = useState('');
  const [routeNumber, setRouteNumber] = useState('');
  const [origin, setOrigin] = useState('');
  const [destination, setDestination] = useState('');
  const [stateName, setStateName] = useState('West Bengal');
  const [departureTime, setDepartureTime] = useState('');
  const [firstDepartureTime, setFirstDepartureTime] = useState('');
  const [lastDepartureTime, setLastDepartureTime] = useState('');
  const [frequencyMinutes, setFrequencyMinutes] = useState('');
  const [departureTimes, setDepartureTimes] = useState('');
  const [intermediateStops, setIntermediateStops] = useState('');
  const [originLatitude, setOriginLatitude] = useState('');
  const [originLongitude, setOriginLongitude] = useState('');
  const [destinationLatitude, setDestinationLatitude] = useState('');
  const [destinationLongitude, setDestinationLongitude] = useState('');
  const [operatingDays, setOperatingDays] = useState('Daily');
  const [notes, setNotes] = useState('');

  // Status check state
  const [refIdQuery, setRefIdQuery] = useState('');
  const [statusResult, setStatusResult] = useState<any>(null);
  const [statusError, setStatusError] = useState('');

  // Submission result
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submittedRefId, setSubmittedRefId] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const res = await api.submitContribution({
        submissionType,
        targetEntityId: searchParams.get('routeId') || undefined,
        entityType: submissionType === 'ADD_STOP' ? 'STOP' : submissionType === 'SUGGEST_ROUTE' ? 'ROUTE' : submissionType === 'CORRECT_TIMETABLE' ? 'TIMETABLE' : 'BUS',
        contributorNote: notes,
        proposedData: {
          name: name || routeNumber,
          routeNumber,
          origin,
          destination,
          state: stateName,
          departureTime,
          firstDepartureTime,
          lastDepartureTime,
          frequencyMinutes: frequencyMinutes ? Number(frequencyMinutes) : undefined,
          departureTimes: departureTimes.split(',').map(time => time.trim()).filter(Boolean),
          operatingDays: operatingDays.split(',').map(day => day.trim()).filter(Boolean),
          originLatitude: originLatitude ? Number(originLatitude) : undefined,
          originLongitude: originLongitude ? Number(originLongitude) : undefined,
          destinationLatitude: destinationLatitude ? Number(destinationLatitude) : undefined,
          destinationLongitude: destinationLongitude ? Number(destinationLongitude) : undefined,
          intermediateStops: intermediateStops.split(';').map(item => {
            const [stopName, latitude, longitude, arrivalTime, departureTimeAtStop] = item.split('|').map(value => value.trim());
            return stopName ? { stopName, latitude: Number(latitude), longitude: Number(longitude), scheduledArrivalTime: arrivalTime || undefined, scheduledDepartureTime: departureTimeAtStop || undefined } : null;
          }).filter(Boolean),
        },
      });

      setSubmittedRefId(res.referenceId);
      setIsSubmitting(false);
    } catch {
      setIsSubmitting(false);
    }
  };

  const handleCheckStatus = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatusError('');
    setStatusResult(null);

    try {
      const res = await api.getSubmissionStatus(refIdQuery.trim());
      setStatusResult(res);
    } catch (err: any) {
      setStatusError(err.message || 'Reference ID not found. Please double-check.');
    }
  };

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 space-y-8">
      <div className="text-center space-y-2">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-yatribrand-100 text-yatribrand-900 text-xs font-semibold">
          <ShieldCheck className="w-3.5 h-3.5 text-yatribrand-700" />
          <span>{t('no_account_required')}</span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-bold text-yatriwarm-950">
          {t('community_contribution')}
        </h1>
        <p className="text-xs sm:text-sm text-yatriwarm-600 max-w-lg mx-auto">
          {t('contribute_intro')}
        </p>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-yatriwarm-200">
        <button
          type="button"
          onClick={() => setActiveTab('SUBMIT')}
          className={`flex-1 py-3 text-center text-sm font-semibold border-b-2 transition-colors ${
            activeTab === 'SUBMIT'
              ? 'border-yatribrand-900 text-yatribrand-900'
              : 'border-transparent text-yatriwarm-500 hover:text-yatriwarm-800'
          }`}
        >
          {t('submit_missing_info')}
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('CHECK_STATUS')}
          className={`flex-1 py-3 text-center text-sm font-semibold border-b-2 transition-colors ${
            activeTab === 'CHECK_STATUS'
              ? 'border-yatribrand-900 text-yatribrand-900'
              : 'border-transparent text-yatriwarm-500 hover:text-yatriwarm-800'
          }`}
        >
          {t('check_submission_status')}
        </button>
      </div>

      {/* SUBMIT FORM */}
      {activeTab === 'SUBMIT' && (
        <div className="bg-white rounded-3xl p-6 sm:p-8 border border-yatriwarm-200 shadow-card">
          {submittedRefId ? (
            <div className="text-center py-6 space-y-4">
              <div className="w-14 h-14 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center mx-auto">
                <CheckCircle className="w-8 h-8" />
              </div>
              <div className="space-y-1">
                <h3 className="text-xl font-bold text-yatriwarm-900">{t('contribution_received')}</h3>
                <p className="text-xs text-yatriwarm-600">
                  {t('pending_queue_msg')}
                </p>
              </div>

              <div className="p-4 bg-yatriwarm-50 rounded-2xl border border-yatriwarm-200 max-w-sm mx-auto">
                <div className="text-xs text-yatriwarm-500 font-medium">{t('reference_id')}</div>
                <div className="text-lg font-mono font-bold text-yatribrand-900 mt-1 select-all">
                  {submittedRefId}
                </div>
                <div className="text-[11px] text-yatriwarm-400 mt-1">
                  {t('save_code')}
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setSubmittedRefId(null);
                    setName('');
                    setRouteNumber('');
                    setNotes('');
                  }}
                  className="px-5 py-2.5 bg-yatribrand-900 text-white rounded-xl text-xs font-semibold shadow-subtle hover:bg-yatribrand-950 transition-colors"
                >
                  {t('submit_another')}
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Type selection */}
              <div>
                <label className="block text-xs font-bold text-yatriwarm-700 uppercase tracking-wider mb-2">
                  {t('what_contribute')}
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {[
                    { id: 'ADD_BUS' as SubmissionType, label: t('add_bus') },
                    { id: 'SUGGEST_ROUTE' as SubmissionType, label: t('add_route_timetable') },
                    { id: 'ADD_STOP' as SubmissionType, label: t('add_stop') },
                    { id: 'CORRECT_TIMETABLE' as SubmissionType, label: t('fix_schedule') },
                    { id: 'REPORT_CHANGED_ROUTE' as SubmissionType, label: t('report_issue') },
                  ].map(t => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setSubmissionType(t.id)}
                      className={`p-2.5 rounded-xl border text-xs font-semibold transition-all ${
                        submissionType === t.id
                          ? 'bg-yatribrand-900 text-white border-yatribrand-900 shadow-xs'
                          : 'bg-yatriwarm-50 text-yatriwarm-700 border-yatriwarm-200 hover:bg-yatriwarm-100'
                      }`}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Dynamic form fields */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {(submissionType === 'ADD_BUS' || submissionType === 'SUGGEST_ROUTE') && (
                  <div>
                    <label className="block text-xs font-medium text-yatriwarm-700 mb-1">
                      {t('bus_route_number')}
                    </label>
                    <input
                      type="text"
                      required
                      value={routeNumber}
                      onChange={e => setRouteNumber(e.target.value)}
                      placeholder="e.g. 534, AC-105, 500D"
                      className="w-full px-3.5 py-2.5 bg-yatriwarm-50 border border-yatriwarm-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-yatribrand-800 focus:bg-white"
                    />
                  </div>
                )}

                {submissionType === 'ADD_STOP' && (
                  <div>
                    <label className="block text-xs font-medium text-yatriwarm-700 mb-1">
                      Bus Stop Name
                    </label>
                    <input
                      type="text"
                      required
                      value={name}
                      onChange={e => setName(e.target.value)}
                      placeholder="e.g. AIIMS Ansari Nagar Gate 2"
                      className="w-full px-3.5 py-2.5 bg-yatriwarm-50 border border-yatriwarm-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-yatribrand-800 focus:bg-white"
                    />
                  </div>
                )}

                <div>
                  <label className="block text-xs font-medium text-yatriwarm-700 mb-1">
                    {t('state_ut')}
                  </label>
                  <select
                    value={stateName}
                    onChange={e => setStateName(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-yatriwarm-50 border border-yatriwarm-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-yatribrand-800 focus:bg-white"
                  >
                    <option value="Delhi">Delhi</option>
                    <option value="Maharashtra">Maharashtra</option>
                    <option value="Karnataka">Karnataka</option>
                    <option value="West Bengal">West Bengal</option>
                    <option value="Tamil Nadu">Tamil Nadu</option>
                    <option value="Uttar Pradesh">Uttar Pradesh</option>
                    <option value="Gujarat">Gujarat</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-yatriwarm-700 mb-1">
                    {t('origin_terminal')}
                  </label>
                  <input
                    type="text"
                    required
                    value={origin}
                    onChange={e => { const value = e.target.value; setOrigin(value); if (/^jhargram new bus stand$/i.test(value.trim()) || /^jhargram bus stand$/i.test(value.trim())) { setOriginLatitude('22.43962'); setOriginLongitude('86.99267'); } }}
                    placeholder="e.g. Anand Vihar ISBT"
                    className="w-full px-3.5 py-2.5 bg-yatriwarm-50 border border-yatriwarm-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-yatribrand-800 focus:bg-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-yatriwarm-700 mb-1">
                    {t('destination_terminal')}
                  </label>
                  <input
                    type="text"
                    required
                    value={destination}
                    onChange={e => { const value = e.target.value; setDestination(value); if (/^kgp bus stand$/i.test(value.trim()) || /^kharagpur bus stand$/i.test(value.trim()) || /^kharagpur central bus stand$/i.test(value.trim())) { setDestinationLatitude('22.34298'); setDestinationLongitude('87.32404'); } }}
                    placeholder="e.g. Mehrauli Terminal"
                    className="w-full px-3.5 py-2.5 bg-yatriwarm-50 border border-yatriwarm-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-yatribrand-800 focus:bg-white"
                  />
                </div>
              </div>

              {(submissionType === 'SUGGEST_ROUTE' || submissionType === 'CORRECT_TIMETABLE') && (
                <div className="space-y-4 rounded-2xl border border-yatriwarm-200 bg-yatriwarm-50 p-4">
                  <h3 className="text-sm font-bold text-yatriwarm-800">{t('route_timetable_details')}</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <label className="text-xs font-medium text-yatriwarm-700">{t('first_departure')}
                      <input type="time" required={submissionType === 'SUGGEST_ROUTE'} value={firstDepartureTime} onChange={e => setFirstDepartureTime(e.target.value)} className="mt-1 w-full px-3 py-2.5 bg-white border border-yatriwarm-200 rounded-xl" />
                    </label>
                    <label className="text-xs font-medium text-yatriwarm-700">{t('last_departure')}
                      <input type="time" required={submissionType === 'SUGGEST_ROUTE'} value={lastDepartureTime} onChange={e => setLastDepartureTime(e.target.value)} className="mt-1 w-full px-3 py-2.5 bg-white border border-yatriwarm-200 rounded-xl" />
                    </label>
                    <label className="text-xs font-medium text-yatriwarm-700">{t('frequency_minutes')}
                      <input type="number" min="1" max="1440" value={frequencyMinutes} onChange={e => setFrequencyMinutes(e.target.value)} placeholder="e.g. 30" className="mt-1 w-full px-3 py-2.5 bg-white border border-yatriwarm-200 rounded-xl" />
                    </label>
                    <label className="text-xs font-medium text-yatriwarm-700 sm:col-span-3">{t('exact_departures')}
                      <input value={departureTimes} onChange={e => setDepartureTimes(e.target.value)} placeholder="05:45, 06:15, 06:45, 07:20" className="mt-1 w-full px-3 py-2.5 bg-white border border-yatriwarm-200 rounded-xl" />
                    </label>
                  </div>
                  <label className="block text-xs font-medium text-yatriwarm-700">{t('operating_days_comma')}
                    <input value={operatingDays} onChange={e => setOperatingDays(e.target.value)} placeholder="Daily or MON,TUE,WED..." className="mt-1 w-full px-3 py-2.5 bg-white border border-yatriwarm-200 rounded-xl" />
                  </label>
                  {submissionType === 'SUGGEST_ROUTE' && <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <label className="text-xs font-medium text-yatriwarm-700">{t('origin_latitude')}
                      <input type="number" step="any" min="-90" max="90" required value={originLatitude} onChange={e => setOriginLatitude(e.target.value)} placeholder="22.45" className="mt-1 w-full px-3 py-2.5 bg-white border border-yatriwarm-200 rounded-xl" />
                    </label>
                    <label className="text-xs font-medium text-yatriwarm-700">{t('origin_longitude')}
                      <input type="number" step="any" min="-180" max="180" required value={originLongitude} onChange={e => setOriginLongitude(e.target.value)} placeholder="86.98" className="mt-1 w-full px-3 py-2.5 bg-white border border-yatriwarm-200 rounded-xl" />
                    </label>
                    <label className="text-xs font-medium text-yatriwarm-700">{t('destination_latitude')}
                      <input type="number" step="any" min="-90" max="90" required value={destinationLatitude} onChange={e => setDestinationLatitude(e.target.value)} placeholder="22.33" className="mt-1 w-full px-3 py-2.5 bg-white border border-yatriwarm-200 rounded-xl" />
                    </label>
                    <label className="text-xs font-medium text-yatriwarm-700">{t('destination_longitude')}
                      <input type="number" step="any" min="-180" max="180" required value={destinationLongitude} onChange={e => setDestinationLongitude(e.target.value)} placeholder="87.32" className="mt-1 w-full px-3 py-2.5 bg-white border border-yatriwarm-200 rounded-xl" />
                    </label>
                  </div>}

                  {submissionType === 'SUGGEST_ROUTE' && <label className="block text-xs font-medium text-yatriwarm-700">{t('intermediate_stops')}
                    <textarea rows={2} value={intermediateStops} onChange={e => setIntermediateStops(e.target.value)} placeholder="Gopiballavpur|22.20|86.90|08:30|08:32; Lodhasuli|22.35|86.95|09:00|09:02" className="mt-1 w-full px-3 py-2.5 bg-white border border-yatriwarm-200 rounded-xl" />
                  </label>}
                </div>
              )}

              {/* Departure time if schedule correction */}
              {submissionType === 'CORRECT_TIMETABLE' && (
                <div>
                  <label className="block text-xs font-medium text-yatriwarm-700 mb-1">
                    {t('correct_departure_time')}
                  </label>
                  <input
                    type="time"
                    required
                    value={departureTime}
                    onChange={e => setDepartureTime(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-yatriwarm-50 border border-yatriwarm-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-yatribrand-800 focus:bg-white"
                  />
                </div>
              )}

              {/* Contributor note */}
              <div>
                <label className="block text-xs font-medium text-yatriwarm-700 mb-1">
                  {t('additional_notes')}
                </label>
                <textarea
                  rows={3}
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  placeholder="e.g. Timetable photo taken at depot, or observed route change starting this Monday..."
                  className="w-full px-3.5 py-2.5 bg-yatriwarm-50 border border-yatriwarm-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-yatribrand-800 focus:bg-white"
                />
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-3 bg-yatribrand-900 hover:bg-yatribrand-950 text-white font-bold text-sm rounded-xl transition-all shadow-subtle flex items-center justify-center gap-2"
              >
                <PlusCircle className="w-4 h-4" />
                {isSubmitting ? t('submitting') : t('submit_contribution')}
              </button>
            </form>
          )}
        </div>
      )}

      {/* CHECK STATUS TAB */}
      {activeTab === 'CHECK_STATUS' && (
        <div className="bg-white rounded-3xl p-6 sm:p-8 border border-yatriwarm-200 shadow-card space-y-6">
          <form onSubmit={handleCheckStatus} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-yatriwarm-700 uppercase tracking-wider mb-1.5">
                {t('enter_reference_id')}
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  required
                  value={refIdQuery}
                  onChange={e => setRefIdQuery(e.target.value)}
                  placeholder="e.g. YB-SUB-2026-9481"
                  className="flex-1 px-4 py-2.5 bg-yatriwarm-50 border border-yatriwarm-200 rounded-xl text-sm font-mono focus:ring-2 focus:ring-yatribrand-800 focus:bg-white"
                />
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-yatribrand-900 hover:bg-yatribrand-950 text-white text-xs font-bold rounded-xl shadow-subtle transition-colors shrink-0"
                >
                  Check
                </button>
              </div>
            </div>
          </form>

          {statusError && (
            <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-800 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600" />
              <span>{statusError}</span>
            </div>
          )}

          {statusResult && (
            <div className="p-5 rounded-2xl bg-yatriwarm-50 border border-yatriwarm-200 space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-yatriwarm-200">
                <span className="text-xs font-mono font-bold text-yatribrand-900">
                  {statusResult.referenceId}
                </span>
                <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full ${
                  statusResult.status === 'ADMIN_VERIFIED'
                    ? 'bg-emerald-100 text-emerald-800'
                    : statusResult.status === 'REJECTED'
                    ? 'bg-rose-100 text-rose-800'
                    : 'bg-amber-100 text-amber-800'
                }`}>
                  {statusResult.status.replace('_', ' ')}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <span className="text-yatriwarm-500">{t('submission_type')}:</span>{' '}
                  <strong className="text-yatriwarm-800">{statusResult.submissionType}</strong>
                </div>
                <div>
                  <span className="text-yatriwarm-500">{t('submitted')}:</span>{' '}
                  <strong className="text-yatriwarm-800">{new Date(statusResult.submittedAt).toLocaleDateString()}</strong>
                </div>
              </div>

              {statusResult.adminDecisionReason && (
                <div className="text-xs text-yatriwarm-700 bg-white p-2.5 rounded-lg border border-yatriwarm-200">
                  <span className="font-semibold">{t('reviewer_note')}:</span> {statusResult.adminDecisionReason}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
