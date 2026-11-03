import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../../services/api.js';
import type { Route } from '@shared/types/bus.js';
import { QrCode, ShieldCheck } from 'lucide-react';

export const AdminQrLabelsPage: React.FC = () => {
  const navigate = useNavigate();
  const [routes, setRoutes] = useState<Route[]>([]);
  const [routeId, setRouteId] = useState('');
  const [stopId, setStopId] = useState('');
  const [token, setToken] = useState('');
  const [expiresAt, setExpiresAt] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const adminToken = localStorage.getItem('yatribus_admin_token') || '';
  useEffect(() => {
    if (!adminToken) { navigate('/admin'); return; }
    api.adminGetRoutes(adminToken, '').then(result => {
      const verified = (result.routes || []).filter((route: Route) => route.verificationStatus === 'ADMIN_VERIFIED');
      setRoutes(verified);
      setRouteId(verified[0]?.id || '');
    }).catch(reason => setError(reason instanceof Error ? reason.message : 'Unable to load verified routes.'))
      .finally(() => setLoading(false));
  }, [adminToken, navigate]);
  const selectedRoute = useMemo(() => routes.find(route => route.id === routeId), [routes, routeId]);
  const selectedStop = useMemo(() => selectedRoute?.stops.find(stop => stop.id === stopId), [selectedRoute, stopId]);
  const publicAppUrl = (import.meta.env.VITE_PUBLIC_APP_URL || window.location.origin).replace(/\/$/, '');
  const qrUrl = token && /^https:\/\//i.test(publicAppUrl) ? publicAppUrl + '/stopqr/' + encodeURIComponent(token) : '';
  const qrImageUrl = qrUrl ? 'https://api.qrserver.com/v1/create-qr-code/?size=260x260&data=' + encodeURIComponent(qrUrl) : '';
  const issue = async () => {
    if (!selectedRoute || !selectedStop) return;
    setBusy(true); setError(''); setToken('');
    try {
      const result = await api.adminCreateStopQr(adminToken, selectedRoute.id, selectedStop.id);
      setToken(result.token);
      setExpiresAt(result.expiresAt);
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Unable to issue stop QR.'); }
    finally { setBusy(false); }
  };
  return <div className="max-w-3xl mx-auto px-4 py-8 space-y-5">
    <div className="flex items-center justify-between gap-3"><div className="flex items-center gap-3"><QrCode className="h-6 w-6"/><div><h1 className="text-2xl font-extrabold">Verified stop QR labels</h1><p className="text-sm text-yatriwarm-600">Super Admin issuance for verified routes and surveyed stops only.</p></div></div><Link to="/admin/dashboard" className="rounded-xl border px-3 py-2 text-xs font-semibold">Admin</Link></div>
    <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900"><ShieldCheck className="inline h-4 w-4 mr-1"/>A signed QR is issued only when the route is ADMIN_VERIFIED and the selected stop has valid surveyed coordinates. Tokens expire after one year.</div>
    {error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-800">{error}</p>}
    {loading ? <p>Loading verified routes…</p> : !routes.length ? <p className="rounded-xl border bg-white p-4 text-sm text-yatriwarm-600">No Super Admin-verified routes are available. Verify a route and its stop coordinates before issuing QR labels.</p> : <section className="rounded-2xl border bg-white p-5 space-y-4">
      <div><label htmlFor="qr-route" className="block text-xs font-bold mb-1">Verified route</label><select id="qr-route" value={routeId} onChange={e => { setRouteId(e.target.value); setStopId(''); setToken(''); }} className="w-full rounded-xl border p-3">{routes.map(route => <option key={route.id} value={route.id}>{route.routeNumber} · {route.routeName}</option>)}</select></div>
      <div><label htmlFor="qr-stop" className="block text-xs font-bold mb-1">Surveyed stop</label><select id="qr-stop" value={stopId} onChange={e => { setStopId(e.target.value); setToken(''); }} className="w-full rounded-xl border p-3"><option value="">Select a stop</option>{(selectedRoute?.stops || []).filter(stop => Number.isFinite(stop.latitude) && stop.latitude >= 6 && stop.latitude <= 38 && Number.isFinite(stop.longitude) && stop.longitude >= 68 && stop.longitude <= 98).map(stop => <option key={stop.id} value={stop.id}>{stop.stopSequence}. {stop.stopName}</option>)}</select></div>
      <button type="button" onClick={() => void issue()} disabled={!selectedStop || busy} className="rounded-xl bg-yatribrand-900 px-4 py-3 text-sm font-bold text-white disabled:opacity-50">{busy ? 'Issuing…' : 'Issue signed stop QR'}</button>
    </section>}
    {token && <section className="rounded-2xl border border-emerald-200 bg-white p-5 space-y-3">
      <p className="text-sm font-bold text-emerald-800">Signed stop QR issued</p>
      {qrImageUrl ? <img src={qrImageUrl} alt="Signed YatraBus bus stop QR code" className="w-64 h-64 mx-auto" /> : <p className="text-xs text-amber-800">Set VITE_PUBLIC_APP_URL to your public HTTPS app address before printing QR labels. The current app origin is not a public HTTPS address.</p>}
      <p className="text-xs text-yatriwarm-600">Expires: {new Date(expiresAt).toLocaleString()}</p>
      <p className="break-all text-[10px] text-yatriwarm-500">Signed token: {token}</p>
      <button type="button" onClick={() => void navigator.clipboard.writeText(qrUrl || token)} className="rounded-xl border px-3 py-2 text-xs font-semibold">Copy QR link / token</button>
      <p className="text-[10px] text-yatriwarm-500">The QR image is rendered by an external QR image service. It receives only the signed public route/stop token, not passenger location or personal data. Verify the image loads before printing.</p>
    </section>}
  </div>;
};
