import React, { useEffect, useState } from 'react';
import { Geolocation } from '@capacitor/geolocation';
import { useLanguage } from '../context/LanguageContext.js';
import { useSearchParams } from 'react-router-dom';
import { api } from '../services/api.js';
import { SubmissionType } from '@shared/types/contribution.js';
import { PlusCircle, Search, CheckCircle, AlertTriangle, ShieldCheck, ArrowRight } from 'lucide-react';

export const ContributePage: React.FC = () => {
  const { t } = useLanguage();
  const [searchParams] = useSearchParams();
  const initialType = (searchParams.get('type') as SubmissionType) || 'ADD_BUS';
  const isOperatorSubmission = searchParams.get('source') === 'OPERATOR';
  const routeIdParam = searchParams.get('routeId');
  const busIdParam = searchParams.get('busId');

  const [activeTab, setActiveTab] = useState<'SUBMIT' | 'CHECK_STATUS'>('SUBMIT');
  const [submissionType, setSubmissionType] = useState<SubmissionType>(initialType);
  const isRouteSubmission = submissionType === 'SUGGEST_ROUTE' || submissionType === 'UPDATE_ROUTE';

  // Form State
  const [name, setName] = useState('');
  const [stopLatitude, setStopLatitude] = useState('');
  const [stopLongitude, setStopLongitude] = useState('');
  const [locationLookupLoading, setLocationLookupLoading] = useState(false);
  const [evidenceUrl, setEvidenceUrl] = useState('');
  const [routeNumber, setRouteNumber] = useState('');
  const [direction, setDirection] = useState<'UP' | 'DOWN'>('UP');
  const [origin, setOrigin] = useState('');
  const [destination, setDestination] = useState('');
  const [stateName, setStateName] = useState('West Bengal');
  const [departureTime, setDepartureTime] = useState('');
  const [arrivalTime, setArrivalTime] = useState('');
  const [busIdentifier, setBusIdentifier] = useState('');
  const [originalBusIdentifier, setOriginalBusIdentifier] = useState('');
  const [frequencyMinutes, setFrequencyMinutes] = useState('');
  const [routeName, setRouteName] = useState('');
  const [operatorName, setOperatorName] = useState('');
  const [operatorContactName, setOperatorContactName] = useState('');
  const [operatorContactPhone, setOperatorContactPhone] = useState('');
  const [operatorOfficialEmail, setOperatorOfficialEmail] = useState('');
  const [routeDistanceKm, setRouteDistanceKm] = useState('');
  const [routeDurationMinutes, setRouteDurationMinutes] = useState('');
  const [firstDepartureTime, setFirstDepartureTime] = useState('');
  const [lastDepartureTime, setLastDepartureTime] = useState('');
  const [departureTimes, setDepartureTimes] = useState('');
  const [operatingDays, setOperatingDays] = useState('Daily');
  const [routeStops, setRouteStops] = useState([
    { name: '', latitude: '', longitude: '', arrivalTime: '', departureTime: '' },
    { name: '', latitude: '', longitude: '', arrivalTime: '', departureTime: '' },
  ]);
  const [routePreview, setRoutePreview] = useState<any>(null);
  const [routePreviewLoading, setRoutePreviewLoading] = useState(false);
  const [routePreviewError, setRoutePreviewError] = useState('');
  useEffect(() => {
    setRoutePreview(null);
    setRoutePreviewError('');
  }, [routeStops]);

  const updateRouteStop = (index: number, field: string, value: string) => {
    setRouteStops(current => current.map((stop, i) => i === index ? { ...stop, [field]: value } : stop));
  };
  const moveRouteStop = (index: number, offset: -1 | 1) => {
    setRouteStops(current => {
      const target = index + offset;
      if (index <= 0 || index >= current.length - 1 || target <= 0 || target >= current.length - 1) return current;
      const next = [...current];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  };
  const checkNewRoutePreview = async () => {
    if (routeStops.length < 2 || routeStops.some(stop => !stop.name.trim() || stop.latitude === '' || stop.longitude === '')) {
      setRoutePreviewError('Add a name and coordinates for the origin, every intermediate stop, and destination first.');
      return;
    }
    const normalizedNames = routeStops.map(stop => stop.name.trim().toLocaleLowerCase());
    const normalizedCoordinates = routeStops.map(stop => `${Number(stop.latitude).toFixed(5)},${Number(stop.longitude).toFixed(5)}`);
    if (new Set(normalizedNames).size !== normalizedNames.length || new Set(normalizedCoordinates).size !== normalizedCoordinates.length) {
      setRoutePreviewError('Duplicate stop names or coordinates were found. Keep each route stop unique and in travel order.');
      return;
    }
    const formatPoint = (stop: typeof routeStops[number]) => `${stop.name.trim()} | ${stop.latitude} | ${stop.longitude}`;
    setRoutePreviewLoading(true);
    setRoutePreviewError('');
    try {
      const result = await api.previewRoadRoute(
        formatPoint(routeStops[0]),
        formatPoint(routeStops[routeStops.length - 1]),
        routeStops.slice(1, -1).map(formatPoint)
      );
      setRoutePreview(result);
      if (result.distanceKm) setRouteDistanceKm(String(result.distanceKm));
      if (result.durationSeconds) setRouteDurationMinutes(String(Math.max(1, Math.round(result.durationSeconds / 60))));
    } catch (error) {
      setRoutePreview(null);
      setRoutePreviewError(error instanceof Error ? error.message : 'Could not validate this route.');
    } finally {
      setRoutePreviewLoading(false);
    }
  };
  const [notes, setNotes] = useState('');
  const fillStopCoordinates = async () => {
    setLocationLookupLoading(true);
    setSubmissionError('');
    try {
      const position = await Geolocation.getCurrentPosition({ enableHighAccuracy: true, timeout: 20000, maximumAge: 0 });
      setStopLatitude(position.coords.latitude.toFixed(6));
      setStopLongitude(position.coords.longitude.toFixed(6));
    } catch {
      setSubmissionError('Could not read your location. Check GPS permission and enter the coordinates manually.');
    } finally {
      setLocationLookupLoading(false);
    }
  };
  const fillKnownStopCoordinates = async (index: number, value: string) => {
    const stopName = value.trim();
    if (!stopName) return;
    try {
      const matches = await api.searchPlaces(stopName, 8);
      const exact = matches.find((item: any) => item.place?.canonicalName?.toLocaleLowerCase() === stopName.toLocaleLowerCase()) ||
        matches.find((item: any) => item.matchScore >= 95);
      if (exact?.place && Number.isFinite(exact.place.latitude) && Number.isFinite(exact.place.longitude)) {
        updateRouteStop(index, 'latitude', String(exact.place.latitude));
        updateRouteStop(index, 'longitude', String(exact.place.longitude));
      }
    } catch {
      // Manual coordinates remain available if the place catalogue is offline.
    }
  };

  // Status check state
  const [refIdQuery, setRefIdQuery] = useState('');
  const [statusResult, setStatusResult] = useState<any>(null);
  const [statusError, setStatusError] = useState('');

  // Submission result
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submittedRefId, setSubmittedRefId] = useState<string | null>(null);
  const [submissionError, setSubmissionError] = useState('');

  useEffect(() => {
    if (!routeIdParam || submissionType !== 'UPDATE_ROUTE') return;
    let cancelled = false;
    setSubmissionError('');
    api.getRouteById(routeIdParam).then((result: any) => {
      if (cancelled) return;
      const route = result?.route;
      if (!route) {
        setSubmissionError('The selected route could not be loaded. Return to the route page and try again.');
        return;
      }
      const stops = Array.isArray(route.stops) ? route.stops : [];
      setRouteNumber(String(route.routeNumber || ''));
      setDirection(route.direction === 'DOWN' ? 'DOWN' : 'UP');
      setRouteName(String(route.routeName || ''));
      setOrigin(String(route.originStopName || ''));
      setDestination(String(route.destinationStopName || ''));
      setOperatorName(String(route.operatorName || ''));
      setRouteDistanceKm(String(route.distanceKm || ''));
      setRouteDurationMinutes(String(route.typicalDurationMinutes || ''));
      setFirstDepartureTime(String(route.firstDepartureTime || ''));
      setLastDepartureTime(String(route.lastDepartureTime || ''));
      setFrequencyMinutes(String(route.frequencyMinutes || ''));
      setDepartureTimes(Array.isArray(route.departureTimes) ? route.departureTimes.join(', ') : '');
      setOperatingDays(Array.isArray(route.operatingDays) && route.operatingDays.length === 7 ? 'Daily' : (route.operatingDays || []).join(','));
      setRouteStops(stops.map((stop: any) => ({
        name: String(stop.stopName || stop.name || ''),
        latitude: String(stop.latitude ?? ''),
        longitude: String(stop.longitude ?? ''),
        arrivalTime: String(stop.scheduledArrivalTime || ''),
        departureTime: String(stop.scheduledDepartureTime || ''),
      })));
      setRoutePreview(null);
      setRoutePreviewError('');
    }).catch((error: unknown) => {
      if (!cancelled) setSubmissionError(error instanceof Error ? error.message : 'Unable to load the existing route.');
    });
    return () => { cancelled = true; };
  }, [routeIdParam, submissionType]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isRouteSubmission) {
      const times = departureTimes.split(',').map(time => time.trim()).filter(Boolean);
      const validTime = (time: string) => /^([01]\d|2[0-3]):[0-5]\d$/.test(time);
      if (times.some(time => !validTime(time)) || new Set(times).size !== times.length) {
        setSubmissionError('Exact departure times must be unique 24-hour HH:MM values.');
        return;
      }
      const days = operatingDays.trim().toLowerCase() === 'daily' ? [] : operatingDays.split(',').map(day => day.trim().slice(0, 3).toUpperCase()).filter(Boolean);
      if (days.some(day => !['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'].includes(day))) {
        setSubmissionError('Operating days must be Daily or comma-separated MON,TUE,WED,THU,FRI,SAT,SUN.');
        return;
      }
    }
    if (isRouteSubmission && routePreview?.routeStatus !== 'ROAD_ROUTE_FOUND_IN_SUBMITTED_ORDER') {
      setSubmissionError('Check the OpenStreetMap road route in the submitted stop order before sending this route for Super Admin approval.');
      return;
    }
    if (isOperatorSubmission && (operatorName.trim().length < 2 || operatorContactName.trim().length < 2 || operatorContactPhone.replace(/\D/g, '').length < 10)) {
      setSubmissionError(t('owner_submission_contact_error'));
      return;
    }
    setIsSubmitting(true);
    setSubmissionError('');

    try {
      const submissionData = {
        submissionType,
        entityType: isRouteSubmission ? 'ROUTE' : submissionType === 'ADD_STOP' ? 'STOP' : (submissionType === 'ADD_BUS' || submissionType === 'CORRECT_TIMETABLE') ? 'TIMETABLE' : 'BUS',
        targetEntityId: searchParams.get('busId') || searchParams.get('routeId') || undefined,
        contributorNote: notes,
        proposedData: {
          name: name || routeNumber,
          latitude: stopLatitude ? Number(stopLatitude) : undefined,
          longitude: stopLongitude ? Number(stopLongitude) : undefined,
          evidenceUrl: evidenceUrl.trim() || undefined,
          routeNumber,
          direction,
          origin,
          destination,
          state: stateName,
          departureTime,
          arrivalTime,
          busIdentifier,
          frequencyMinutes: frequencyMinutes ? Number(frequencyMinutes) : undefined,
          timetableEntry: (submissionType === 'ADD_BUS' || submissionType === 'CORRECT_TIMETABLE') && !(isOperatorSubmission && busIdParam),
          originalBusIdentifier: originalBusIdentifier || undefined,
          routeName,
          operatorName,
          distanceKm: routeDistanceKm ? Number(routeDistanceKm) : undefined,
          typicalDurationMinutes: routeDurationMinutes ? Number(routeDurationMinutes) : undefined,
          firstDepartureTime,
          lastDepartureTime,
          departureTimes: departureTimes.split(',').map(time => time.trim()).filter(Boolean),
          stops: isRouteSubmission && Array.isArray(routePreview?.points)
            ? routePreview.points.map((point: any, index: number) => ({
                name: String(point.name),
                latitude: Number(point.latitude),
                longitude: Number(point.longitude),
                arrivalTime: routeStops[index]?.arrivalTime || undefined,
                departureTime: routeStops[index]?.departureTime || undefined,
              }))
            : routeStops.map(stop => ({
                ...stop,
                latitude: stop.latitude === '' ? undefined : Number(stop.latitude),
                longitude: stop.longitude === '' ? undefined : Number(stop.longitude),
              })),
          operatingDays: operatingDays.split(',').map(day => day.trim()).filter(Boolean),
          action: submissionType === 'UPDATE_ROUTE' ? 'UPDATE_ROUTE' : isOperatorSubmission && busIdParam && submissionType === 'CORRECT_TIMETABLE' ? 'UPDATE_BUS_TIMETABLE' : undefined,
        },
      };
      const res = isOperatorSubmission
        ? await api.submitOperatorContribution({ ...submissionData, operatorName, contactName: operatorContactName, contactPhone: operatorContactPhone, officialEmail: operatorOfficialEmail })
        : await api.submitContribution(submissionData);

      setSubmittedRefId(res.referenceId);
      setIsSubmitting(false);
    } catch (error) {
      setSubmissionError(error instanceof Error ? error.message : t('contribution_backend_error'));
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
          <span>{t('contribute_no_account')}</span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-bold text-yatriwarm-950">
          {t('contribute_heading')}
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
          {t('contribute_submit_tab')}
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
          {t('contribute_status_tab')}
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
                  {t('contribution_queued')}
                </p>
              </div>

              <div className="p-4 bg-yatriwarm-50 rounded-2xl border border-yatriwarm-200 max-w-sm mx-auto">
                <div className="text-xs text-yatriwarm-500 font-medium">{t('contribution_reference')}</div>
                <div className="text-lg font-mono font-bold text-yatribrand-900 mt-1 select-all">
                  {submittedRefId}
                </div>
                <div className="text-[11px] text-yatriwarm-400 mt-1">
                  {t('contribution_save_reference')}
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setSubmittedRefId(null);
                    setName('');
                    setStopLatitude('');
                    setStopLongitude('');
                    setEvidenceUrl('');
                    setRoutePreview(null);
                    setRoutePreviewError('');
                    setRouteStops([
                      { name: '', latitude: '', longitude: '', arrivalTime: '', departureTime: '' },
                      { name: '', latitude: '', longitude: '', arrivalTime: '', departureTime: '' },
                    ]);
                    setRouteNumber('');
                    setBusIdentifier('');
                    setDepartureTime('');
                    setArrivalTime('');
                    setFrequencyMinutes('');
                    setNotes('');
                  }}
                  className="px-5 py-2.5 bg-yatribrand-900 text-white rounded-xl text-xs font-semibold shadow-subtle hover:bg-yatribrand-950 transition-colors"
                >
                  {t('contribution_submit_another')}
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              {submissionError && <div role="alert" className="mb-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800">{submissionError}</div>}
              {isOperatorSubmission && <section className="rounded-2xl border border-yatribrand-200 bg-yatribrand-50 p-4 space-y-3">
                <div className="text-sm font-bold text-yatriwarm-900">{t('owner_account_free_title')}</div>
                <p className="text-xs text-yatriwarm-600">{t('owner_account_free_description')}</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <label className="text-xs font-medium text-yatriwarm-700">{t('operator_agency_name')}<input required value={operatorName} onChange={e => setOperatorName(e.target.value)} placeholder="e.g. Delhi Transport Corporation" className="mt-1 w-full rounded-xl border border-yatriwarm-200 bg-white px-3 py-2" /></label>
                  <label className="text-xs font-medium text-yatriwarm-700">{t('owner_contact_person')}<input required value={operatorContactName} onChange={e => setOperatorContactName(e.target.value)} placeholder="Contact person" className="mt-1 w-full rounded-xl border border-yatriwarm-200 bg-white px-3 py-2" /></label>
                  <label className="text-xs font-medium text-yatriwarm-700">{t('operator_contact_phone')}<input required type="tel" value={operatorContactPhone} onChange={e => setOperatorContactPhone(e.target.value)} placeholder="10-digit phone number" className="mt-1 w-full rounded-xl border border-yatriwarm-200 bg-white px-3 py-2" /></label>
                  <label className="text-xs font-medium text-yatriwarm-700">{t('operator_official_email')} ({t('optional_label')})<input type="email" value={operatorOfficialEmail} onChange={e => setOperatorOfficialEmail(e.target.value)} placeholder="office@example.in" className="mt-1 w-full rounded-xl border border-yatriwarm-200 bg-white px-3 py-2" /></label>
                </div>
              </section>}
              {/* Type selection */}
              <div>
                <label className="block text-xs font-bold text-yatriwarm-700 uppercase tracking-wider mb-2">
                  What would you like to contribute?
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
                  {[
                    { id: 'ADD_BUS' as SubmissionType, label: 'Add Bus to Route' },
                    { id: 'SUGGEST_ROUTE' as SubmissionType, label: 'Add New Route' },
                    ...(routeIdParam ? [{ id: 'UPDATE_ROUTE' as SubmissionType, label: 'Update Existing Route' }] : []),
                    { id: 'ADD_STOP' as SubmissionType, label: 'Add Stop' },
                    { id: 'CORRECT_TIMETABLE' as SubmissionType, label: 'Add / Fix Timetable' },
                    { id: 'REPORT_CHANGED_ROUTE' as SubmissionType, label: 'Report Issue' },
                    { id: 'DELETE_BUS' as SubmissionType, label: t('request_bus_removal') },
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
                {(submissionType === 'ADD_BUS' || submissionType === 'CORRECT_TIMETABLE') && (
                  <div>
                    <label className="block text-xs font-medium text-yatriwarm-700 mb-1">
                      Existing Route Number
                    </label>
                    <input
                      type="text"
                      required
                      value={routeNumber}
                      onChange={e => setRouteNumber(e.target.value)}
                      placeholder="Enter an existing route number"
                      className="w-full px-3.5 py-2.5 bg-yatriwarm-50 border border-yatriwarm-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-yatribrand-800 focus:bg-white"
                    />
                  </div>
                )}

                {submissionType === 'DELETE_BUS' && <>
                  <div>
                    <label className="block text-xs font-medium text-yatriwarm-700 mb-1">{t('existing_route_number')}</label>
                    <input required value={routeNumber} onChange={e => setRouteNumber(e.target.value)} placeholder="e.g. DTC-534" className="w-full px-3.5 py-2.5 bg-yatriwarm-50 border border-yatriwarm-200 rounded-xl text-xs" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-yatriwarm-700 mb-1">{t('bus_name_number_to_remove')}</label>
                    <input required value={busIdentifier} onChange={e => setBusIdentifier(e.target.value)} placeholder="e.g. DTC 534 / DL-1P-xxxx" className="w-full px-3.5 py-2.5 bg-yatriwarm-50 border border-yatriwarm-200 rounded-xl text-xs" />
                  </div>
                </>}
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
                    <div className="mt-2 grid grid-cols-2 gap-2">
                      <input aria-label="Bus stop latitude" type="number" required min="6" max="38" step="any" value={stopLatitude} onChange={e => setStopLatitude(e.target.value)} placeholder="Latitude (6–38)" className="w-full px-3 py-2 bg-yatriwarm-50 border border-yatriwarm-200 rounded-xl text-xs" />
                      <input aria-label="Bus stop longitude" type="number" required min="68" max="98" step="any" value={stopLongitude} onChange={e => setStopLongitude(e.target.value)} placeholder="Longitude (68–98)" className="w-full px-3 py-2 bg-yatriwarm-50 border border-yatriwarm-200 rounded-xl text-xs" />
                    </div>
                    <button type="button" onClick={() => void fillStopCoordinates()} disabled={locationLookupLoading} className="mt-2 rounded-lg border border-yatriwarm-200 px-3 py-2 text-[11px] font-semibold text-yatriwarm-700 disabled:opacity-50">{locationLookupLoading ? 'Reading GPS…' : 'Use my current GPS location'}</button>
                  </div>
                )}

                <div>
                  <label className="block text-xs font-medium text-yatriwarm-700 mb-1">
                    State / Union Territory
                  </label>
                  <select
                    value={stateName}
                    onChange={e => setStateName(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-yatriwarm-50 border border-yatriwarm-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-yatribrand-800 focus:bg-white"
                  >
                    <option value="Andhra Pradesh">Andhra Pradesh</option>
                    <option value="Arunachal Pradesh">Arunachal Pradesh</option>
                    <option value="Assam">Assam</option>
                    <option value="Bihar">Bihar</option>
                    <option value="Chhattisgarh">Chhattisgarh</option>
                    <option value="Goa">Goa</option>
                    <option value="Gujarat">Gujarat</option>
                    <option value="Haryana">Haryana</option>
                    <option value="Himachal Pradesh">Himachal Pradesh</option>
                    <option value="Jharkhand">Jharkhand</option>
                    <option value="Karnataka">Karnataka</option>
                    <option value="Kerala">Kerala</option>
                    <option value="Madhya Pradesh">Madhya Pradesh</option>
                    <option value="Maharashtra">Maharashtra</option>
                    <option value="Manipur">Manipur</option>
                    <option value="Meghalaya">Meghalaya</option>
                    <option value="Mizoram">Mizoram</option>
                    <option value="Nagaland">Nagaland</option>
                    <option value="Odisha">Odisha</option>
                    <option value="Punjab">Punjab</option>
                    <option value="Rajasthan">Rajasthan</option>
                    <option value="Sikkim">Sikkim</option>
                    <option value="Tamil Nadu">Tamil Nadu</option>
                    <option value="Telangana">Telangana</option>
                    <option value="Tripura">Tripura</option>
                    <option value="Uttar Pradesh">Uttar Pradesh</option>
                    <option value="Uttarakhand">Uttarakhand</option>
                    <option value="West Bengal">West Bengal</option>
                    <option value="Andaman and Nicobar Islands">Andaman and Nicobar Islands</option>
                    <option value="Chandigarh">Chandigarh</option>
                    <option value="Dadra and Nagar Haveli and Daman and Diu">Dadra and Nagar Haveli and Daman and Diu</option>
                    <option value="Delhi">Delhi</option>
                    <option value="Jammu and Kashmir">Jammu and Kashmir</option>
                    <option value="Ladakh">Ladakh</option>
                    <option value="Lakshadweep">Lakshadweep</option>
                    <option value="Puducherry">Puducherry</option>
                  </select>
                </div>

                {submissionType !== 'SUGGEST_ROUTE' && <div>
                  <label className="block text-xs font-medium text-yatriwarm-700 mb-1">
                    Origin Terminal
                  </label>
                  <input
                    type="text"
                    required
                    value={origin}
                    onChange={e => setOrigin(e.target.value)}
                    placeholder="e.g. Anand Vihar ISBT"
                    className="w-full px-3.5 py-2.5 bg-yatriwarm-50 border border-yatriwarm-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-yatribrand-800 focus:bg-white"
                  />
                </div>}

                {submissionType !== 'SUGGEST_ROUTE' && <div>
                  <label className="block text-xs font-medium text-yatriwarm-700 mb-1">
                    Destination Terminal
                  </label>
                  <input
                    type="text"
                    required
                    value={destination}
                    onChange={e => setDestination(e.target.value)}
                    placeholder="e.g. Mehrauli Terminal"
                    className="w-full px-3.5 py-2.5 bg-yatriwarm-50 border border-yatriwarm-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-yatribrand-800 focus:bg-white"
                  />
                </div>}
              </div>

              {isRouteSubmission && (
                <section className="rounded-2xl border border-amber-300 bg-amber-50/70 p-4 space-y-4">
                  <div>
                    <h3 className="text-sm font-bold text-yatriwarm-900">New route details</h3>
                    <p className="text-[11px] text-yatriwarm-600 mt-1">Add stops in travel order. Latitude and longitude are required for every stop. The route stays private until Super Admin approval.</p>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <label className="text-xs font-medium text-yatriwarm-700">Route number
                      <input required value={routeNumber} onChange={e => setRouteNumber(e.target.value)} placeholder="e.g. DTC-534" className="mt-1 w-full px-3 py-2.5 bg-white border border-yatriwarm-300 rounded-xl" />
                    </label>
                    <label className="text-xs font-medium text-yatriwarm-700">Route name
                      <input required value={routeName} onChange={e => setRouteName(e.target.value)} placeholder="e.g. Kashmere Gate to Mehrauli" className="mt-1 w-full px-3 py-2.5 bg-white border border-yatriwarm-300 rounded-xl" />
                    </label>
                    <label className="text-xs font-medium text-yatriwarm-700">{t('route_direction_label')}<select value={direction} onChange={e => setDirection(e.target.value as 'UP' | 'DOWN')} className="mt-1 w-full px-3 py-2.5 bg-white border border-yatriwarm-300 rounded-xl"><option value="UP">{t('route_direction_outbound')}</option><option value="DOWN">{t('route_direction_return')}</option></select></label>
                    {!isOperatorSubmission && <label className="text-xs font-medium text-yatriwarm-700">Bus operator / service name
                      <input required value={operatorName} onChange={e => setOperatorName(e.target.value)} placeholder="Operator name" className="mt-1 w-full px-3 py-2.5 bg-white border border-yatriwarm-300 rounded-xl" />
                    </label>}
                    <label className="text-xs font-medium text-yatriwarm-700">Total route distance (km)
                      <input required type="number" min="0.1" step="0.1" value={routeDistanceKm} onChange={e => setRouteDistanceKm(e.target.value)} placeholder="e.g. 42" className="mt-1 w-full px-3 py-2.5 bg-white border border-yatriwarm-300 rounded-xl" />
                    </label>
                    <label className="text-xs font-medium text-yatriwarm-700">Typical journey duration (minutes)
                      <input required type="number" min="1" value={routeDurationMinutes} onChange={e => setRouteDurationMinutes(e.target.value)} placeholder="e.g. 90" className="mt-1 w-full px-3 py-2.5 bg-white border border-yatriwarm-300 rounded-xl" />
                    </label>
                    <label className="text-xs font-medium text-yatriwarm-700">First departure (IST)
                      <input required type="time" value={firstDepartureTime} onChange={e => setFirstDepartureTime(e.target.value)} className="mt-1 w-full px-3 py-2.5 bg-white border border-yatriwarm-300 rounded-xl" />
                    </label>
                    <label className="text-xs font-medium text-yatriwarm-700">Last departure (IST)
                      <input required type="time" value={lastDepartureTime} onChange={e => setLastDepartureTime(e.target.value)} className="mt-1 w-full px-3 py-2.5 bg-white border border-yatriwarm-300 rounded-xl" />
                    </label>
                    <label className="text-xs font-medium text-yatriwarm-700">Frequency in minutes (optional)
                      <input type="number" min="1" max="1440" value={frequencyMinutes} onChange={e => setFrequencyMinutes(e.target.value)} placeholder="e.g. 30" className="mt-1 w-full px-3 py-2.5 bg-white border border-yatriwarm-300 rounded-xl" />
                    </label>
                    <label className="text-xs font-medium text-yatriwarm-700">Exact departure times (optional)
                      <input value={departureTimes} onChange={e => setDepartureTimes(e.target.value)} placeholder="05:45, 06:15, 06:45, 07:20" className="mt-1 w-full px-3 py-2.5 bg-white border border-yatriwarm-300 rounded-xl" />
                      <span className="mt-1 block text-[10px] text-yatriwarm-500">Use 24-hour HH:MM times, separated by commas. Add only times confirmed by the operator.</span>
                    </label>
                    <label className="text-xs font-medium text-yatriwarm-700">Operating days
                      <input value={operatingDays} onChange={e => setOperatingDays(e.target.value)} placeholder="Daily or MON,TUE,WED..." className="mt-1 w-full px-3 py-2.5 bg-white border border-yatriwarm-300 rounded-xl" />
                    </label>
                  </div>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-bold text-yatriwarm-800">Ordered route stops</h4>
                      <button type="button" disabled={routeStops.length >= 25} onClick={() => setRouteStops(current => current.length >= 25 ? current : [...current.slice(0, -1), { name: '', latitude: '', longitude: '', arrivalTime: '', departureTime: '' }, current[current.length - 1]])} className="text-xs font-semibold text-red-700 disabled:opacity-40">+ Add intermediate stop</button>
                    </div>
                    {routeStops.map((stop, index) => (
                      <div key={index} className="rounded-xl border border-yatriwarm-200 bg-white p-3 space-y-2">
                        <div className="flex items-center justify-between gap-2"><span className="text-xs font-bold text-yatriwarm-800">Stop {index + 1} {index === 0 ? '(Origin)' : index === routeStops.length - 1 ? '(Destination)' : '(Intermediate)'}</span>
                          <div className="flex items-center gap-2">
                            {index > 0 && index < routeStops.length - 1 && <><button type="button" onClick={() => moveRouteStop(index, -1)} disabled={index === 1} aria-label="Move stop up" className="rounded-md border border-yatriwarm-200 px-2 py-1 text-[11px] disabled:opacity-30">↑</button><button type="button" onClick={() => moveRouteStop(index, 1)} disabled={index === routeStops.length - 2} aria-label="Move stop down" className="rounded-md border border-yatriwarm-200 px-2 py-1 text-[11px] disabled:opacity-30">↓</button></>}
                            {routeStops.length > 2 && index > 0 && index < routeStops.length - 1 && <button type="button" onClick={() => setRouteStops(current => current.filter((_, i) => i !== index))} className="text-[11px] text-red-700">Remove</button>}
                          </div>
                        </div>
                        <input required value={stop.name} onChange={e => updateRouteStop(index, 'name', e.target.value)} onBlur={e => void fillKnownStopCoordinates(index, e.target.value)} placeholder="Stop / place name (saved places auto-fill coordinates)" className="w-full px-3 py-2 bg-yatriwarm-50 border border-yatriwarm-200 rounded-lg text-xs" />
                        <div className="grid grid-cols-2 gap-2">
                          <input required type="number" min="6" max="38" step="any" value={stop.latitude} onChange={e => updateRouteStop(index, 'latitude', e.target.value)} placeholder="Latitude" className="w-full px-3 py-2 bg-yatriwarm-50 border border-yatriwarm-200 rounded-lg text-xs" />
                          <input required type="number" min="68" max="98" step="any" value={stop.longitude} onChange={e => updateRouteStop(index, 'longitude', e.target.value)} placeholder="Longitude" className="w-full px-3 py-2 bg-yatriwarm-50 border border-yatriwarm-200 rounded-lg text-xs" />
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <label className="text-[10px] text-yatriwarm-600">Arrival (optional)<input type="time" value={stop.arrivalTime} onChange={e => updateRouteStop(index, 'arrivalTime', e.target.value)} className="mt-1 w-full px-2 py-2 bg-yatriwarm-50 border border-yatriwarm-200 rounded-lg text-xs" /></label>
                          <label className="text-[10px] text-yatriwarm-600">Departure (optional)<input type="time" value={stop.departureTime} onChange={e => updateRouteStop(index, 'departureTime', e.target.value)} className="mt-1 w-full px-2 py-2 bg-yatriwarm-50 border border-yatriwarm-200 rounded-lg text-xs" /></label>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="rounded-2xl border border-yatriwarm-200 bg-white p-4 space-y-3">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <h4 className="text-xs font-bold text-yatriwarm-900">Road route validation</h4>
                        <p className="text-[11px] text-yatriwarm-600">Checks that every stop connects in the exact order you selected using OpenStreetMap routing.</p>
                      </div>
                      <button type="button" onClick={() => void checkNewRoutePreview()} disabled={routePreviewLoading} className="shrink-0 rounded-xl bg-slate-950 px-3 py-2 text-xs font-bold text-white disabled:opacity-50">{routePreviewLoading ? 'Checking…' : 'Check route'}</button>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-yatriwarm-700">
                      <span className="font-semibold truncate">{routeStops[0]?.name || 'Origin'}</span>
                      <span className="flex-1 border-t-2 border-dashed border-amber-400" />
                      <span className="font-semibold truncate">{routeStops[routeStops.length - 1]?.name || 'Destination'}</span>
                    </div>
                    {routePreview?.routeStatus === 'ROAD_ROUTE_FOUND_IN_SUBMITTED_ORDER' && <div role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-800"><b>Road path checked.</b> {routePreview.distanceKm} km · {Math.round(routePreview.durationSeconds / 60)} min · {routePreview.points?.length || routeStops.length} ordered points. This does not prove that a bus service operates on the route.</div>}
                    {routePreviewError && <p role="alert" className="text-xs text-rose-700">{routePreviewError}</p>}
                    <p className="text-[10px] text-yatriwarm-500">© OpenStreetMap contributors · Routing by OSRM. Super Admin approval is still required.</p>
                  </div>
                </section>
              )}

              {(submissionType === 'ADD_BUS' || submissionType === 'CORRECT_TIMETABLE') && (
                <div className="rounded-2xl border border-amber-300 bg-amber-50/70 p-4 space-y-3 sm:col-span-2">
                  <div className="text-xs font-bold uppercase tracking-wider text-yatriwarm-800">Bus timetable details</div>
                  <p className="text-[11px] text-yatriwarm-600">Use an existing route number. Your bus and time will appear in public search only after Super Admin verification.</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-yatriwarm-700 mb-1">Bus name / number</label>
                      <input type="text" required value={busIdentifier} onChange={e => setBusIdentifier(e.target.value)} placeholder="e.g. DTC 534 / DL-1P-xxxx" className="w-full px-3.5 py-2.5 bg-white border border-yatriwarm-300 rounded-xl text-xs font-medium focus:ring-2 focus:ring-red-500" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-yatriwarm-700 mb-1">Departure time (IST)</label>
                      <input type="time" required value={departureTime} onChange={e => setDepartureTime(e.target.value)} className="w-full px-3.5 py-2.5 bg-white border border-yatriwarm-300 rounded-xl text-xs font-medium focus:ring-2 focus:ring-red-500" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-yatriwarm-700 mb-1">Arrival time (IST)</label>
                      <input type="time" required value={arrivalTime} onChange={e => setArrivalTime(e.target.value)} className="w-full px-3.5 py-2.5 bg-white border border-yatriwarm-300 rounded-xl text-xs font-medium focus:ring-2 focus:ring-red-500" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-yatriwarm-700 mb-1">Frequency in minutes (optional)</label>
                      <input type="number" min="1" max="1440" value={frequencyMinutes} onChange={e => setFrequencyMinutes(e.target.value)} placeholder="e.g. 30" className="w-full px-3.5 py-2.5 bg-white border border-yatriwarm-300 rounded-xl text-xs font-medium focus:ring-2 focus:ring-red-500" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-yatriwarm-700 mb-1">Operating days (optional)</label>
                      <input value={operatingDays} onChange={e => setOperatingDays(e.target.value)} placeholder="Daily or MON,TUE,WED..." className="w-full px-3.5 py-2.5 bg-white border border-yatriwarm-300 rounded-xl text-xs font-medium focus:ring-2 focus:ring-red-500" />
                    </div>
                  </div>
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-yatriwarm-700 mb-1">Official timetable / operator evidence link (optional)</label>
                <input type="url" value={evidenceUrl} onChange={e => setEvidenceUrl(e.target.value)} placeholder="https://official-operator-site.example/timetable" className="w-full px-3.5 py-2.5 bg-yatriwarm-50 border border-yatriwarm-200 rounded-xl text-xs" />
              </div>

              {/* Contributor note */}
              <div>
                <label className="block text-xs font-medium text-yatriwarm-700 mb-1">
                  Additional Notes / Evidence (Optional)
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
                {isSubmitting ? 'Submitting...' : 'Submit Contribution'}
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
                Enter Your Submission Reference ID
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
                  <span className="text-yatriwarm-500">Submission Type:</span>{' '}
                  <strong className="text-yatriwarm-800">{statusResult.submissionType}</strong>
                </div>
                <div>
                  <span className="text-yatriwarm-500">Submitted:</span>{' '}
                  <strong className="text-yatriwarm-800">{new Date(statusResult.submittedAt).toLocaleDateString()}</strong>
                </div>
              </div>

              {statusResult.adminDecisionReason && (
                <div className="text-xs text-yatriwarm-700 bg-white p-2.5 rounded-lg border border-yatriwarm-200">
                  <span className="font-semibold">Reviewer Note:</span> {statusResult.adminDecisionReason}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
