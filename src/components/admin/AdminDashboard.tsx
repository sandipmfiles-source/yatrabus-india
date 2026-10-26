import React, { useState, useEffect } from 'react';
import { ApiClient } from '../../services/apiClient';
import {
  SystemHealthMetrics,
  CommunitySubmission,
  AuditLogEntry,
  AutomationRule
} from '../../types';
import {
  ShieldAlert,
  Sliders,
  CheckCircle,
  XCircle,
  Clock,
  RotateCcw,
  RefreshCw,
  LogOut,
  Users,
  MapPin,
  GitPullRequest,
  Activity,
  Layers,
  Briefcase
} from 'lucide-react';
import { t } from '../../i18n';

interface AdminDashboardProps {
  onLogout: () => void;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({ onLogout }) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'submissions' | 'claims' | 'rules' | 'audit'>('overview');
  const [health, setHealth] = useState<SystemHealthMetrics | null>(null);
  const [submissions, setSubmissions] = useState<CommunitySubmission[]>([]);
  const [claims, setClaims] = useState<any[]>([]);
  const [rules, setRules] = useState<AutomationRule[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [reviewRemarks, setReviewRemarks] = useState('');
  const [selectedSubId, setSelectedSubId] = useState<string | null>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const [healthRes, subsRes, claimsRes, rulesRes, auditRes] = await Promise.all([
        ApiClient.getHealth(),
        ApiClient.getAdminSubmissions(),
        ApiClient.getAdminClaims(),
        ApiClient.getAutomationRules(),
        ApiClient.getAuditLogs()
      ]);

      if (healthRes.success) setHealth(healthRes.data);
      if (subsRes.success) setSubmissions(subsRes.data);
      if (claimsRes.success) setClaims(claimsRes.data);
      if (rulesRes.success) setRules(rulesRes.data);
      if (auditRes.success) setAuditLogs(auditRes.data);
    } catch (err) {
      console.error('Error loading admin data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleReview = async (id: string, action: 'approved' | 'rejected' | 'merged') => {
    try {
      await ApiClient.reviewSubmission(id, action, reviewRemarks || `Action: ${action}`);
      setReviewRemarks('');
      setSelectedSubId(null);
      loadData();
    } catch (err) {
      console.error('Review error:', err);
    }
  };

  const handleUpdateRule = async (ruleId: string, currentVal: any, isEnabled: boolean) => {
    try {
      await ApiClient.updateAutomationRule(ruleId, currentVal, !isEnabled);
      loadData();
    } catch (err) {
      console.error('Rule update error:', err);
    }
  };

  return (
    <div className="max-w-6xl mx-auto p-4 sm:p-6 space-y-6">
      {/* Top Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-3xl bg-white border border-surface-border shadow-sm">
        <div className="flex items-center space-x-3">
          <div className="w-12 h-12 rounded-2xl bg-brand-900 text-white flex items-center justify-center shadow-md">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-900">{t('admin_dashboard_title')}</h2>
            <p className="text-xs text-slate-500">
              India Public Transport Directory • Verification & Moderation Suite
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={loadData}
            className="p-2.5 rounded-xl border border-surface-border text-slate-600 hover:bg-surface-subtle transition flex items-center space-x-1.5 text-xs font-semibold"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
          <button
            onClick={onLogout}
            className="p-2.5 rounded-xl bg-red-50 text-red-700 hover:bg-red-100 transition flex items-center space-x-1.5 text-xs font-semibold"
          >
            <LogOut className="w-4 h-4" />
            <span>Sign Out</span>
          </button>
        </div>
      </div>

      {/* Admin Nav Tabs */}
      <div className="flex space-x-2 border-b border-surface-border pb-2 overflow-x-auto text-xs font-bold">
        <button
          onClick={() => setActiveTab('overview')}
          className={`py-2 px-4 rounded-xl transition flex items-center space-x-1.5 ${activeTab === 'overview' ? 'bg-brand-900 text-white shadow' : 'text-slate-600 hover:bg-surface-subtle'}`}
        >
          <Activity className="w-4 h-4" />
          <span>System Overview</span>
        </button>
        <button
          onClick={() => setActiveTab('submissions')}
          className={`py-2 px-4 rounded-xl transition flex items-center space-x-1.5 ${activeTab === 'submissions' ? 'bg-brand-900 text-white shadow' : 'text-slate-600 hover:bg-surface-subtle'}`}
        >
          <GitPullRequest className="w-4 h-4" />
          <span>Submissions Queue ({submissions.filter(s => s.status === 'pending_review').length})</span>
        </button>
        <button
          onClick={() => setActiveTab('claims')}
          className={`py-2 px-4 rounded-xl transition flex items-center space-x-1.5 ${activeTab === 'claims' ? 'bg-brand-900 text-white shadow' : 'text-slate-600 hover:bg-surface-subtle'}`}
        >
          <Briefcase className="w-4 h-4" />
          <span>Operator Claims ({claims.length})</span>
        </button>
        <button
          onClick={() => setActiveTab('rules')}
          className={`py-2 px-4 rounded-xl transition flex items-center space-x-1.5 ${activeTab === 'rules' ? 'bg-brand-900 text-white shadow' : 'text-slate-600 hover:bg-surface-subtle'}`}
        >
          <Sliders className="w-4 h-4" />
          <span>Automation Rules</span>
        </button>
        <button
          onClick={() => setActiveTab('audit')}
          className={`py-2 px-4 rounded-xl transition flex items-center space-x-1.5 ${activeTab === 'audit' ? 'bg-brand-900 text-white shadow' : 'text-slate-600 hover:bg-surface-subtle'}`}
        >
          <RotateCcw className="w-4 h-4" />
          <span>Audit Logs ({auditLogs.length})</span>
        </button>
      </div>

      {/* Tab 1: System Health Overview */}
      {activeTab === 'overview' && health && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="p-4 rounded-2xl bg-white border border-surface-border shadow-sm">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Total Places</span>
              <div className="text-2xl font-bold text-slate-900 mt-1">{health.totalPlaces}</div>
              <span className="text-[11px] text-emerald-600 font-semibold">Master Indian Directory</span>
            </div>
            <div className="p-4 rounded-2xl bg-white border border-surface-border shadow-sm">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Buses / Fleet</span>
              <div className="text-2xl font-bold text-slate-900 mt-1">{health.totalBuses}</div>
              <span className="text-[11px] text-slate-500">Separated from routes</span>
            </div>
            <div className="p-4 rounded-2xl bg-white border border-surface-border shadow-sm">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Active Routes</span>
              <div className="text-2xl font-bold text-slate-900 mt-1">{health.totalRoutes}</div>
              <span className="text-[11px] text-slate-500">{health.totalStops} sequenced stops</span>
            </div>
            <div className="p-4 rounded-2xl bg-white border border-surface-border shadow-sm">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Live GPS Sessions</span>
              <div className="text-2xl font-bold text-emerald-600 mt-1">{health.activeLiveSessions}</div>
              <span className="text-[11px] text-emerald-700 font-semibold">Anonymous passenger pings</span>
            </div>
          </div>

          <div className="p-5 rounded-3xl bg-white border border-surface-border shadow-sm space-y-3">
            <h3 className="font-bold text-slate-900 text-sm">Database & Platform Status</h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              <div className="p-3 bg-surface-subtle rounded-xl border border-surface-border">
                <span className="text-slate-500">Database Engine:</span>
                <p className="font-semibold text-slate-900">PostgreSQL / PostGIS & In-Memory Store</p>
              </div>
              <div className="p-3 bg-surface-subtle rounded-xl border border-surface-border">
                <span className="text-slate-500">Uptime:</span>
                <p className="font-semibold text-slate-900">{Math.floor(health.uptimeSeconds / 60)} minutes</p>
              </div>
              <div className="p-3 bg-surface-subtle rounded-xl border border-surface-border">
                <span className="text-slate-500">Last Transport Seed Sync:</span>
                <p className="font-semibold text-slate-900">{new Date(health.lastImportTimestamp).toLocaleDateString()}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: Community Submissions Queue */}
      {activeTab === 'submissions' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-sm font-bold text-slate-900">
              {t('admin_queue_title')} ({submissions.length})
            </h3>
            <span className="text-xs text-slate-500">Evidence-based verification</span>
          </div>

          {submissions.length === 0 ? (
            <div className="p-8 text-center bg-white rounded-3xl border border-surface-border text-slate-500 text-xs">
              No submissions currently in queue.
            </div>
          ) : (
            <div className="space-y-3">
              {submissions.map(sub => (
                <div
                  key={sub.id}
                  className="p-5 rounded-3xl bg-white border border-surface-border shadow-sm space-y-3"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="flex items-center space-x-2">
                      <span className="px-2.5 py-1 rounded-full bg-brand-50 text-brand-900 font-mono font-bold text-xs border border-brand-200">
                        {sub.id}
                      </span>
                      <span className="font-bold text-slate-900 text-xs capitalize">
                        {sub.submissionType.replace('_', ' ')}
                      </span>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${sub.status === 'pending_review' ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'}`}>
                        {sub.status.replace('_', ' ')}
                      </span>
                    </div>
                    <span className="text-[11px] text-slate-400">
                      {new Date(sub.submittedAt).toLocaleString()}
                    </span>
                  </div>

                  {/* Proposed Data Inspector */}
                  <div className="p-3 bg-surface-subtle rounded-2xl border border-surface-border text-xs font-mono">
                    <pre className="whitespace-pre-wrap text-slate-700">
                      {JSON.stringify(sub.proposedData, null, 2)}
                    </pre>
                  </div>

                  {sub.contributorNotes && (
                    <p className="text-xs text-slate-600 italic">
                      Contributor Note: "{sub.contributorNotes}"
                    </p>
                  )}

                  {/* Actions */}
                  {sub.status === 'pending_review' && (
                    <div className="pt-2 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2">
                      <input
                        type="text"
                        placeholder="Admin review notes (optional)..."
                        value={selectedSubId === sub.id ? reviewRemarks : ''}
                        onChange={e => {
                          setSelectedSubId(sub.id);
                          setReviewRemarks(e.target.value);
                        }}
                        className="px-3 py-1.5 rounded-xl border border-surface-border text-xs focus:ring-2 focus:ring-brand-900 focus:outline-none flex-1"
                      />
                      <div className="flex space-x-2">
                        <button
                          onClick={() => handleReview(sub.id, 'approved')}
                          className="px-3.5 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-semibold text-xs transition flex items-center space-x-1"
                        >
                          <CheckCircle className="w-3.5 h-3.5" />
                          <span>{t('btn_approve')}</span>
                        </button>
                        <button
                          onClick={() => handleReview(sub.id, 'rejected')}
                          className="px-3.5 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white font-semibold text-xs transition flex items-center space-x-1"
                        >
                          <XCircle className="w-3.5 h-3.5" />
                          <span>{t('btn_reject')}</span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tab: Operator Claims */}
      {activeTab === 'claims' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-sm font-bold text-slate-900">
              Bus Operator & Fleet Claims ({claims.length})
            </h3>
            <span className="text-xs text-slate-500">Official verification queue</span>
          </div>

          {claims.length === 0 ? (
            <div className="p-8 text-center bg-white rounded-3xl border border-surface-border text-slate-500 text-xs">
              No operator claims currently submitted.
            </div>
          ) : (
            <div className="space-y-3">
              {claims.map((claim: any) => (
                <div
                  key={claim.id}
                  className="p-5 rounded-3xl bg-white border border-surface-border shadow-sm space-y-2 text-xs"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <span className="px-2.5 py-0.5 rounded-full bg-brand-50 text-brand-900 font-mono font-bold">
                        {claim.id}
                      </span>
                      <span className="font-bold text-slate-900">{claim.claimantName}</span>
                      <span className="text-slate-500">({claim.claimantDesignation})</span>
                    </div>
                    <span className="text-[11px] px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 font-semibold capitalize">
                      {claim.status.replace('_', ' ')}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-slate-600 bg-surface-subtle p-3 rounded-xl border border-surface-border">
                    <div><b>Operator ID:</b> {claim.operatorId}</div>
                    <div><b>Phone:</b> {claim.officialPhone}</div>
                    <div><b>Email:</b> {claim.officialEmail}</div>
                    <div><b>Submitted:</b> {new Date(claim.submittedAt).toLocaleDateString()}</div>
                  </div>

                  {claim.supportingDocumentsNote && (
                    <p className="text-slate-600 italic">Notes: "{claim.supportingDocumentsNote}"</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tab 3: Automation Rules */}
      {activeTab === 'rules' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-sm font-bold text-slate-900">{t('admin_rules_title')}</h3>
            <span className="text-xs text-slate-500">Configurable backend rules engine</span>
          </div>

          <div className="space-y-3">
            {rules.map(rule => (
              <div
                key={rule.id}
                className="p-5 rounded-3xl bg-white border border-surface-border shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4"
              >
                <div className="space-y-1">
                  <div className="flex items-center space-x-2">
                    <h4 className="font-bold text-slate-900 text-xs">{rule.name}</h4>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-700 uppercase">
                      {rule.category}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500">{rule.description}</p>
                </div>

                <div className="flex items-center space-x-3 shrink-0">
                  <div className="text-xs font-mono font-bold bg-surface-subtle px-3 py-1.5 rounded-xl border border-surface-border">
                    Value: {JSON.stringify(rule.thresholdValue)}
                  </div>
                  <button
                    onClick={() => handleUpdateRule(rule.id, rule.thresholdValue, rule.isEnabled)}
                    className={`px-3 py-1.5 rounded-xl font-semibold text-xs transition ${rule.isEnabled ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-600'}`}
                  >
                    {rule.isEnabled ? 'Active' : 'Disabled'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab 4: Audit Logs */}
      {activeTab === 'audit' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-sm font-bold text-slate-900">{t('admin_audit_title')}</h3>
            <span className="text-xs text-slate-500">Immutable provenance records</span>
          </div>

          <div className="space-y-2">
            {auditLogs.map(log => (
              <div
                key={log.id}
                className="p-4 rounded-2xl bg-white border border-surface-border shadow-sm text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2"
              >
                <div>
                  <div className="flex items-center space-x-2 font-semibold text-slate-900">
                    <span className="capitalize px-2 py-0.5 rounded-full bg-slate-100 text-[10px]">
                      {log.action}
                    </span>
                    <span>{log.entityType.toUpperCase()} ({log.entityId})</span>
                  </div>
                  <p className="text-slate-500 text-[11px] mt-1">{log.reason}</p>
                </div>
                <div className="text-right text-[11px] text-slate-400">
                  <div>By: {log.performedBy}</div>
                  <div>{new Date(log.timestamp).toLocaleTimeString()}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
