import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../../services/api.js';
import { ArrowLeft, FileArchive, Upload, ShieldCheck, AlertTriangle, CheckCircle2 } from 'lucide-react';

type Preview = {
  valid: boolean;
  stats?: { agencies: number; routes: number; trips: number; stops: number; calendars: number };
  errors?: string[];
  warnings?: string[];
  routeConflicts?: string[];
  operatorConflicts?: string[];
  reviewPolicy?: string;
};

export const AdminGtfsImportPage: React.FC = () => {
  const navigate = useNavigate();
  const [zipBase64, setZipBase64] = useState('');
  const [fileName, setFileName] = useState('');
  const [preview, setPreview] = useState<Preview | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const token = () => localStorage.getItem('yatribus_admin_token');

  const selectFile = (file?: File) => {
    setPreview(null); setConfirmed(false); setNotice(''); setError('');
    if (!file) { setZipBase64(''); setFileName(''); return; }
    if (!file.name.toLowerCase().endsWith('.zip')) { setError('Please select a GTFS ZIP archive.'); return; }
    if (file.size <= 0 || file.size > 10 * 1024 * 1024) { setError('GTFS ZIP must be between 1 byte and 10 MB.'); return; }
    const reader = new FileReader();
    reader.onerror = () => setError('Unable to read the selected ZIP file.');
    reader.onload = () => {
      const value = typeof reader.result === 'string' ? reader.result.split(',')[1] : '';
      if (!value) { setError('The selected ZIP file could not be encoded.'); return; }
      setZipBase64(value); setFileName(file.name);
    };
    reader.readAsDataURL(file);
  };

  const runPreview = async () => {
    const adminToken = token();
    if (!adminToken) { navigate('/admin'); return; }
    if (!zipBase64) { setError('Select a GTFS ZIP file first.'); return; }
    setBusy(true); setError(''); setNotice(''); setPreview(null);
    try {
      const result = await api.previewGtfsImport(adminToken, zipBase64);
      setPreview(result);
      if (!result.valid) setError('The feed has validation errors or conflicts. Nothing has been imported.');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'GTFS validation failed.');
    } finally { setBusy(false); }
  };

  const applyImport = async () => {
    const adminToken = token();
    if (!adminToken) { navigate('/admin'); return; }
    if (!preview?.valid || !confirmed || !zipBase64) return;
    setBusy(true); setError(''); setNotice('');
    try {
      const result = await api.applyGtfsImport(adminToken, zipBase64);
      setNotice(`Imported ${result.stats?.routes || 0} routes and ${result.stats?.trips || 0} trips. All records remain unverified pending official review.`);
      setPreview(null); setConfirmed(false); setZipBase64(''); setFileName('');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'GTFS import failed.');
    } finally { setBusy(false); }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
      <div className="flex items-center gap-3">
        <Link to="/admin/dashboard" className="p-2 rounded-xl bg-white border border-yatriwarm-200 text-yatriwarm-700"><ArrowLeft className="w-5 h-5" /></Link>
        <div>
          <h1 className="text-xl font-bold text-yatriwarm-950">GTFS Timetable Import</h1>
          <p className="text-xs text-yatriwarm-500">Import official static transit feeds into a review-only state.</p>
        </div>
      </div>

      <section className="rounded-3xl border border-yatriwarm-200 bg-white p-5 sm:p-6 space-y-4">
        <div className="flex gap-3 rounded-2xl border border-blue-200 bg-blue-50 p-4 text-xs text-blue-900">
          <ShieldCheck className="w-5 h-5 shrink-0" />
          <p><strong>Safe import:</strong> ZIP is parsed and validated before writing. Imported agencies are community-listed; routes and timetables stay UNVERIFIED. No bus registration, vehicle identity or live service is inferred from a GTFS trip.</p>
        </div>
        <label className="block space-y-2">
          <span className="text-xs font-semibold text-yatriwarm-800">GTFS static ZIP file (maximum 10 MB)</span>
          <input type="file" accept=".zip,application/zip" onChange={event => selectFile(event.target.files?.[0])}
            className="block w-full text-xs file:mr-3 file:rounded-xl file:border-0 file:bg-yatribrand-900 file:px-4 file:py-2.5 file:text-white file:font-semibold" />
        </label>
        {fileName && <p className="text-xs text-yatriwarm-600 flex items-center gap-2"><FileArchive className="w-4 h-4" />{fileName}</p>}
        <button type="button" onClick={() => void runPreview()} disabled={!zipBase64 || busy}
          className="inline-flex items-center gap-2 rounded-xl bg-yatribrand-900 px-4 py-2.5 text-xs font-bold text-white disabled:opacity-50">
          <Upload className="w-4 h-4" />{busy ? 'Validating…' : 'Validate GTFS Feed'}
        </button>
      </section>

      {error && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-800">{error}</div>}
      {notice && <div role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-800 flex gap-2"><CheckCircle2 className="w-4 h-4 shrink-0" />{notice}</div>}

      {preview && (
        <section className="rounded-3xl border border-yatriwarm-200 bg-white p-5 sm:p-6 space-y-4">
          <div className="flex items-center gap-2"><h2 className="text-base font-bold text-yatriwarm-900">Feed Validation Report</h2>
            {preview.valid ? <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-[10px] font-bold text-emerald-800">Ready for review-only import</span>
              : <span className="rounded-full bg-rose-100 px-2.5 py-1 text-[10px] font-bold text-rose-800">Blocked</span>}
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            {Object.entries(preview.stats || {}).map(([label, value]) => (
              <div key={label} className="rounded-xl bg-yatriwarm-50 p-3"><div className="text-lg font-bold text-yatriwarm-900">{value}</div><div className="text-[10px] uppercase text-yatriwarm-500">{label}</div></div>
            ))}
          </div>
          {!!preview.errors?.length && <div className="space-y-1"><h3 className="text-xs font-bold text-red-800 flex items-center gap-2"><AlertTriangle className="w-4 h-4" />Errors</h3>{preview.errors.map((item, i) => <p key={i} className="text-xs text-red-700">• {item}</p>)}</div>}
          {!!preview.warnings?.length && <div className="space-y-1"><h3 className="text-xs font-bold text-amber-800">Warnings to review</h3>{preview.warnings.map((item, i) => <p key={i} className="text-xs text-amber-800">• {item}</p>)}</div>}
          {!!preview.routeConflicts?.length && <p className="text-xs text-red-700">Existing route IDs: {preview.routeConflicts.join(', ')}</p>}
          {!!preview.operatorConflicts?.length && <p className="text-xs text-red-700">Existing operators: {preview.operatorConflicts.join(', ')}</p>}
          {preview.valid && (
            <div className="border-t border-yatriwarm-100 pt-4 space-y-3">
              <label className="flex items-start gap-2 text-xs text-yatriwarm-700">
                <input type="checkbox" checked={confirmed} onChange={event => setConfirmed(event.target.checked)} className="mt-0.5" />
                I have reviewed the feed and understand that imported timetable data is unverified until official source and service dates are checked.
              </label>
              <button type="button" onClick={() => void applyImport()} disabled={!confirmed || busy}
                className="rounded-xl bg-yatribrand-900 px-4 py-2.5 text-xs font-bold text-white disabled:opacity-50">
                {busy ? 'Importing…' : 'Import as Unverified Records'}
              </button>
            </div>
          )}
        </section>
      )}
    </div>
  );
};

export default AdminGtfsImportPage;
