import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../../services/api.js';
import { SystemHealthStats } from '@shared/types/admin.js';
import {
  ShieldCheck,
  MapPin,
  BusFront,
  Route as RouteIcon,
  Radio,
  FileText,
  Sliders,
  Activity,
  LogOut,
  AlertCircle,
  Copy,
} from 'lucide-react';

export const AdminDashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const token = localStorage.getItem('yatribus_admin_token') || 'yatribus_admin_dev_token';

  const [stats, setStats] = useState<SystemHealthStats | null>(null);
  const [recentSubmissions, setRecentSubmissions] = useState<any[]>([]);

  useEffect(() => {
    api.getAdminOverview(token).then(res => {
      setStats(res.stats);
      setRecentSubmissions(res.recentSubmissions || []);
    });
  }, [token]);

  const handleLogout = () => {
    localStorage.removeItem('yatribus_admin_token');
    navigate('/admin');
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 space-y-8">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-yatriwarm-200">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xl font-extrabold text-yatribrand-900">Administrator Console</span>
            <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
              Active Verifier
            </span>
          </div>
          <p className="text-xs text-yatriwarm-500 mt-0.5">
            Overview of India-wide transit records, passenger-assisted sessions, and verification queues.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Link
            to="/admin/places"
            className="px-3 py-1.5 rounded-xl bg-white hover:bg-yatriwarm-100 border border-yatriwarm-200 text-xs font-medium text-yatriwarm-700 flex items-center gap-1.5 shadow-subtle"
          >
            <MapPin className="w-3.5 h-3.5 text-yatribrand-800" />
            Places
          </Link>

          <Link
            to="/admin/buses"
            className="px-3 py-1.5 rounded-xl bg-white hover:bg-yatriwarm-100 border border-yatriwarm-200 text-xs font-medium text-yatriwarm-700 flex items-center gap-1.5 shadow-subtle"
          >
            <BusFront className="w-3.5 h-3.5 text-yatribrand-800" />
            Buses & Fleet
          </Link>

          <Link
            to="/admin/duplicates"
            className="px-3 py-1.5 rounded-xl bg-white hover:bg-yatriwarm-100 border border-yatriwarm-200 text-xs font-medium text-yatriwarm-700 flex items-center gap-1.5 shadow-subtle"
          >
            <Copy className="w-3.5 h-3.5 text-amber-600" />
            Duplicates
          </Link>

          <Link
            to="/admin/tracking"
            className="px-3 py-1.5 rounded-xl bg-white hover:bg-yatriwarm-100 border border-yatriwarm-200 text-xs font-medium text-yatriwarm-700 flex items-center gap-1.5 shadow-subtle"
          >
            <Radio className="w-3.5 h-3.5 text-emerald-600" />
            Live Tracking
          </Link>

          <Link
            to="/admin/automation"
            className="px-3 py-1.5 rounded-xl bg-white hover:bg-yatriwarm-100 border border-yatriwarm-200 text-xs font-medium text-yatriwarm-700 flex items-center gap-1.5 shadow-subtle"
          >
            <Sliders className="w-3.5 h-3.5" />
            Rules
          </Link>

          <Link
            to="/admin/health"
            className="px-3 py-1.5 rounded-xl bg-white hover:bg-yatriwarm-100 border border-yatriwarm-200 text-xs font-medium text-yatriwarm-700 flex items-center gap-1.5 shadow-subtle"
          >
            <Activity className="w-3.5 h-3.5" />
            Health
          </Link>

          <button
            onClick={handleLogout}
            className="px-3 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-medium flex items-center gap-1.5 border border-rose-200 transition-colors"
          >
            <LogOut className="w-3.5 h-3.5" />
            Sign Out
          </button>
        </div>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-2xl border border-yatriwarm-200 shadow-card">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-yatriwarm-500 uppercase tracking-wider">Places</span>
            <MapPin className="w-4 h-4 text-yatribrand-800" />
          </div>
          <div className="text-2xl font-bold text-yatriwarm-900 mt-2">{stats?.totalPlaces || 0}</div>
          <div className="text-[11px] text-yatriwarm-400 mt-0.5">Verified Indian stops & hubs</div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-yatriwarm-200 shadow-card">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-yatriwarm-500 uppercase tracking-wider">Routes</span>
            <RouteIcon className="w-4 h-4 text-yatribrand-800" />
          </div>
          <div className="text-2xl font-bold text-yatriwarm-900 mt-2">{stats?.totalRoutes || 0}</div>
          <div className="text-[11px] text-yatriwarm-400 mt-0.5">{stats?.totalStops || 0} total stops mapped</div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-yatriwarm-200 shadow-card">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-yatriwarm-500 uppercase tracking-wider">Active Sessions</span>
            <Radio className="w-4 h-4 text-emerald-600 animate-pulse" />
          </div>
          <div className="text-2xl font-bold text-emerald-700 mt-2">{stats?.activeJourneySessionsCount || 0}</div>
          <div className="text-[11px] text-yatriwarm-400 mt-0.5">{stats?.liveBusesTrackingCount || 0} buses in live state</div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-yatriwarm-200 shadow-card">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-yatriwarm-500 uppercase tracking-wider">Review Queue</span>
            <FileText className="w-4 h-4 text-amber-600" />
          </div>
          <div className="text-2xl font-bold text-amber-700 mt-2">{stats?.pendingSubmissionsCount || 0}</div>
          <div className="text-[11px] text-yatriwarm-400 mt-0.5">Community suggestions pending</div>
        </div>
      </div>

      {/* Review Queue Preview */}
      <div className="bg-white rounded-3xl p-6 border border-yatriwarm-200 shadow-card space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-yatriwarm-200">
          <div>
            <h3 className="text-base font-bold text-yatriwarm-900">
              Pending Community Submissions
            </h3>
            <p className="text-xs text-yatriwarm-500">
              Verify passenger contributions before official public directory publication.
            </p>
          </div>

          <Link
            to="/admin/submissions"
            className="px-3.5 py-1.5 bg-yatribrand-900 text-white rounded-xl text-xs font-semibold hover:bg-yatribrand-950 transition-colors shadow-subtle"
          >
            Open Full Moderation Queue
          </Link>
        </div>

        {recentSubmissions.length > 0 ? (
          <div className="divide-y divide-yatriwarm-100">
            {recentSubmissions.map(sub => (
              <div key={sub.id} className="py-3 flex items-center justify-between gap-4 text-xs">
                <div>
                  <div className="font-semibold text-yatriwarm-900 flex items-center gap-2">
                    <span className="font-mono text-yatribrand-900">{sub.referenceId}</span>
                    <span className="px-2 py-0.5 rounded bg-yatriwarm-100 text-yatriwarm-700 font-medium">
                      {sub.submissionType}
                    </span>
                  </div>
                  <div className="text-yatriwarm-500 mt-1 line-clamp-1">
                    {sub.contributorNote || 'No contributor note provided'}
                  </div>
                </div>

                <Link
                  to="/admin/submissions"
                  className="px-3 py-1 bg-yatriwarm-100 hover:bg-yatribrand-50 text-yatribrand-900 rounded-lg font-medium transition-colors"
                >
                  Review
                </Link>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-6 text-xs text-yatriwarm-400">
            Review queue is clear! All community submissions processed.
          </div>
        )}
      </div>
    </div>
  );
};
