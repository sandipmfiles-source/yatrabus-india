import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../services/api.js';
import { useLanguage } from '../context/LanguageContext.js';
import { BusFront, CheckCircle, Clock, LogOut, PlusCircle, ShieldCheck } from 'lucide-react';

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (options: { client_id: string; callback: (response: { credential: string }) => void }) => void;
          renderButton: (parent: HTMLElement, options: Record<string, unknown>) => void;
        };
      };
    };
  }
}

type OwnerUser = { id: string; email: string; name: string };
type OwnerSubmission = { id: string; referenceId: string; submissionType: string; status: string; createdAt: string; contributorNote?: string; proposedData?: Record<string, any> };

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || '';

export const OwnerDashboardPage: React.FC = () => {
  const { t } = useLanguage();
  const buttonRef = useRef<HTMLDivElement>(null);
  const [token, setToken] = useState(() => localStorage.getItem('yatribus_owner_token') || '');
  const [user, setUser] = useState<OwnerUser | null>(null);
  const [submissions, setSubmissions] = useState<OwnerSubmission[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [kind, setKind] = useState<'ROUTE' | 'TIMETABLE'>('TIMETABLE');
  const [editingSubmissionId, setEditingSubmissionId] = useState<string | null>(null);
  const [editingOriginalBusIdentifier, setEditingOriginalBusIdentifier] = useState('');
  const [busName, setBusName] = useState('');
  const [operatorName, setOperatorName] = useState('');
  const [routeNumber, setRouteNumber] = useState('');
  const [direction, setDirection] = useState<'UP' | 'DOWN'>('UP');
  const [routeName, setRouteName] = useState('');
  const [origin, setOrigin] = useState('');
  const [destination, setDestination] = useState('');
  const [departureTime, setDepartureTime] = useState('');
  const [arrivalTime, setArrivalTime] = useState('');
  const [firstDepartureTime, setFirstDepartureTime] = useState('');
  const [lastDepartureTime, setLastDepartureTime] = useState('');
  const [frequencyMinutes, setFrequencyMinutes] = useState('');
  const [departureTimes, setDepartureTimes] = useState('');
  const [operatingDays, setOperatingDays] = useState('Daily');
  const [distanceKm, setDistanceKm] = useState('');
  const [durationMinutes, setDurationMinutes] = useState('');
  const [stopsText, setStopsText] = useState('');
  const [newStopName, setNewStopName] = useState('');
  const [routePreview, setRoutePreview] = useState<any>(null);
  const [routePreviewError, setRoutePreviewError] = useState('');
  const [routePreviewLoading, setRoutePreviewLoading] = useState(false);
  const [note, setNote] = useState('');

  const loadSubmissions = useCallback(async (sessionToken: string) => {
    try {
      const data = await api.getOwnerSubmissions(sessionToken);
      setSubmissions(data.submissions || []);
      setUser(data.user || null);
    } catch (err) {
      localStorage.removeItem('yatribus_owner_token');
      setToken('');
      setUser(null);
      setError(err instanceof Error ? err.message : 'Owner session expired. Please sign in again.');
    }
  }, []);

  useEffect(() => {
    if (token) void loadSubmissions(token);
  }, [token, loadSubmissions]);

  useEffect(() => {
    if (!GOOGLE_CLIENT_ID || token) return;
    const initialize = () => {
      if (!window.google?.accounts.id || !buttonRef.current) return;
      window.google.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: async response => {
          setLoading(true);
          setError('');
          try {
            const result = await api.googleOwnerLogin(response.credential);
            localStorage.setItem('yatribus_owner_token', result.token);
            setToken(result.token);
            setUser(result.user);
          } catch (err) {
            setError(err instanceof Error ? err.message : 'Google sign-in failed.');
          } finally {
            setLoading(false);
          }
        },
      });
      buttonRef.current.innerHTML = '';
      window.google.accounts.id.renderButton(buttonRef.current, { theme: 'outline', size: 'large', shape: 'pill', text: 'continue_with', width: 280 });
    };
    if (window.google?.accounts.id) {
      initialize();
      return;
    }
    let script = document.querySelector<HTMLScriptElement>('script[data-yatribus-google="true"]');
    if (!script) {
      script = document.createElement('script');
      script.src = 'https://accounts.google.com/gsi/client';
      script.async = true;
      script.defer = true;
      script.dataset.yatribusGoogle = 'true';
      document.head.appendChild(script);
    }
    script.addEventListener('load', initialize);
    return () => script?.removeEventListener('load', initialize);
  }, [token]);

  useEffect(() => {
    setRoutePreview(null);
    setRoutePreviewError('');
  }, [origin, destination, stopsText]);

  const checkRoutePreview = async () => {
    if (origin.trim().length < 2 || destination.trim().length < 2) {
      setRoutePreviewError('Enter a starting place and destination first.');
      return;
    }
    const stops = stopsText.split('\n').map(line => line.trim()).filter(Boolean);
    setRoutePreviewLoading(true);
    setRoutePreviewError('');
    try {
      const result = await api.previewRoadRoute(origin.trim(), destination.trim(), stops);
      setRoutePreview(result);
      if (result.distanceKm) setDistanceKm(String(result.distanceKm));
      if (result.durationSeconds) setDurationMinutes(String(Math.max(1, Math.round(result.durationSeconds / 60))));
    } catch (err) {
      setRoutePreview(null);
      setRoutePreviewError(err instanceof Error ? err.message : 'Free road-route preview unavailable.');
    } finally {
      setRoutePreviewLoading(false);
    }
  };

  const moveIntermediateStop = (index: number, offset: -1 | 1) => {
    const lines = stopsText.split('\n').map(line => line.trim()).filter(Boolean);
    const target = index + offset;
    if (target < 0 || target >= lines.length) return;
    [lines[index], lines[target]] = [lines[target], lines[index]];
    setStopsText(lines.join('\n'));
  };

  const signOut = () => {
    localStorage.removeItem('yatribus_owner_token');
    setToken('');
    setUser(null);
    setSubmissions([]);
  };

  const startEdit = (item: OwnerSubmission) => {
    const data = item.proposedData || {};
    setKind('TIMETABLE');
    setEditingSubmissionId(item.id);
    setEditingOriginalBusIdentifier(String(data.busIdentifier || data.name || ''));
    setBusName(String(data.busIdentifier || data.name || ''));
    setOperatorName(String(data.operatorName || ''));
    setRouteNumber(String(data.routeNumber || ''));
    setDirection(data.direction === 'DOWN' ? 'DOWN' : 'UP');
    setRouteName(String(data.routeName || ''));
    setOrigin(String(data.origin || ''));
    setDestination(String(data.destination || ''));
    setDepartureTime(String(data.departureTime || ''));
    setArrivalTime(String(data.arrivalTime || ''));
    setStopsText((Array.isArray(data.stops) ? data.stops : []).map((stop: any) =>
      [stop.name || stop.stopName || '', stop.latitude ?? '', stop.longitude ?? '', stop.arrivalTime || stop.scheduledArrivalTime || '', stop.departureTime || stop.scheduledDepartureTime || ''].join(' | ')
    ).join('\n'));
    setNote('Owner timetable correction');
  };

  const startEditRoute = (item: OwnerSubmission) => {
    const data = item.proposedData || {};
    setKind('ROUTE');
    setEditingSubmissionId(item.id);
    setEditingOriginalBusIdentifier('');
    setBusName(String(data.name || data.busIdentifier || ''));
    setOperatorName(String(data.operatorName || ''));
    setRouteNumber(String(data.routeNumber || ''));
    setDirection(data.direction === 'DOWN' ? 'DOWN' : 'UP');
    setRouteName(String(data.routeName || ''));
    setOrigin(String(data.origin || ''));
    setDestination(String(data.destination || ''));
    setFirstDepartureTime(String(data.firstDepartureTime || ''));
    setLastDepartureTime(String(data.lastDepartureTime || ''));
    setFrequencyMinutes(String(data.frequencyMinutes || ''));
    setDepartureTimes(Array.isArray(data.departureTimes) ? data.departureTimes.join(', ') : '');
    setOperatingDays(Array.isArray(data.operatingDays) ? data.operatingDays.join(',') : 'Daily');
    setDistanceKm(String(data.distanceKm || ''));
    setDurationMinutes(String(data.typicalDurationMinutes || ''));
    setStopsText((Array.isArray(data.stops) ? data.stops.slice(1, -1) : []).map((stop: any) =>
      [stop.name || stop.stopName || '', stop.latitude ?? '', stop.longitude ?? '', stop.arrivalTime || stop.scheduledArrivalTime || '', stop.departureTime || stop.scheduledDepartureTime || ''].join(' | ')
    ).join('\n'));
    setRoutePreview(null);
    setNote('Owner requested route and stop update');
  };

  const requestRemoval = async (item: OwnerSubmission) => {
    if (!token || !window.confirm('Send this bus for removal review? It will remain listed until the Super Admin approves.')) return;
    setLoading(true);
    setError('');
    try {
      const result = await api.submitOwnerContribution(token, {
        submissionType: 'DELETE_BUS',
        entityType: 'BUS',
        targetEntityId: 'bus-community-' + item.id,
        contributorNote: 'Bus owner requested removal',
        proposedData: { action: 'DELETE_BUS', busIdentifier: item.proposedData?.busIdentifier || item.proposedData?.name || '' },
      });
      setMessage('Removal request submitted: ' + result.referenceId);
      await loadSubmissions(token);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to request removal.');
    } finally { setLoading(false); }
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!token) return;
    if (kind === 'ROUTE' && routePreview?.routeStatus !== 'ROAD_ROUTE_FOUND_IN_SUBMITTED_ORDER') {
      setError('Check the OpenStreetMap road route in the submitted stop order before sending a new or updated route for approval.');
      return;
    }
    setLoading(true);
    setError('');
    setMessage('');
    const enteredStops = stopsText.split('\n').map(line => line.trim()).filter(Boolean).map(line => {
      const [name, latitude, longitude, arrivalTime, departureTime] = line.split('|').map(part => part.trim());
      return { name, latitude: latitude ? Number(latitude) : undefined, longitude: longitude ? Number(longitude) : undefined, arrivalTime, departureTime };
    });
    const stops = kind === 'ROUTE' && Array.isArray(routePreview?.points)
      ? routePreview.points.map((point: any) => {
          const entered = enteredStops.find(stop => stop.name.toLocaleLowerCase() === String(point.name).toLocaleLowerCase());
          return {
            name: String(point.name),
            latitude: Number(point.latitude),
            longitude: Number(point.longitude),
            arrivalTime: entered?.arrivalTime,
            departureTime: entered?.departureTime,
          };
        })
      : enteredStops;
    try {
      const proposedData = {
        name: busName,
        busIdentifier: busName,
        operatorName,
        routeNumber,
        direction,
        routeName: routeName || (origin + ' to ' + destination),
        origin,
        destination,
        departureTime,
        arrivalTime,
        firstDepartureTime,
        lastDepartureTime,
        frequencyMinutes: frequencyMinutes ? Number(frequencyMinutes) : undefined,
        departureTimes: departureTimes.split(',').map(time => time.trim()).filter(Boolean),
        operatingDays: operatingDays.split(',').map(day => day.trim()).filter(Boolean),
        distanceKm: distanceKm ? Number(distanceKm) : undefined,
        typicalDurationMinutes: durationMinutes ? Number(durationMinutes) : undefined,
        stops,
        timetableEntry: kind === 'TIMETABLE',
        operatingDays: ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'],
      };
      const result = await api.submitOwnerContribution(token, {
        submissionType: editingSubmissionId ? 'CORRECT_TIMETABLE' : kind === 'ROUTE' ? 'SUGGEST_ROUTE' : 'ADD_BUS',
        entityType: kind === 'ROUTE' ? 'ROUTE' : 'TIMETABLE',
        targetEntityId: editingSubmissionId ? (kind === 'ROUTE' ? 'route-community-' : 'bus-community-') + editingSubmissionId : undefined,
        contributorNote: note || (editingSubmissionId ? 'Owner requested timetable update' : 'Bus owner submission'),
        proposedData: editingSubmissionId ? { ...proposedData, originalBusIdentifier: editingOriginalBusIdentifier, timetableEntry: false, action: kind === 'ROUTE' ? 'UPDATE_ROUTE' : 'UPDATE_BUS_TIMETABLE' } : proposedData,
      });
      setMessage('Request submitted. Reference ID: ' + result.referenceId + '. It will appear publicly only after Super Admin approval.');
      setEditingSubmissionId(null);
      setEditingOriginalBusIdentifier('');
      setBusName('');
      setDepartureTime('');
      setArrivalTime('');
      setNote('');
      await loadSubmissions(token);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to submit request.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 rounded-2xl bg-yatribrand-100 text-yatribrand-900 flex items-center justify-center"><BusFront className="w-6 h-6" /></div>
        <div><h1 className="text-2xl font-bold text-yatriwarm-950">Bus Owner & Driver Portal</h1><p className="text-sm text-yatriwarm-600">Bus owners, drivers and local bus samitis can submit verified timetable information.</p></div>
      </div>

      {error && <div role="alert" className="p-3 rounded-xl border border-rose-200 bg-rose-50 text-sm text-rose-800">{error}</div>}
      {message && <div role="status" className="p-3 rounded-xl border border-emerald-200 bg-emerald-50 text-sm text-emerald-800">{message}</div>}

      {!token ? (
        <section className="bg-white rounded-3xl p-6 border border-yatriwarm-200 shadow-card space-y-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-yatriwarm-900"><ShieldCheck className="w-5 h-5" />Owner sign-in is only for managing your own submissions</div>
          <p className="text-xs text-yatriwarm-600">Passengers can search buses and submit public corrections without signing in. Google sign-in is required only for the owner dashboard.</p>
          {!GOOGLE_CLIENT_ID ? <p className="text-sm text-yatriwarm-700">Google sign-in will become available after the owner configures VITE_GOOGLE_CLIENT_ID and the backend Google OAuth settings.</p> : <div ref={buttonRef} />}
          {loading && <p className="text-xs text-yatriwarm-500">Verifying Google account…</p>}
          <Link to="/contribute" className="text-xs text-yatribrand-900 underline">Passenger: add or correct bus details without login</Link>
        </section>
      ) : (
        <>
          <section className="bg-white rounded-3xl p-5 border border-yatriwarm-200 shadow-card flex items-center justify-between gap-3">
            <div><div className="text-sm font-bold text-yatriwarm-900">{user?.name || 'Signed-in owner'}</div><div className="text-xs text-yatriwarm-500">{user?.email}</div></div>
            <button type="button" onClick={signOut} className="px-3 py-2 rounded-xl border border-yatriwarm-200 text-xs flex items-center gap-2"><LogOut className="w-4 h-4" />Sign out</button>
          </section>

          <section className="bg-white rounded-3xl p-5 sm:p-7 border border-yatriwarm-200 shadow-card space-y-4">
            <div><h2 className="text-lg font-bold text-yatriwarm-900">{editingSubmissionId ? (kind === 'ROUTE' ? 'Update route and stops' : 'Update bus timetable') : 'Submit a bus or route'}</h2><p className="text-xs text-yatriwarm-500">Every owner submission goes to a separate Super Admin approval queue.</p></div>
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={() => setKind('TIMETABLE')} className={`px-3 py-2 rounded-xl text-xs font-semibold border ${kind === 'TIMETABLE' ? 'bg-yatribrand-900 text-white border-yatribrand-900' : 'bg-white text-yatriwarm-700 border-yatriwarm-200'}`}>Add bus / timetable</button>
              <button type="button" onClick={() => setKind('ROUTE')} className={`px-3 py-2 rounded-xl text-xs font-semibold border ${kind === 'ROUTE' ? 'bg-yatribrand-900 text-white border-yatribrand-900' : 'bg-white text-yatriwarm-700 border-yatriwarm-200'}`}>Suggest a new route</button>
            </div>
            <form onSubmit={submit} className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label className="text-xs text-yatriwarm-700">Bus short name / number<input required value={busName} onChange={e => setBusName(e.target.value)} placeholder="e.g. MetroLink AC 01" className="mt-1 w-full px-3 py-2 rounded-xl border border-yatriwarm-200 bg-white" /></label>
              <label className="text-xs text-yatriwarm-700">Bus owner / samiti name<input required value={operatorName} onChange={e => setOperatorName(e.target.value)} placeholder="Owner or bus samiti" className="mt-1 w-full px-3 py-2 rounded-xl border border-yatriwarm-200 bg-white" /></label>
              <label className="text-xs text-yatriwarm-700">Route number / code<input required value={routeNumber} onChange={e => setRouteNumber(e.target.value)} placeholder="Route code" className="mt-1 w-full px-3 py-2 rounded-xl border border-yatriwarm-200 bg-white" /></label>
              <label className="text-xs text-yatriwarm-700">{t('route_direction_label')}<select value={direction} onChange={e => setDirection(e.target.value as 'UP' | 'DOWN')} className="mt-1 w-full px-3 py-2 rounded-xl border border-yatriwarm-200 bg-white"><option value="UP">{t('route_direction_outbound')}</option><option value="DOWN">{t('route_direction_return')}</option></select></label>
              <label className="text-xs text-yatriwarm-700">Route name<input value={routeName} onChange={e => setRouteName(e.target.value)} placeholder="Kolkata Airport to Howrah" className="mt-1 w-full px-3 py-2 rounded-xl border border-yatriwarm-200 bg-white" /></label>
              <label className="text-xs text-yatriwarm-700">Starting place<input required value={origin} onChange={e => setOrigin(e.target.value)} placeholder="Kolkata Airport | 22.65 | 88.44" className="mt-1 w-full px-3 py-2 rounded-xl border border-yatriwarm-200 bg-white" /></label>
              <label className="text-xs text-yatriwarm-700">Destination<input required value={destination} onChange={e => setDestination(e.target.value)} placeholder="Howrah Station | 22.59 | 88.34" className="mt-1 w-full px-3 py-2 rounded-xl border border-yatriwarm-200 bg-white" /></label>
              {kind === 'TIMETABLE' ? <>
                <label className="text-xs text-yatriwarm-700">Departure time<input required type="time" value={departureTime} onChange={e => setDepartureTime(e.target.value)} className="mt-1 w-full px-3 py-2 rounded-xl border border-yatriwarm-200 bg-white" /></label>
                <label className="text-xs text-yatriwarm-700">Arrival time<input required type="time" value={arrivalTime} onChange={e => setArrivalTime(e.target.value)} className="mt-1 w-full px-3 py-2 rounded-xl border border-yatriwarm-200 bg-white" /></label>
              </> : <>
                <label className="text-xs text-yatriwarm-700">First departure<input required type="time" value={firstDepartureTime} onChange={e => setFirstDepartureTime(e.target.value)} className="mt-1 w-full px-3 py-2 rounded-xl border border-yatriwarm-200 bg-white" /></label>
                <label className="text-xs text-yatriwarm-700">Last departure<input required type="time" value={lastDepartureTime} onChange={e => setLastDepartureTime(e.target.value)} className="mt-1 w-full px-3 py-2 rounded-xl border border-yatriwarm-200 bg-white" /></label>
                <label className="text-xs text-yatriwarm-700">Route distance (km)<input required type="number" min="1" value={distanceKm} onChange={e => setDistanceKm(e.target.value)} className="mt-1 w-full px-3 py-2 rounded-xl border border-yatriwarm-200 bg-white" /></label>
                <label className="text-xs text-yatriwarm-700">Journey duration (minutes)<input required type="number" min="1" value={durationMinutes} onChange={e => setDurationMinutes(e.target.value)} className="mt-1 w-full px-3 py-2 rounded-xl border border-yatriwarm-200 bg-white" /></label>
                <label className="text-xs text-yatriwarm-700">Frequency (minutes, optional)<input type="number" min="1" max="1440" value={frequencyMinutes} onChange={e => setFrequencyMinutes(e.target.value)} className="mt-1 w-full px-3 py-2 rounded-xl border border-yatriwarm-200 bg-white" /></label>
                <label className="text-xs text-yatriwarm-700">Exact departure times (optional)<input value={departureTimes} onChange={e => setDepartureTimes(e.target.value)} placeholder="05:45, 06:15, 06:45" className="mt-1 w-full px-3 py-2 rounded-xl border border-yatriwarm-200 bg-white" /></label>
                <label className="text-xs text-yatriwarm-700">Operating days<input value={operatingDays} onChange={e => setOperatingDays(e.target.value)} placeholder="Daily or MON,TUE,WED..." className="mt-1 w-full px-3 py-2 rounded-xl border border-yatriwarm-200 bg-white" /></label>
              </>}
              <label className="sm:col-span-2 text-xs text-yatriwarm-700">Stops in order (one per line: Name | latitude | longitude | arrival HH:MM | departure HH:MM)<textarea required={kind === 'ROUTE'} rows={5} value={stopsText} onChange={e => setStopsText(e.target.value)} placeholder={'Esplanade | 22.56 | 88.35 | 06:55 | 07:00\nPark Street | 22.55 | 88.35 | 07:25 | 07:30'}  className="mt-1 w-full px-3 py-2 rounded-xl border border-yatriwarm-200 bg-white" /></label>
              <section className="sm:col-span-2 yb-premium-panel rounded-3xl p-5 sm:p-6 text-white space-y-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-[10px] uppercase tracking-[.2em] text-amber-300 font-bold">Live route preview</div>
                    <h3 className="text-lg font-bold text-white mt-1">Your bus journey, visualised</h3>
                    <p className="text-xs text-slate-300 mt-1">Use saved places or enter coordinates as Name | latitude | longitude. Route checks run only when you tap the button.</p>
                  </div>
                  <div className="yb-bus-float shrink-0">
                    <svg viewBox="0 0 120 76" width="112" height="72" role="img" aria-label="Animated YatraBus vector">
                      <defs><linearGradient id="ybBusBody" x1="0" y1="0" x2="1" y2="1"><stop stopColor="#fde68a"/><stop offset="1" stopColor="#f59e0b"/></linearGradient></defs>
                      <path d="M9 17Q9 9 19 9H94Q109 9 112 22V57H8V22Q8 17 9 17Z" fill="url(#ybBusBody)" stroke="#fff7d6" strokeWidth="2"/>
                      <path d="M17 17H98V34H17Z" fill="#172033" stroke="#fff" strokeOpacity=".55"/>
                      <path d="M21 20H42V31H21ZM47 20H68V31H47ZM73 20H94V31H73Z" fill="#7dd3fc"/>
                      <path d="M9 42H111V48H9Z" fill="#dc2626"/>
                      <text x="60" y="44" fontSize="5.5" fontWeight="bold" fill="#fff" textAnchor="middle">YATRIBUS</text>
                      <circle cx="29" cy="58" r="9" fill="#111827" stroke="#cbd5e1" strokeWidth="2"/><circle cx="91" cy="58" r="9" fill="#111827" stroke="#cbd5e1" strokeWidth="2"/>
                      <circle className="yb-bus-wheel" cx="29" cy="58" r="4" fill="none" stroke="#facc15" strokeWidth="1.5"/><circle className="yb-bus-wheel" cx="91" cy="58" r="4" fill="none" stroke="#facc15" strokeWidth="1.5"/>
                    </svg>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="rounded-xl bg-white/10 border border-white/10 p-3"><div className="text-slate-400">FROM</div><div className="font-semibold text-white mt-1">{origin || 'Starting point'}</div></div>
                  <div className="rounded-xl bg-white/10 border border-white/10 p-3"><div className="text-slate-400">TO</div><div className="font-semibold text-white mt-1">{destination || 'Destination'}</div></div>
                </div>
                <div className="pl-6 ml-2 border-l-2 yb-route-line space-y-3">
                  {(stopsText.split('\n').map(line => line.split('|')[0].trim()).filter(Boolean)).map((stop, index, all) => (
                    <div key={index} className="yb-route-stop flex items-center justify-between gap-2 text-xs text-slate-100">
                      <span>{stop}</span>
                      <span className="flex shrink-0 gap-1">
                        <button type="button" disabled={index === 0} onClick={() => moveIntermediateStop(index, -1)} aria-label={`Move ${stop} up`} className="rounded-md border border-white/20 px-2 py-1 disabled:opacity-30">↑</button>
                        <button type="button" disabled={index === all.length - 1} onClick={() => moveIntermediateStop(index, 1)} aria-label={`Move ${stop} down`} className="rounded-md border border-white/20 px-2 py-1 disabled:opacity-30">↓</button>
                      </span>
                    </div>
                  ))}
                  {stopsText.trim() === '' && <div className="text-xs text-slate-400">Intermediate stops will appear here as you add them.</div>}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <input value={newStopName} onChange={e => setNewStopName(e.target.value)} placeholder="Stop | latitude | longitude" className="min-w-0 flex-1 rounded-xl border border-white/20 bg-white/10 text-white placeholder:text-slate-400 px-3 py-2 text-xs" />
                  <button type="button" disabled={stopsText.split('\n').filter(line => line.trim()).length >= 23} onClick={() => { const name = newStopName.trim(); if (!name) return; setStopsText(current => current.trim() ? current + '\n' + name : name); setNewStopName(''); }} className="rounded-xl bg-amber-300 hover:bg-amber-200 text-slate-950 font-bold px-4 py-2 text-xs disabled:opacity-40">+ Add stop</button>
                </div>
                <div className="rounded-2xl overflow-hidden border border-white/15 bg-slate-950/60 p-3">
                  <div className="flex items-center justify-between text-[10px] uppercase tracking-wider text-slate-300 mb-2"><span>Road route preview</span><span>{routePreviewLoading ? 'Checking OpenStreetMap…' : routePreview?.provider === 'OPENSTREETMAP_OSRM' ? 'OpenStreetMap · OSRM' : 'Tap to check road route'}</span></div>
                  <button type="button" onClick={() => void checkRoutePreview()} disabled={routePreviewLoading} className="mb-3 rounded-xl bg-amber-300 hover:bg-amber-200 disabled:opacity-60 text-slate-950 font-bold px-4 py-2 text-xs">{routePreviewLoading ? 'Checking road route…' : 'Check road route (free)'}</button>
                  <svg viewBox="0 0 320 132" className="w-full h-32" role="img" aria-label="OpenStreetMap road route geometry preview">
                    <path d="M0 28H320M0 66H320M0 104H320M42 0V132M142 0V132M244 0V132" stroke="#64748b" strokeOpacity=".16" strokeWidth="1"/>
                    {routePreview?.encodedPolyline ? <path d={(() => { let lat=0,lng=0,i=0; const pts:number[][]=[]; const str=routePreview.encodedPolyline as string; while(i<str.length){let b=0,shift=0,result=0; do{b=str.charCodeAt(i++)-63;result|=(b&31)<<shift;shift+=5;}while(b>=32);lat+=((result&1)?~(result>>1):(result>>1));shift=0;result=0;do{b=str.charCodeAt(i++)-63;result|=(b&31)<<shift;shift+=5;}while(b>=32);lng+=((result&1)?~(result>>1):(result>>1));pts.push([lat/1e5,lng/1e5]);} if(!pts.length)return '';const lats=pts.map(p=>p[0]),lngs=pts.map(p=>p[1]),minLat=Math.min(...lats),maxLat=Math.max(...lats),minLng=Math.min(...lngs),maxLng=Math.max(...lngs);return pts.map(p=>((12+(p[1]-minLng)/(maxLng-minLng||1)*296).toFixed(1)+','+(120-(p[0]-minLat)/(maxLat-minLat||1)*108).toFixed(1))).join(' '); })()} fill="none" stroke="#facc15" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" /> : <path d="M24 108 C70 85 65 40 115 56 S205 100 296 20" fill="none" stroke="#facc15" strokeOpacity=".65" strokeWidth="3" strokeDasharray="6 6"/>}
                    <circle cx="24" cy="108" r="6" fill="#22c55e" stroke="white" strokeWidth="2"/><circle cx="296" cy="20" r="6" fill="#ef4444" stroke="white" strokeWidth="2"/>
                    <g transform="translate(148 49)" className="yb-bus-float"><rect width="38" height="22" rx="6" fill="#facc15"/><rect x="5" y="4" width="28" height="8" rx="2" fill="#172033"/><circle cx="9" cy="22" r="3" fill="#cbd5e1"/><circle cx="29" cy="22" r="3" fill="#cbd5e1"/></g>
                  </svg>
                  <div className="flex items-center justify-between gap-2 text-xs text-slate-200"><span className="truncate">{origin || 'Start'}</span><span className="text-amber-300 font-bold">{routePreview?.distanceKm ? routePreview.distanceKm + ' km' : '— km'}{routePreview?.durationSeconds ? ' · ' + Math.round(routePreview.durationSeconds / 60) + ' min' : ''}</span><span className="truncate text-right">{destination || 'Destination'}</span></div>
                  {routePreview?.routeStatus === 'ROAD_ROUTE_FOUND_IN_SUBMITTED_ORDER' && <div className="mt-3 rounded-xl border border-emerald-300/30 bg-emerald-300/10 p-3 text-xs text-emerald-100"><b>Road path checked:</b> All submitted points connect in the same order. This does not confirm an operating bus service.</div>}
                  {routePreviewError && <div className="mt-2 text-[11px] text-amber-200">{routePreviewError}</div>}
                  {routePreview?.attribution && <div className="mt-2 text-[10px] text-slate-400">{routePreview.attribution}</div>}{routePreview?.disclaimer && <div className="mt-2 text-[10px] text-slate-400">{routePreview.disclaimer}</div>}
                </div>
              </section>
              <label className="sm:col-span-2 text-xs text-yatriwarm-700">“Helped by” note / source details<textarea rows={2} value={note} onChange={e => setNote(e.target.value)} placeholder="Name to show as contributor, or source of timetable" className="mt-1 w-full px-3 py-2 rounded-xl border border-yatriwarm-200 bg-white" /></label>
              <button disabled={loading} type="submit" className="sm:col-span-2 px-5 py-3 rounded-xl bg-yatribrand-900 text-white text-sm font-semibold disabled:opacity-50 flex items-center justify-center gap-2"><PlusCircle className="w-4 h-4" />{loading ? 'Submitting…' : editingSubmissionId ? 'Send update for approval' : 'Send for approval'}</button>
            </form>
          </section>

          <section className="bg-white rounded-3xl p-5 border border-yatriwarm-200 shadow-card space-y-3">
            <h2 className="font-bold text-yatriwarm-900">My submissions ({submissions.length})</h2>
            {submissions.length === 0 ? <p className="text-xs text-yatriwarm-500">You have not submitted any buses or routes yet.</p> : submissions.map(item => <div key={item.id} className="flex flex-wrap items-center justify-between gap-3 py-3 border-t border-yatriwarm-100"><div><div className="text-sm font-semibold text-yatriwarm-900">{item.proposedData?.busIdentifier || item.proposedData?.name || item.submissionType}</div><div className="text-[11px] text-yatriwarm-500">{item.submissionType} · {item.referenceId} · {new Date(item.createdAt).toLocaleDateString()}</div></div><div className="flex items-center gap-2"><span className="text-[11px] rounded-full px-2 py-1 bg-yatriwarm-100 text-yatriwarm-700 flex items-center gap-1">{item.status === 'ADMIN_VERIFIED' ? <CheckCircle className="w-3 h-3" /> : <Clock className="w-3 h-3" />}{item.status.replace('_', ' ')}</span>{item.status === 'ADMIN_VERIFIED' && item.submissionType === 'ADD_BUS' && <><button type="button" onClick={() => startEdit(item)} className="text-[11px] px-2 py-1 rounded-lg border border-yatriwarm-200">Edit</button><button type="button" onClick={() => void requestRemoval(item)} className="text-[11px] px-2 py-1 rounded-lg border border-rose-200 text-rose-700">Request delete</button></>}{item.status === 'ADMIN_VERIFIED' && item.submissionType === 'SUGGEST_ROUTE' && <button type="button" onClick={() => startEditRoute(item)} className="text-[11px] px-2 py-1 rounded-lg border border-yatriwarm-200">Edit route</button>}</div></div>)}
          </section>
        </>
      )}
    </div>
  );
};
