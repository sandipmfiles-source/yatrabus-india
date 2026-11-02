import React, { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AutomationRule } from '@shared/types/admin.js';
import { api } from '../../services/api.js';
import { ArrowLeft, ToggleLeft, ToggleRight } from 'lucide-react';

export const AdminAutomationPage: React.FC = () => {
  const navigate = useNavigate();
  const [rules, setRules] = useState<AutomationRule[]>([]);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const loadRules = useCallback(async () => {
    const token = localStorage.getItem('yatribus_admin_token');
    if (!token) { navigate('/admin'); return; }
    try { const data = await api.adminGetAutomationRules(token); setRules(data.rules || []); setError(''); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Unable to load automation rules.'); }
    finally { setLoading(false); }
  }, [navigate]);
  useEffect(() => { void loadRules(); }, [loadRules]);

  const handleToggle = async (rule: AutomationRule) => {
    const token = localStorage.getItem('yatribus_admin_token');
    if (!token) { navigate('/admin'); return; }
    try {
      await api.adminUpdateAutomationRule(token, rule.id, !rule.isEnabled, rule.parameters);
      setMessage(`Rule "${rule.name}" ${!rule.isEnabled ? 'enabled' : 'disabled'}`);
      await loadRules();
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Unable to update rule.'); }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
      <div className="flex items-center gap-3"><Link to="/admin/dashboard" className="p-2 rounded-xl bg-white hover:bg-yatriwarm-100 border border-yatriwarm-200 text-yatriwarm-700 transition-colors shadow-subtle"><ArrowLeft className="w-5 h-5" /></Link><div><h1 className="text-xl font-bold text-yatriwarm-950">Backend Automation & Freshness Rules</h1><p className="text-xs text-yatriwarm-500">Control backend GPS freshness, timetable review triggers, duplicate checks and session safety.</p></div></div>
      {message && <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800">{message}</div>}
      {error && <div role="alert" className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-800">{error}</div>}
      {loading ? <p className="text-xs text-yatriwarm-500">Loading backend rules…</p> : <div className="bg-white rounded-3xl p-6 border border-yatriwarm-200 shadow-card divide-y divide-yatriwarm-100">
        {rules.map(rule => <div key={rule.id} className="py-4 first:pt-0 last:pb-0 flex items-start justify-between gap-4">
          <div className="space-y-1"><div className="flex items-center gap-2"><span className="text-sm font-bold text-yatriwarm-900">{rule.name}</span><span className="font-mono text-[10px] bg-yatriwarm-100 text-yatriwarm-600 px-2 py-0.5 rounded">{rule.ruleCode}</span></div><p className="text-xs text-yatriwarm-600 max-w-lg">{rule.description}</p><div className="text-[11px] text-yatriwarm-400 font-mono mt-2">Parameters: {JSON.stringify(rule.parameters)}</div></div>
          <button type="button" onClick={() => void handleToggle(rule)} className={`p-1.5 rounded-xl border text-xs font-semibold flex items-center gap-1.5 transition-colors ${rule.isEnabled ? 'bg-emerald-50 text-emerald-800 border-emerald-300' : 'bg-yatriwarm-100 text-yatriwarm-500 border-yatriwarm-200'}`}>
            {rule.isEnabled ? <><ToggleRight className="w-5 h-5 text-emerald-600" /><span>Enabled</span></> : <><ToggleLeft className="w-5 h-5 text-yatriwarm-400" /><span>Disabled</span></>}
          </button>
        </div>)}
      </div>}
    </div>
  );
};
