import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { repository } from '../../../backend/src/db/repository.js';
import { SystemHealthStats, AuditLogEntry } from '@shared/types/admin.js';
import { ArrowLeft, Activity, Database, CheckCircle, ShieldCheck } from 'lucide-react';

export const AdminHealthPage: React.FC = () => {
  const [stats, setStats] = useState<SystemHealthStats | null>(null);
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);

  useEffect(() => {
    setStats(repository.getSystemHealthStats());
    setAuditLogs(repository.getAuditLogs(20));
  }, []);

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
      <div className="flex items-center gap-3">
        <Link
          to="/admin/dashboard"
          className="p-2 rounded-xl bg-white hover:bg-yatriwarm-100 border border-yatriwarm-200 text-yatriwarm-700 transition-colors shadow-subtle"
        >
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-xl font-bold text-yatriwarm-950">System Health & Audit Trail</h1>
          <p className="text-xs text-yatriwarm-500">
            Real-time database connectivity, service uptime, and immutable verification audit logs.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4 bg-white rounded-2xl border border-yatriwarm-200 shadow-card flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center shrink-0">
            <CheckCircle className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs text-yatriwarm-500 font-medium">Service Status</div>
            <div className="text-sm font-bold text-emerald-800">{stats?.status || 'HEALTHY'}</div>
          </div>
        </div>

        <div className="p-4 bg-white rounded-2xl border border-yatriwarm-200 shadow-card flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-yatribrand-100 text-yatribrand-800 flex items-center justify-center shrink-0">
            <Database className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs text-yatriwarm-500 font-medium">Database Layer</div>
            <div className="text-sm font-bold text-yatribrand-900">
              {stats?.databaseConnected ? 'Connected (PostGIS/Spatial)' : 'Disconnected'}
            </div>
          </div>
        </div>

        <div className="p-4 bg-white rounded-2xl border border-yatriwarm-200 shadow-card flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-sky-100 text-sky-800 flex items-center justify-center shrink-0">
            <Activity className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs text-yatriwarm-500 font-medium">Uptime</div>
            <div className="text-sm font-bold text-sky-900">{stats?.uptimeSeconds || 0} seconds</div>
          </div>
        </div>
      </div>

      {/* Audit Logs */}
      <div className="bg-white rounded-3xl p-6 border border-yatriwarm-200 shadow-card space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-yatriwarm-200">
          <h3 className="text-base font-bold text-yatriwarm-900">
            Administrative Audit Trail
          </h3>
          <span className="text-xs font-mono text-yatriwarm-400">
            Last {auditLogs.length} events
          </span>
        </div>

        {auditLogs.length > 0 ? (
          <div className="divide-y divide-yatriwarm-100">
            {auditLogs.map(log => (
              <div key={log.id} className="py-2.5 flex items-center justify-between gap-4 text-xs">
                <div>
                  <div className="font-semibold text-yatriwarm-900 flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded font-mono text-[10px] bg-yatribrand-100 text-yatribrand-800">
                      {log.action}
                    </span>
                    <span>{log.entityType} ({log.entityId})</span>
                  </div>
                  {log.reason && <div className="text-yatriwarm-500 text-[11px] mt-0.5">{log.reason}</div>}
                </div>
                <div className="text-right text-[11px] text-yatriwarm-400 font-mono">
                  {new Date(log.timestamp).toLocaleTimeString()}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-xs text-yatriwarm-400">
            No audit records created yet.
          </div>
        )}
      </div>
    </div>
  );
};
