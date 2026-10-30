import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../services/api.js';
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
  const [routeName, setRouteName] = useState('');
  const [origin, setOrigin] = useState('');
  const [destination, setDestination] = useState('');
  const [departureTime, setDepartureTime] = useState('');
  const [arrivalTime, setArrivalTime] = useState('');
  const [firstDepartureTime, setFirstDepartureTime] = useState('');
  const [lastDepartureTime, setLastDepartureTime] = useState('');
  const [distanceKm, setDistanceKm] = useState('');
  const [durationMinutes, setDurationMinutes] = useState('');
  const [stopsText, setStopsText] = useState('');
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
    setRouteName(String(data.routeName || ''));
    setOrigin(String(data.origin || ''));
    setDestination(String(data.destination || ''));
    setFirstDepartureTime(String(data.firstDepartureTime || ''));
    setLastDepartureTime(String(data.lastDepartureTime || ''));
    setDistanceKm(String(data.distanceKm || ''));
    setDurationMinutes(String(data.typicalDurationMinutes || ''));
    setStopsText((Array.isArray(data.stops) ? data.stops : []).map((stop: any) =>
      [stop.name || stop.stopName || '', stop.latitude ?? '', stop.longitude ?? '', stop.arrivalTime || stop.scheduledArrivalTime || '', stop.departureTime || stop.scheduledDepartureTime || ''].join(' | ')
    ).join('\n'));
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
    setLoading(true);
    setError('');
    setMessage('');
    const stops = stopsText.split('\n').map(line => line.trim()).filter(Boolean).map(line => {
      const [name, latitude, longitude, arrivalTime, departureTime] = line.split('|').map(part => part.trim());
      return { name, latitude: latitude ? Number(latitude) : undefined, longitude: longitude ? Number(longitude) : undefined, arrivalTime, departureTime };
    });
    try {
      const proposedData = {
        name: busName,
        busIdentifier: busName,
        operatorName,
        routeNumber,
        routeName: routeName || (origin + ' to ' + destination),
        origin,
        destination,
        departureTime,
        arrivalTime,
        firstDepartureTime,
        lastDepartureTime,
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
              <label className="text-xs text-yatriwarm-700">Bus short name / number<input required value={busName} onChange={e => setBusName(e.target.value)} placeholder="e.g. Jhargram-Kolkata Express" className="mt-1 w-full px-3 py-2 rounded-xl border border-yatriwarm-200 bg-white" /></label>
              <label className="text-xs text-yatriwarm-700">Bus owner / samiti name<input required value={operatorName} onChange={e => setOperatorName(e.target.value)} placeholder="Owner or bus samiti" className="mt-1 w-full px-3 py-2 rounded-xl border border-yatriwarm-200 bg-white" /></label>
              <label className="text-xs text-yatriwarm-700">Route number / code<input required value={routeNumber} onChange={e => setRouteNumber(e.target.value)} placeholder="Route code" className="mt-1 w-full px-3 py-2 rounded-xl border border-yatriwarm-200 bg-white" /></label>
              <label className="text-xs text-yatriwarm-700">Route name<input value={routeName} onChange={e => setRouteName(e.target.value)} placeholder="Jhargram to Kolkata" className="mt-1 w-full px-3 py-2 rounded-xl border border-yatriwarm-200 bg-white" /></label>
              <label className="text-xs text-yatriwarm-700">Starting place<input required value={origin} onChange={e => setOrigin(e.target.value)} placeholder="Jhargram" className="mt-1 w-full px-3 py-2 rounded-xl border border-yatriwarm-200 bg-white" /></label>
              <label className="text-xs text-yatriwarm-700">Destination<input required value={destination} onChange={e => setDestination(e.target.value)} placeholder="Kolkata" className="mt-1 w-full px-3 py-2 rounded-xl border border-yatriwarm-200 bg-white" /></label>
              {kind === 'TIMETABLE' ? <>
                <label className="text-xs text-yatriwarm-700">Departure time<input required type="time" value={departureTime} onChange={e => setDepartureTime(e.target.value)} className="mt-1 w-full px-3 py-2 rounded-xl border border-yatriwarm-200 bg-white" /></label>
                <label className="text-xs text-yatriwarm-700">Arrival time<input required type="time" value={arrivalTime} onChange={e => setArrivalTime(e.target.value)} className="mt-1 w-full px-3 py-2 rounded-xl border border-yatriwarm-200 bg-white" /></label>
              </> : <>
                <label className="text-xs text-yatriwarm-700">First departure<input required type="time" value={firstDepartureTime} onChange={e => setFirstDepartureTime(e.target.value)} className="mt-1 w-full px-3 py-2 rounded-xl border border-yatriwarm-200 bg-white" /></label>
                <label className="text-xs text-yatriwarm-700">Last departure<input required type="time" value={lastDepartureTime} onChange={e => setLastDepartureTime(e.target.value)} className="mt-1 w-full px-3 py-2 rounded-xl border border-yatriwarm-200 bg-white" /></label>
                <label className="text-xs text-yatriwarm-700">Route distance (km)<input required type="number" min="1" value={distanceKm} onChange={e => setDistanceKm(e.target.value)} className="mt-1 w-full px-3 py-2 rounded-xl border border-yatriwarm-200 bg-white" /></label>
                <label className="text-xs text-yatriwarm-700">Journey duration (minutes)<input required type="number" min="1" value={durationMinutes} onChange={e => setDurationMinutes(e.target.value)} className="mt-1 w-full px-3 py-2 rounded-xl border border-yatriwarm-200 bg-white" /></label>
              </>}
              <label className="sm:col-span-2 text-xs text-yatriwarm-700">Stops in order (one per line: Name | latitude | longitude | arrival HH:MM | departure HH:MM)<textarea required={kind === 'ROUTE'} rows={5} value={stopsText} onChange={e => setStopsText(e.target.value)} placeholder={'Jhargram | 22.45 | 86.98 | 06:55 | 07:00\nLodhasuli | 22.48 | 87.05 | 07:25 | 07:30\nKharagpur | 22.34 | 87.32 | 07:55 | 08:00\nKolkata | 22.57 | 88.36 | 10:30 | 10:35'} className="mt-1 w-full px-3 py-2 rounded-xl border border-yatriwarm-200 bg-white" /></label>
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
