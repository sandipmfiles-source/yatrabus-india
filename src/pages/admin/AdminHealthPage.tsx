import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { SystemHealthStats, AuditLogEntry } from '@shared/types/admin.js';
import { api } from '../../services/api.js';
import { ArrowLeft, Activity, Database, CheckCircle } from 'lucide-react';

export const AdminHealthPage: React.FC = () => {
  const navigate = useNavigate();
  const [stats, setStats] = useState<SystemHealthStats | null>(null);
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    const token = localStorage.getItem('yatribus_admin_token');
    if (!token) {
      navigate('/admin');
      return;
    }
    Promise.all([api.getAdminHealth(token), api.getAdminAuditLogs(token, 20)])
      .then(([health, audit]) => {
        setStats(health);
        setAuditLogs(audit.logs || []);
      })
      .catch((reason: unknown) => {
        localStorage.removeItem('yatribus_admin_token');
        setError(reason instanceof Error ? reason.message : 'Unable to load system health.');
        navigate('/admin');
      });
  }, [navigate]);

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
      <div className="flex items-center gap-3">
        <Link to="/admin/dashboard" className="p-2 rounded-xl bg-white hover:bg-yatriwarm-100 border border-yatriwarm-200 text-yatriwarm-700 transition-colors shadow-subtle">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-xl font-bold text-yatriwarm-950">System Health & Audit Trail</h1>
          <p className="text-xs text-yatriwarm-500">Live backend storage status, service uptime, and administrative audit logs.</p>
        </div>
      </div>

      {error && <div role="alert" className="p-3 rounded-xl bg-red-50 text-red-800 text-sm">{error}</div>}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4 bg-white rounded-2xl border border-yatriwarm-200 shadow-card flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center shrink-0"><CheckCircle className="w-5 h-5" /></div>
          <div><div className="text-xs text-yatriwarm-500 font-medium">Service Status</div><div className="text-sm font-bold text-emerald-800">{stats?.status || 'Loading…'}</div></div>
        </div>
        <div className="p-4 bg-white rounded-2xl border border-yatriwarm-200 shadow-card flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-yatribrand-100 text-yatribrand-800 flex items-center justify-center shrink-0"><Database className="w-5 h-5" /></div>
          <div><div className="text-xs text-yatriwarm-500 font-medium">Storage Layer</div><div className="text-sm font-bold text-yatribrand-900">JSON file (single instance)</div></div>
        </div>
        <div className="p-4 bg-white rounded-2xl border border-yatriwarm-200 shadow-card flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-sky-100 text-sky-800 flex items-center justify-center shrink-0"><Activity className="w-5 h-5" /></div>
          <div><div className="text-xs text-yatriwarm-500 font-medium">Uptime</div><div className="text-sm font-bold text-sky-900">{stats ? `${stats.uptimeSeconds} seconds` : 'Loading…'}</div></div>
        </div>
      </div>

      <div className="bg-white rounded-3xl p-6 border border-yatriwarm-200 shadow-card space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-yatriwarm-200">
          <h3 className="text-base font-bold text-yatriwarm-900">Administrative Audit Trail</h3>
          <span className="text-xs font-mono text-yatriwarm-400">Last {auditLogs.length} events</span>
        </div>
        {auditLogs.length > 0 ? (
          <div className="divide-y divide-yatriwarm-100">
            {auditLogs.map(log => (
              <div key={log.id} className="py-2.5 flex items-center justify-between gap-4 text-xs">
                <div>
                  <div className="font-semibold text-yatriwarm-900 flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded font-mono text-[10px] bg-yatribrand-100 text-yatribrand-800">{log.action}</span>
                    <span>{log.entityType} ({log.entityId})</span>
                  </div>
                  {log.reason && <div className="text-yatriwarm-500 text-[11px] mt-0.5">{log.reason}</div>}
                </div>
                <div className="text-right text-[11px] text-yatriwarm-400 font-mono">{new Date(log.timestamp).toLocaleTimeString()}</div>
              </div>
            ))}
          </div>
        ) : <div className="text-center py-8 text-xs text-yatriwarm-400">No audit records created yet.</div>}
      </div>
    </div>
  );
};
