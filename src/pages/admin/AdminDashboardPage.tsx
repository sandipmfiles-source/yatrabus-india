import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../../services/api.js';
import { SystemHealthStats } from '@shared/types/admin.js';
import { MapPin, BusFront, Route as RouteIcon, Radio, FileText, Sliders, Activity, LogOut, Copy } from 'lucide-react';

export const AdminDashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const token = localStorage.getItem('yatribus_admin_token');
  const [stats, setStats] = useState<SystemHealthStats | null>(null);
  const [recentSubmissions, setRecentSubmissions] = useState<any[]>([]);

  useEffect(() => {
    if (!token) { navigate('/admin'); return; }
    api.getAdminOverview(token).then(res => {
      setStats(res.stats);
      setRecentSubmissions(res.recentSubmissions || []);
    }).catch(() => {
      localStorage.removeItem('yatribus_admin_token');
      navigate('/admin');
    });
  }, [token, navigate]);

  const handleLogout = () => {
    localStorage.removeItem('yatribus_admin_token');
    navigate('/admin');
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-yatriwarm-200">
        <div>
          <div className="flex items-center gap-2"><span className="text-xl font-extrabold text-yatribrand-900">YatraBus Super Admin</span><span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800">Owner Access</span></div>
          <p className="text-xs text-yatriwarm-500 mt-0.5">Private owner console for transit records, submissions and platform monitoring.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link to="/admin/submissions" className="px-3 py-1.5 rounded-xl bg-yatribrand-900 text-white text-xs font-semibold">Bus Approvals</Link>
          <Link to="/admin/places" className="px-3 py-1.5 rounded-xl bg-white border border-yatriwarm-200 text-xs font-medium text-yatriwarm-700 flex items-center gap-1.5"><MapPin className="w-3.5 h-3.5" />Places</Link>
          <Link to="/admin/buses" className="px-3 py-1.5 rounded-xl bg-white border border-yatriwarm-200 text-xs font-medium text-yatriwarm-700 flex items-center gap-1.5"><BusFront className="w-3.5 h-3.5" />Buses & Fleet</Link>
          <Link to="/admin/duplicates" className="px-3 py-1.5 rounded-xl bg-white border border-yatriwarm-200 text-xs font-medium text-yatriwarm-700 flex items-center gap-1.5"><Copy className="w-3.5 h-3.5" />Duplicates</Link>
          <Link to="/admin/tracking" className="px-3 py-1.5 rounded-xl bg-white border border-yatriwarm-200 text-xs font-medium text-yatriwarm-700 flex items-center gap-1.5"><Radio className="w-3.5 h-3.5" />Live Tracking</Link>
          <Link to="/admin/automation" className="px-3 py-1.5 rounded-xl bg-white border border-yatriwarm-200 text-xs font-medium text-yatriwarm-700 flex items-center gap-1.5"><Sliders className="w-3.5 h-3.5" />Rules</Link>
          <Link to="/admin/health" className="px-3 py-1.5 rounded-xl bg-white border border-yatriwarm-200 text-xs font-medium text-yatriwarm-700 flex items-center gap-1.5"><Activity className="w-3.5 h-3.5" />Health</Link>
          <button onClick={handleLogout} className="px-3 py-1.5 rounded-xl bg-rose-50 text-rose-700 text-xs font-medium flex items-center gap-1.5 border border-rose-200"><LogOut className="w-3.5 h-3.5" />Sign Out</button>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Metric label="Places" value={stats?.totalPlaces} detail="Transit stops & hubs" icon={<MapPin className="w-4 h-4" />} />
        <Metric label="Routes" value={stats?.totalRoutes} detail={`${stats?.totalStops || 0} stops mapped`} icon={<RouteIcon className="w-4 h-4" />} />
        <Metric label="Active Sessions" value={stats?.activeJourneySessionsCount} detail={`${stats?.liveBusesTrackingCount || 0} live buses`} icon={<Radio className="w-4 h-4" />} />
        <Metric label="Review Queue" value={stats?.pendingSubmissionsCount} detail="Pending user submissions" icon={<FileText className="w-4 h-4" />} />
      </div>

      <section className="bg-white rounded-3xl p-6 border border-yatriwarm-200 shadow-card space-y-4">
        <div className="flex items-center justify-between gap-3 pb-3 border-b border-yatriwarm-200">
          <div><h2 className="text-base font-bold text-yatriwarm-900">Pending Bus & Route Submissions</h2><p className="text-xs text-yatriwarm-500">Review every user contribution before it is treated as verified.</p></div>
          <Link to="/admin/submissions" className="px-3.5 py-1.5 bg-yatribrand-900 text-white rounded-xl text-xs font-semibold">Open Approval Queue</Link>
        </div>
        {recentSubmissions.length ? <div className="divide-y divide-yatriwarm-100">{recentSubmissions.map(sub => <div key={sub.id} className="py-3 flex items-center justify-between gap-4 text-xs"><div><div className="font-semibold text-yatriwarm-900">{sub.referenceId} · {sub.submissionType}</div><div className="text-yatriwarm-500 mt-1">{sub.contributorNote || 'No contributor note'}</div></div><Link to="/admin/submissions" className="px-3 py-1 bg-yatriwarm-100 rounded-lg">Review</Link></div>)}</div> : <div className="text-center py-6 text-xs text-yatriwarm-500">No pending submissions are currently returned by the server.</div>}
      </section>
    </div>
  );
};

const Metric: React.FC<{label:string;value?:number;detail:string;icon:React.ReactNode}> = ({label,value,detail,icon}) => (
  <div className="bg-white p-4 rounded-2xl border border-yatriwarm-200 shadow-card">
    <div className="flex items-center justify-between"><span className="text-xs font-bold text-yatriwarm-500 uppercase tracking-wider">{label}</span>{icon}</div>
    <div className="text-2xl font-bold text-yatriwarm-900 mt-2">{value ?? '—'}</div>
    <div className="text-[11px] text-yatriwarm-400 mt-0.5">{detail}</div>
  </div>
);
