import React, { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AutomationRule } from '@shared/types/admin.js';
import { api } from '../../services/api.js';
import { ArrowLeft, Info, Save, Lock } from 'lucide-react';

export const AdminAutomationPage: React.FC = () => {
  const navigate = useNavigate();
  const [rules, setRules] = useState<AutomationRule[]>([]);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [loading, setLoading] = useState(true);
  const [savingRuleId, setSavingRuleId] = useState('');

  const loadRules = useCallback(async () => {
    const token = localStorage.getItem('yatribus_admin_token');
    if (!token) { navigate('/admin'); return; }
    try {
      const data = await api.adminGetAutomationRules(token);
      setRules(data.rules || []);
      setError('');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to load automation rules.');
    } finally {
      setLoading(false);
    }
  }, [navigate]);

  useEffect(() => { void loadRules(); }, [loadRules]);

  const setRuleEnabled = (ruleId: string, isEnabled: boolean) => {
    setRules(current => current.map(rule => rule.id === ruleId ? { ...rule, isEnabled } : rule));
    setNotice('');
  };

  const setRuleParameter = (ruleId: string, key: keyof AutomationRule['parameters'], value: number) => {
    setRules(current => current.map(rule => rule.id === ruleId
      ? { ...rule, parameters: { ...rule.parameters, [key]: value } }
      : rule));
    setNotice('');
  };

  const saveRule = async (rule: AutomationRule) => {
    const token = localStorage.getItem('yatribus_admin_token');
    if (!token) { navigate('/admin'); return; }
    setSavingRuleId(rule.id);
    setError('');
    setNotice('');
    try {
      await api.adminUpdateAutomationRule(token, rule.id, rule.isEnabled, rule.parameters);
      await loadRules();
      setNotice(`${rule.name} saved. Runtime settings are now active.`);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to save automation rule.');
    } finally {
      setSavingRuleId('');
    }
  };

  const numericField = (
    rule: AutomationRule,
    key: keyof AutomationRule['parameters'],
    label: string,
    value: number,
    min: number,
    max: number,
    step = 1
  ) => (
    <label className="block space-y-1 text-xs text-yatriwarm-700">
      <span className="font-semibold">{label}</span>
      <input
        type="number"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={event => setRuleParameter(rule.id, key, Number(event.target.value))}
        className="w-full rounded-xl border border-yatriwarm-200 bg-yatriwarm-50 px-3 py-2 text-sm text-yatriwarm-900 focus:border-yatribrand-700 focus:outline-none focus:ring-2 focus:ring-yatribrand-100"
      />
      <span className="text-[10px] text-yatriwarm-400">Allowed: {min}–{max}{step < 1 ? ' (decimal)' : ''}</span>
    </label>
  );

  const renderRuleControls = (rule: AutomationRule) => {
    if (rule.ruleCode === 'GPS_FRESHNESS_MONITOR') {
      return (
        <div className="grid gap-3 sm:grid-cols-2">
          {numericField(rule, 'gpsFreshnessLiveSeconds', 'LIVE GPS threshold (seconds)', rule.parameters.gpsFreshnessLiveSeconds ?? 120, 30, 300)}
          {numericField(rule, 'gpsFreshnessStaleSeconds', 'STALE threshold (seconds)', rule.parameters.gpsFreshnessStaleSeconds ?? 600, 30, 1800)}
        </div>
      );
    }
    if (rule.ruleCode === 'SESSION_SAFETY_EXPIRY') {
      return (
        <div className="max-w-xs">
          {numericField(rule, 'maxJourneySessionHours', 'Maximum journey session (hours)', rule.parameters.maxJourneySessionHours ?? 12, 1, 12)}
          <p className="mt-2 text-[10px] text-yatriwarm-500">Hard platform limit: 12 hours. This setting can shorten, never extend, the safety limit.</p>
        </div>
      );
    }
    if (rule.ruleCode === 'DUPLICATE_STOP_SCANNER') {
      return (
        <div className="grid gap-3 sm:grid-cols-2">
          {numericField(rule, 'duplicateMaxDistanceMeters', 'Nearby stop radius (metres)', rule.parameters.duplicateMaxDistanceMeters ?? 150, 25, 400)}
          {numericField(rule, 'duplicateSimilarityThreshold', 'Name similarity threshold', rule.parameters.duplicateSimilarityThreshold ?? 0.65, 0.5, 0.99, 0.01)}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
      <div className="flex items-center gap-3">
        <Link to="/admin/dashboard" className="p-2 rounded-xl bg-white hover:bg-yatriwarm-100 border border-yatriwarm-200 text-yatriwarm-700 transition-colors shadow-subtle">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-xl font-bold text-yatriwarm-950">Backend Automation Rules</h1>
          <p className="text-xs text-yatriwarm-500">Super Admin controls for runtime-backed safety rules.</p>
        </div>
      </div>

      <div role="note" className="p-4 rounded-2xl border border-blue-200 bg-blue-50 text-blue-900 text-xs flex gap-3">
        <Info className="w-5 h-5 shrink-0" />
        <span>
          <strong>Safety policy:</strong> GPS freshness, journey-session expiry and duplicate-stop detection are enforced by the backend. Duplicate checks run when a stop is submitted and only create review candidates. Timetable changes are never auto-published; they always require Super Admin approval.
        </span>
      </div>

      {error && <div role="alert" className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-800">{error}</div>}
      {notice && <div role="status" className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800">{notice}</div>}

      {loading ? <p className="text-xs text-yatriwarm-500">Loading backend rules…</p> : (
        <div className="space-y-4">
          {rules.map(rule => {
            const isPublishRule = rule.ruleCode === 'AUTO_PUBLISH_MINOR_TIMETABLE';
            const canEdit = ['GPS_FRESHNESS_MONITOR', 'SESSION_SAFETY_EXPIRY', 'DUPLICATE_STOP_SCANNER'].includes(rule.ruleCode);
            return (
              <section key={rule.id} className="bg-white rounded-3xl p-5 sm:p-6 border border-yatriwarm-200 shadow-card space-y-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-bold text-yatriwarm-900">{rule.name}</span>
                      <span className="font-mono text-[10px] bg-yatriwarm-100 text-yatriwarm-600 px-2 py-0.5 rounded">{rule.ruleCode}</span>
                    </div>
                    <p className="text-xs text-yatriwarm-600 max-w-lg">{rule.description}</p>
                  </div>
                  {isPublishRule ? (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-amber-200 bg-amber-50 text-amber-800 text-[11px] font-semibold">
                      <Lock className="w-3 h-3" /> Locked OFF
                    </span>
                  ) : (
                    <label className="inline-flex items-center gap-2 text-xs font-semibold text-yatriwarm-700">
                      <input
                        type="checkbox"
                        checked={rule.isEnabled}
                        onChange={event => setRuleEnabled(rule.id, event.target.checked)}
                        className="h-4 w-4 accent-emerald-700"
                      />
                      {rule.isEnabled ? 'Enabled' : 'Disabled'}
                    </label>
                  )}
                </div>

                {canEdit ? renderRuleControls(rule) : (
                  <p className="text-xs text-yatriwarm-600">Automatic timetable publishing is disabled by platform policy. All schedule changes stay pending until the Super Admin reviews them.</p>
                )}

                {canEdit && (
                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={() => void saveRule(rule)}
                      disabled={savingRuleId === rule.id}
                      className="inline-flex items-center gap-2 rounded-xl bg-yatribrand-900 px-4 py-2.5 text-xs font-bold text-white hover:bg-yatribrand-950 disabled:opacity-50"
                    >
                      <Save className="w-4 h-4" />
                      {savingRuleId === rule.id ? 'Saving…' : 'Save runtime settings'}
                    </button>
                  </div>
                )}
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default AdminAutomationPage;
