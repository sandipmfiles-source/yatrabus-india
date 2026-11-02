import React, { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AutomationRule } from '@shared/types/admin.js';
import { api } from '../../services/api.js';
import { ArrowLeft, Info } from 'lucide-react';

export const AdminAutomationPage: React.FC = () => {
  const navigate = useNavigate();
  const [rules, setRules] = useState<AutomationRule[]>([]);
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

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
      <div className="flex items-center gap-3"><Link to="/admin/dashboard" className="p-2 rounded-xl bg-white hover:bg-yatriwarm-100 border border-yatriwarm-200 text-yatriwarm-700 transition-colors shadow-subtle"><ArrowLeft className="w-5 h-5" /></Link><div><h1 className="text-xl font-bold text-yatriwarm-950">Backend Automation Rule Registry</h1><p className="text-xs text-yatriwarm-500">Stored rule definitions and parameters for future runtime integration.</p></div></div>
      <div role="note" className="p-4 rounded-2xl border border-amber-200 bg-amber-50 text-amber-900 text-xs flex gap-3"><Info className="w-5 h-5 shrink-0" /><span><strong>Configuration-only at this stage.</strong> The backend stores these rule settings, but runtime enforcement does not yet read every toggle or parameter. They are shown read-only so the dashboard cannot imply that changing a switch changes live tracking or timetable behaviour.</span></div>
      {error && <div role="alert" className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-800">{error}</div>}
      {loading ? <p className="text-xs text-yatriwarm-500">Loading backend rules…</p> : <div className="bg-white rounded-3xl p-6 border border-yatriwarm-200 shadow-card divide-y divide-yatriwarm-100">
        {rules.map(rule => <div key={rule.id} className="py-4 first:pt-0 last:pb-0 flex items-start justify-between gap-4">
          <div className="space-y-1"><div className="flex flex-wrap items-center gap-2"><span className="text-sm font-bold text-yatriwarm-900">{rule.name}</span><span className="font-mono text-[10px] bg-yatriwarm-100 text-yatriwarm-600 px-2 py-0.5 rounded">{rule.ruleCode}</span></div><p className="text-xs text-yatriwarm-600 max-w-lg">{rule.description}</p><div className="text-[11px] text-yatriwarm-400 font-mono mt-2">Stored parameters: {JSON.stringify(rule.parameters)}</div></div>
          <span className={`shrink-0 px-2.5 py-1 rounded-lg border text-[11px] font-semibold ${rule.isEnabled ? 'bg-emerald-50 text-emerald-800 border-emerald-200' : 'bg-yatriwarm-100 text-yatriwarm-500 border-yatriwarm-200'}`}>{rule.isEnabled ? 'Stored: ON' : 'Stored: OFF'}</span>
        </div>)}
      </div>}
    </div>
  );
};
