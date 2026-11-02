import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../services/api.js';
import { useLanguage } from '../context/LanguageContext.js';
import { ArrowLeft, Search, MapPin, Building2, BusFront, ExternalLink, ShieldCheck, AlertTriangle } from 'lucide-react';

type Catalogue = {
  summary: { states: number; unionTerritories: number; administrativeUnits: number; governmentOperatorDirectoryEntries: number; pilotTownIndexEntries: number; pilotBusTerminals: number; lgdIndexRecords: number; lgdUrbanLocalBodies: number; lgdSnapshotDate: string };
  lgdIndex: { snapshotDate: string; districts: number; subdistricts: number; blocks: number; urbanLocalBodies: number; totalRecords: number };
  states: Array<{ name: string; capital: string; aliases: string[]; region: string; capitalNote?: string; officialReference: string }>;
  unionTerritories: Array<{ name: string; capital: string; aliases: string[]; region: string; capitalNote?: string; officialReference: string }>;
  operators: Array<{ id: string; name: string; shortCode: string; serviceArea: string; officialWebsite?: string; sourceUrl?: string; directoryStatus: string }>;
  pilotCorridor: { name: string; state: string; towns: Array<{ id: string; name: string; district?: string; verificationStatus: string }>; terminals: Array<{ id: string; name: string; district?: string; sourceUrl?: string; sourceSnapshotDate?: string; verificationStatus: string }>; historicalServiceEvidence: { operator: string; sourceName: string; sourceUrl: string; sourceDate: string; serviceDates: string[]; direction: string; listedTimes: Array<{ stop: string; arrival?: string; departure?: string }>; status: string; warning: string }; timetableStatus: string; liveGpsStatus: string; note: string; officialOperatorReferences: Array<{ name: string; url: string }> };
};

const labels = {
  en: { title: 'India Transit Directory', subtitle: 'States, Union Territories, government bus operators and the West Bengal pilot corridor.', states: 'States', uts: 'Union Territories', operators: 'Government operators', search: 'Search state, UT or operator…', statesHeading: '28 States', utsHeading: '8 Union Territories', operatorHeading: 'Government bus operators', pilot: 'Pilot corridor', noMatch: 'No matching directory entries.', notVerified: 'Directory listing · Not an authenticated operator profile', sources: 'Official references', noTimetable: 'Timetable unavailable', noGps: 'Live GPS unavailable', unverifiedTown: 'Town reference · Needs source reconciliation', dataPolicy: 'Data quality policy', loading: 'Loading India directory…', lgd: 'LGD admin & town records (2022 snapshot)', terminals: 'WB bus terminals' },
  hi: { title: 'भारत परिवहन निर्देशिका', subtitle: 'राज्य, केंद्र शासित प्रदेश, सरकारी बस ऑपरेटर और पश्चिम बंगाल पायलट कॉरिडोर।', states: 'राज्य', uts: 'केंद्र शासित प्रदेश', operators: 'सरकारी ऑपरेटर', search: 'राज्य, केंद्र शासित प्रदेश या ऑपरेटर खोजें…', statesHeading: '28 राज्य', utsHeading: '8 केंद्र शासित प्रदेश', operatorHeading: 'सरकारी बस ऑपरेटर', pilot: 'पायलट कॉरिडोर', noMatch: 'कोई मिलती-जुलती प्रविष्टि नहीं मिली।', notVerified: 'डायरेक्टरी सूची · ऑपरेटर प्रोफ़ाइल प्रमाणित नहीं', sources: 'आधिकारिक संदर्भ', noTimetable: 'समय-सारणी उपलब्ध नहीं', noGps: 'लाइव GPS उपलब्ध नहीं', unverifiedTown: 'शहर संदर्भ · स्रोत मिलान बाकी', dataPolicy: 'डेटा गुणवत्ता नियम', loading: 'भारत निर्देशिका लोड हो रही है…', lgd: 'LGD प्रशासनिक और शहर रिकॉर्ड (2022 स्नैपशॉट)', terminals: 'पश्चिम बंगाल बस टर्मिनल' },
  bn: { title: 'ভারত পরিবহন নির্দেশিকা', subtitle: 'রাজ্য, কেন্দ্রশাসিত অঞ্চল, সরকারি বাস অপারেটর এবং পশ্চিমবঙ্গ পাইলট করিডর।', states: 'রাজ্য', uts: 'কেন্দ্রশাসিত অঞ্চল', operators: 'সরকারি অপারেটর', search: 'রাজ্য, কেন্দ্রশাসিত অঞ্চল বা অপারেটর খুঁজুন…', statesHeading: '২৮টি রাজ্য', utsHeading: '৮টি কেন্দ্রশাসিত অঞ্চল', operatorHeading: 'সরকারি বাস অপারেটর', pilot: 'পাইলট করিডর', noMatch: 'কোনও মিল পাওয়া যায়নি।', notVerified: 'ডিরেক্টরি তালিকা · অপারেটর প্রোফাইল যাচাই করা নয়', sources: 'সরকারি সূত্র', noTimetable: 'সময়সূচি উপলব্ধ নয়', noGps: 'লাইভ GPS উপলব্ধ নয়', unverifiedTown: 'শহরের তথ্য · উৎস যাচাই বাকি', dataPolicy: 'তথ্যের মান নীতি', loading: 'ভারত নির্দেশিকা লোড হচ্ছে…', lgd: 'LGD প্রশাসনিক ও শহর রেকর্ড (২০২২ স্ন্যাপশট)', terminals: 'পশ্চিমবঙ্গ বাস টার্মিনাল' },
};

