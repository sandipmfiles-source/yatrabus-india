import React, { useEffect, useState } from 'react';
import { phase4, AccessibilityPreferences } from '../services/phase4.js';

export const AccessibilitySettingsPage: React.FC = () => {
  const [settings, setSettings] = useState<AccessibilityPreferences>(() => phase4.getAccessibility());
  const [saved, setSaved] = useState(false);
  useEffect(() => { phase4.applyAccessibility(); }, []);
  const update = (next: Partial<AccessibilityPreferences>) => { setSettings(current => ({ ...current, ...next })); setSaved(false); };
  const save = () => { phase4.saveAccessibility(settings); setSaved(true); };
  return <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">
    <h1 className="text-2xl font-extrabold">Accessibility settings</h1>
    <p className="text-sm text-yatriwarm-600">These preferences are stored locally on this device.</p>
    <section className="rounded-2xl border bg-white p-5 space-y-4">
      <div><label htmlFor="yb-text-size" className="block text-sm font-bold mb-2">Text size</label><select id="yb-text-size" value={settings.textSize} onChange={e => update({ textSize: e.target.value as AccessibilityPreferences['textSize'] })} className="w-full rounded-xl border p-3"><option value="normal">Normal</option><option value="large">Large</option><option value="largest">Largest</option></select></div>
      <label className="flex items-center gap-3 text-sm"><input type="checkbox" checked={settings.highContrast} onChange={e => update({ highContrast: e.target.checked })}/> High contrast</label>
      <label className="flex items-center gap-3 text-sm"><input type="checkbox" checked={settings.reducedMotion} onChange={e => update({ reducedMotion: e.target.checked })}/> Reduce animation and motion</label>
      <button onClick={save} className="rounded-xl bg-yatribrand-900 px-4 py-3 text-sm font-bold text-white">Save accessibility settings</button>
      {saved && <p role="status" className="text-sm text-emerald-700">Accessibility settings saved.</p>}
    </section>
    <p className="text-xs text-yatriwarm-600">YatraBus keeps visible keyboard focus and semantic controls. Screen-reader output depends on your device and browser accessibility services.</p>
  </div>;
};
