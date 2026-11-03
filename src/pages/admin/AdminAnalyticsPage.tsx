import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../../services/api.js';
import type { SystemHealthStats, AuditLogEntry } from '@shared/types/admin.js';
import { Activity, AlertTriangle, BusFront, ClipboardCheck, MapPin, Radio, ShieldCheck, Database, Clock3, Gauge, Timer } from 'lucide-react';

export const AdminAnalyticsPage: React.FC = () => {
  const navigate = useNavigate();
  const [stats, setStats] = useState<SystemHealthStats | null>(null);
  const [audit, setAudit] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  useEffect(() => {
    const token = localStorage.getItem('yatribus_admin_token');
    if (!token) { navigate('/admin'); return; }
    api.getAdminOverview(token).then(result => {
      setStats(result.stats || null);
      setAudit(result.recentAudit || []);
    }).catch(reason => {
      setError(reason instanceof Error ? reason.message : 'Analytics could not be loaded.');
    }).finally(() => setLoading(false));
  }, [navigate]);
  const metric = (label: string, value: number | string, icon: React.ReactNode, detail: string) => (
    <article className="rounded-2xl border border-yatriwarm-200 bg-white p-4 space-y-2">
      <div className="flex items-center justify-between text-yatriwarm-600"><span className="text-xs font-semibold">{label}</span>{icon}</div>
      <div className="text-2xl font-extrabold text-yatriwarm-950 tabular-nums">{value}</div>
      <p className="text-[11px] text-yatriwarm-500">{detail}</p>
    </article>
  );
  return <div className="max-w-6xl mx-auto px-4 py-8 space-y-6">
    <div className="flex items-center justify-between gap-3"><div><h1 className="text-2xl font-extrabold">Platform analytics</h1><p className="text-sm text-yatriwarm-600">Super Admin operational and data-quality overview.</p></div><Link to="/admin/dashboard" className="rounded-xl border px-3 py-2 text-sm font-semibold">Back to admin</Link></div>
    {error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-800">{error}</p>}
    {loading ? <p>Loading analytics…</p> : stats && <>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {metric('Routes',stats.totalRoutes,<BusFront className="h-4 w-4"/>,'All route records in the repository')}
        {metric('Buses',stats.totalBuses,<BusFront className="h-4 w-4"/>,'All bus records')}
        {metric('Stops',stats.totalStops,<MapPin className="h-4 w-4"/>,'Ordered route-stop records')}
        {metric('Places',stats.totalPlaces,<MapPin className="h-4 w-4"/>,'Administrative and transit place records')}
        {metric('Pending submissions',stats.pendingSubmissionsCount,<ClipboardCheck className="h-4 w-4"/>,'Awaiting Super Admin review')}
        {metric('Duplicate candidates',stats.pendingDuplicatesCount,<AlertTriangle className="h-4 w-4"/>,'Require human review; never auto-merged')}
        {metric('Live buses',stats.liveBusesTrackingCount,<Radio className="h-4 w-4"/>,'Fresh live GPS aggregates only')}
        {metric('Average GPS confidence',Math.round(stats.averageConfidenceScore) + '%',<Activity className="h-4 w-4"/>,'Aggregate confidence score; not a vehicle identity guarantee')}
        {metric('Active journey sessions',stats.activeJourneySessionsCount,<Timer className="h-4 w-4"/>,'Current active passenger journey sessions')}
        {metric('Database',stats.databaseConnected ? 'Connected' : 'Unavailable',<Database className="h-4 w-4"/>,'Backend database connectivity check')}
        {metric('System health',stats.status,<Gauge className="h-4 w-4"/>,'Backend health status')}
        {metric('Uptime',Math.floor(stats.uptimeSeconds / 3600) + ' h',<Clock3 className="h-4 w-4"/>,'Current backend process uptime')}
        {metric('Last data import',stats.lastImportTime ? new Date(stats.lastImportTime).toLocaleString() : 'Not recorded',<Clock3 className="h-4 w-4"/>,'Most recent import timestamp reported by backend')}
      </div>
      <div className="rounded-2xl border border-yatriwarm-200 bg-white p-4 space-y-3">
        <div className="flex items-center gap-2"><ShieldCheck className="h-5 w-5"/><h2 className="font-bold">Verification and audit history</h2></div>
        {!audit.length ? <p className="text-sm text-yatriwarm-600">No recent audit entries are available.</p> : audit.map(item => <div key={item.id} className="border-t border-yatriwarm-100 pt-3 text-xs">
          <div className="flex flex-wrap items-center justify-between gap-2"><strong>{item.action} · {item.entityType}</strong><time className="text-yatriwarm-500">{new Date(item.timestamp).toLocaleString()}</time></div>
          <p className="text-yatriwarm-700">Record: {item.entityId} · Actor: {item.actorRole}</p>
          {item.reason && <p className="text-yatriwarm-600">Reason: {item.reason}</p>}
        </div>)}
      </div>
      <p className="text-[11px] text-yatriwarm-500">Analytics are based on the current single-instance repository snapshot. They are not a historical trend database. Audit records are shown as returned by the backend.</p>
    </>}
  </div>;
};