export const IndiaDirectoryPage: React.FC = () => {
  const { language } = useLanguage();
  const t = labels[language] || labels.en;
  const [catalogue, setCatalogue] = useState<Catalogue | null>(null);
  const [query, setQuery] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    api.getIndiaCatalogue()
      .then(data => { if (active) { setCatalogue(data); setError(''); } })
      .catch(reason => { if (active) setError(reason instanceof Error ? reason.message : 'Unable to load directory.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  const needle = query.trim().toLocaleLowerCase();
  const states = useMemo(() => (catalogue?.states || []).filter(item => !needle || [item.name, item.capital, ...(item.aliases || [])].join(' ').toLocaleLowerCase().includes(needle)), [catalogue, needle]);
  const uts = useMemo(() => (catalogue?.unionTerritories || []).filter(item => !needle || [item.name, item.capital, ...(item.aliases || [])].join(' ').toLocaleLowerCase().includes(needle)), [catalogue, needle]);
  const operators = useMemo(() => (catalogue?.operators || []).filter(item => !needle || [item.name, item.shortCode, item.serviceArea].join(' ').toLocaleLowerCase().includes(needle)), [catalogue, needle]);

  return (
    <div className="max-w-6xl mx-auto px-4 py-7 sm:py-10 space-y-6">
      <div className="flex items-center gap-3">
        <Link to="/" className="p-2 rounded-xl bg-white border border-yatriwarm-200 text-yatriwarm-700"><ArrowLeft className="w-5 h-5" /></Link>
        <div><h1 className="text-xl sm:text-2xl font-extrabold text-yatriwarm-950">{t.title}</h1><p className="text-xs text-yatriwarm-500 mt-1">{t.subtitle}</p></div>
      </div>

      {catalogue && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {[
            [catalogue.summary.states, t.states],
            [catalogue.summary.unionTerritories, t.uts],
            [catalogue.summary.governmentOperatorDirectoryEntries, t.operators],
            [catalogue.summary.pilotTownIndexEntries, t.pilot],
            [catalogue.summary.pilotBusTerminals, t.terminals],
            [catalogue.summary.lgdIndexRecords.toLocaleString(), t.lgd],
          ].map(([value, label]) => <div key={String(label)} className="rounded-2xl border border-yatriwarm-200 bg-white p-4"><div className="text-2xl font-extrabold text-yatribrand-900">{value}</div><div className="text-[11px] text-yatriwarm-600">{label}</div></div>)}
        </div>
      )}

      <label className="relative block">
        <Search className="absolute left-3.5 top-3 w-4 h-4 text-yatriwarm-400" />
        <input value={query} onChange={event => setQuery(event.target.value)} placeholder={t.search} className="w-full rounded-xl border border-yatriwarm-200 bg-white py-2.5 pl-10 pr-4 text-sm outline-none focus:ring-2 focus:ring-yatribrand-700" />
      </label>

      {error && <div role="alert" className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900 flex gap-2"><AlertTriangle className="w-4 h-4 shrink-0" />{error}</div>}
      {loading && <p className="text-xs text-yatriwarm-500">{t.loading}</p>}

      {catalogue && (
        <>
          <p className="text-[10px] text-yatriwarm-500">LGD source snapshot: {catalogue.lgdIndex.snapshotDate} · {catalogue.lgdIndex.districts} districts · {catalogue.lgdIndex.subdistricts.toLocaleString()} sub-districts · {catalogue.lgdIndex.blocks.toLocaleString()} blocks · {catalogue.lgdIndex.urbanLocalBodies.toLocaleString()} urban local bodies. Current LGD changes may post-date this baseline.</p>
          <section className="space-y-3">
            <h2 className="text-base font-bold text-yatriwarm-950 flex items-center gap-2"><MapPin className="w-4 h-4" />{t.statesHeading}</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {states.map(item => <article key={item.name} className="rounded-2xl border border-yatriwarm-200 bg-white p-4">
                <div className="font-bold text-sm text-yatriwarm-900">{item.name}</div>
                <div className="text-xs text-yatriwarm-600 mt-1">Capital: {item.capital}</div>
                {item.capitalNote && <p className="text-[10px] text-yatriwarm-500 mt-1">{item.capitalNote}</p>}
                <div className="mt-2 flex items-center justify-between gap-2"><span className="text-[10px] uppercase tracking-wide text-yatriwarm-400">{item.region.replace('_', ' ')}</span><a href={item.officialReference} target="_blank" rel="noreferrer" className="text-[10px] text-yatribrand-800 inline-flex items-center gap-1">Government site <ExternalLink className="w-3 h-3" /></a></div>
              </article>)}
            </div>
          </section>

          <section className="space-y-3">
            <h2 className="text-base font-bold text-yatriwarm-950 flex items-center gap-2"><MapPin className="w-4 h-4" />{t.utsHeading}</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {uts.map(item => <article key={item.name} className="rounded-2xl border border-yatriwarm-200 bg-white p-4">
                <div className="font-bold text-sm text-yatriwarm-900">{item.name}</div>
                <div className="text-xs text-yatriwarm-600 mt-1">Capital: {item.capital}</div>
                {item.capitalNote && <p className="text-[10px] text-yatriwarm-500 mt-1">{item.capitalNote}</p>}
                <div className="mt-2 text-right"><a href={item.officialReference} target="_blank" rel="noreferrer" className="text-[10px] text-yatribrand-800 inline-flex items-center gap-1">Government site <ExternalLink className="w-3 h-3" /></a></div>
              </article>)}
            </div>
          </section>

          <section className="space-y-3">
            <h2 className="text-base font-bold text-yatriwarm-950 flex items-center gap-2"><Building2 className="w-4 h-4" />{t.operatorHeading}</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {operators.map(item => <article key={item.id} className="rounded-2xl border border-yatriwarm-200 bg-white p-4">
                <div className="flex items-start justify-between gap-2"><div><div className="font-bold text-sm text-yatriwarm-900">{item.name}</div><div className="text-[11px] text-yatriwarm-500 mt-1">{item.shortCode} · {item.serviceArea}</div></div><BusFront className="w-5 h-5 text-yatriwarm-400 shrink-0" /></div>
                <div className="mt-3 flex flex-wrap items-center justify-between gap-2"><span className="text-[10px] text-amber-800 bg-amber-50 rounded-full px-2 py-1">{t.notVerified}</span>{item.officialWebsite && <a href={item.officialWebsite} target="_blank" rel="noreferrer" className="text-[10px] text-yatribrand-800 inline-flex items-center gap-1">Official site <ExternalLink className="w-3 h-3" /></a>}</div>
              </article>)}
            </div>
          </section>

          <section className="rounded-3xl border border-yatriwarm-200 bg-white p-5 sm:p-6 space-y-4">
            <div><h2 className="text-base font-bold text-yatriwarm-950">{t.pilot}: {catalogue.pilotCorridor.name}</h2><p className="text-xs text-yatriwarm-500 mt-1">{catalogue.pilotCorridor.state}</p></div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {catalogue.pilotCorridor.towns.map(town => <div key={town.id} className="rounded-xl bg-yatriwarm-50 p-3"><div className="text-xs font-bold text-yatriwarm-900">{town.name}</div><div className="text-[10px] text-yatriwarm-500">{town.district}</div><div className="mt-1 text-[9px] text-amber-800">{t.unverifiedTown}</div></div>)}
            </div>
            <div>
              <h3 className="text-xs font-bold text-yatriwarm-900 mb-2">Official bus terminal references · Historical source (2017)</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {catalogue.pilotCorridor.terminals.map(terminal => <div key={terminal.id} className="rounded-xl border border-yatriwarm-100 p-3">
                  <div className="text-[11px] font-semibold text-yatriwarm-900">{terminal.name}</div>
                  <div className="text-[10px] text-yatriwarm-500">{terminal.district} · Source snapshot {terminal.sourceSnapshotDate} · Not recently verified</div>
                  {terminal.sourceUrl && <a href={terminal.sourceUrl} target="_blank" rel="noreferrer" className="text-[10px] text-yatribrand-800 underline">Government terminal directory</a>}
                </div>)}
              </div>
            </div>
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 space-y-2">
              <div className="text-xs font-bold text-amber-950">Historical corridor evidence — 2019 only (not a current timetable)</div>
              <span className="inline-flex rounded-full bg-amber-100 text-amber-950 px-2 py-1 text-[9px] font-bold">HISTORICAL_REFERENCE_ONLY</span>
              <p className="text-[10px] text-amber-900">{catalogue.pilotCorridor.historicalServiceEvidence.operator} · {catalogue.pilotCorridor.historicalServiceEvidence.sourceName} · {catalogue.pilotCorridor.historicalServiceEvidence.sourceDate}</p>
              <p className="text-[10px] text-amber-900">One-off service dates: {catalogue.pilotCorridor.historicalServiceEvidence.serviceDates.join(', ')}</p>
              <p className="text-[11px] font-semibold text-amber-950">{catalogue.pilotCorridor.historicalServiceEvidence.direction}</p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {catalogue.pilotCorridor.historicalServiceEvidence.listedTimes.map(item => <div key={item.stop} className="rounded-xl bg-white/70 p-2">
                  <div className="text-[10px] font-bold text-amber-950">{item.stop}</div>
                  <div className="text-[10px] text-amber-900">{item.arrival ? `Arr ${item.arrival}` : ''}{item.arrival && item.departure ? ' · ' : ''}{item.departure ? `Dep ${item.departure}` : ''}</div>
                </div>)}
              </div>
              <p className="text-[10px] text-amber-900">{catalogue.pilotCorridor.historicalServiceEvidence.warning}</p>
              <a href={catalogue.pilotCorridor.historicalServiceEvidence.sourceUrl} target="_blank" rel="noreferrer" className="text-[10px] font-semibold underline text-amber-950">Open archived SBSTC notice</a>
            </div>
            <div className="flex flex-wrap gap-2">
              <span className="rounded-full bg-amber-50 text-amber-900 px-3 py-1.5 text-[10px] font-semibold">{t.noTimetable}</span>
              <span className="rounded-full bg-slate-100 text-slate-700 px-3 py-1.5 text-[10px] font-semibold">{t.noGps}</span>
            </div>
            <p className="text-xs text-yatriwarm-700">{catalogue.pilotCorridor.note}</p>
            <div><h3 className="text-xs font-bold text-yatriwarm-900 mb-2">{t.sources}</h3><div className="flex flex-wrap gap-3">{catalogue.pilotCorridor.officialOperatorReferences.map(item => <a key={item.name} href={item.url} target="_blank" rel="noreferrer" className="text-[11px] text-yatribrand-800 underline">{item.name}</a>)}</div></div>
          </section>
        </>
      )}

      {catalogue && states.length + uts.length + operators.length === 0 && <p className="text-center text-xs text-yatriwarm-500 py-8">{t.noMatch}</p>}
      <div className="rounded-2xl bg-yatriwarm-50 border border-yatriwarm-100 p-4 text-xs text-yatriwarm-700"><div className="font-bold flex items-center gap-2 mb-2"><ShieldCheck className="w-4 h-4" />{t.dataPolicy}</div><ul className="list-disc pl-5 space-y-1"><li>Operator directory entries are not authenticated profiles.</li><li>Town references are not bus stops or proof of a scheduled service.</li><li>Every published timetable needs a source and verification date.</li><li>Live GPS requires fresh, consented observations; estimates are never labelled live.</li></ul></div>
    </div>
  );
};

export default IndiaDirectoryPage;
