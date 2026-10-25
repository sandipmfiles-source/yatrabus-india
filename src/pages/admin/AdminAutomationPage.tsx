import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { repository } from '../../../backend/src/db/repository.js';
import { AutomationRule } from '@shared/types/admin.js';
import { ArrowLeft, Sliders, ToggleLeft, ToggleRight, Check } from 'lucide-react';

export const AdminAutomationPage: React.FC = () => {
  const [rules, setRules] = useState<AutomationRule[]>([]);
  const [message, setMessage] = useState('');

  const loadRules = () => {
    setRules(repository.getAutomationRules());
  };

  useEffect(() => {
    loadRules();
  }, []);

  const handleToggle = (rule: AutomationRule) => {
    repository.updateAutomationRule(rule.id, !rule.isEnabled, rule.parameters);
    setMessage(`Rule "${rule.name}" ${!rule.isEnabled ? 'enabled' : 'disabled'}`);
    loadRules();
  };

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
          <h1 className="text-xl font-bold text-yatriwarm-950">Backend Automation & Freshness Rules</h1>
          <p className="text-xs text-yatriwarm-500">
            Internal rules engine controlling GPS freshness thresholds, timetable review triggers, and session timeouts.
          </p>
        </div>
      </div>

      {message && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 flex items-center justify-between">
          <span>{message}</span>
          <button onClick={() => setMessage('')} className="text-emerald-600 font-bold">×</button>
        </div>
      )}

      <div className="bg-white rounded-3xl p-6 border border-yatriwarm-200 shadow-card divide-y divide-yatriwarm-100">
        {rules.map(rule => (
          <div key={rule.id} className="py-4 first:pt-0 last:pb-0 flex items-start justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-yatriwarm-900">{rule.name}</span>
                <span className="font-mono text-[10px] bg-yatriwarm-100 text-yatriwarm-600 px-2 py-0.5 rounded">
                  {rule.ruleCode}
                </span>
              </div>
              <p className="text-xs text-yatriwarm-600 max-w-lg">
                {rule.description}
              </p>
              <div className="text-[11px] text-yatriwarm-400 font-mono mt-2">
                Parameters: {JSON.stringify(rule.parameters)}
              </div>
            </div>

            <button
              type="button"
              onClick={() => handleToggle(rule)}
              className={`p-1.5 rounded-xl border text-xs font-semibold flex items-center gap-1.5 transition-colors ${
                rule.isEnabled
                  ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                  : 'bg-yatriwarm-100 text-yatriwarm-500 border-yatriwarm-200'
              }`}
            >
              {rule.isEnabled ? (
                <>
                  <ToggleRight className="w-5 h-5 text-emerald-600" />
                  <span>Enabled</span>
                </>
              ) : (
                <>
                  <ToggleLeft className="w-5 h-5 text-yatriwarm-400" />
                  <span>Disabled</span>
                </>
              )}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};
