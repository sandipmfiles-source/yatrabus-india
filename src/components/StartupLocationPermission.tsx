import React, { useEffect, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { Geolocation } from '@capacitor/geolocation';
import { useLanguage } from '../context/LanguageContext.js';

export const StartupLocationPermission: React.FC = () => {
  const { t } = useLanguage();
  const [visible, setVisible] = useState(false);
  const [requesting, setRequesting] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    let mounted = true;
    Geolocation.checkPermissions()
      .then(result => {
        if (mounted && result.location !== 'granted') setVisible(true);
      })
      .catch(() => {
        if (mounted) setVisible(true);
      });
    return () => { mounted = false; };
  }, []);

  const allowLocation = async () => {
    setRequesting(true);
    setMessage('');
    try {
      const result = await Geolocation.requestPermissions();
      if (result.location === 'granted') {
        setVisible(false);
      } else {
        setMessage(t('location_permission_denied'));
      }
    } catch {
      setMessage(t('location_permission_error'));
    } finally {
      setRequesting(false);
    }
  };

  if (!visible) return null;

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4" role="dialog" aria-modal="true" aria-labelledby="startup-location-title">
      <section className="w-full max-w-md rounded-3xl border border-amber-200 bg-white p-6 shadow-2xl">
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-100 text-2xl" aria-hidden="true">📍</div>
        <h2 id="startup-location-title" className="text-center text-xl font-extrabold text-slate-950">{t('location_startup_title')}</h2>
        <p className="mt-4 text-sm leading-relaxed text-slate-700">{t('location_startup_description')}</p>
        <p className="mt-2 text-xs text-slate-500">
          {t('location_startup_privacy')}
        </p>
        {message && <p role="alert" className="mt-3 rounded-xl bg-amber-50 p-3 text-xs text-amber-900">{message}</p>}
        <div className="mt-5 flex flex-col gap-2">
          <button type="button" disabled={requesting} onClick={allowLocation} className="w-full rounded-xl bg-slate-950 px-4 py-3 text-sm font-bold text-white disabled:opacity-60">
            {requesting ? t('requesting_permission') : t('allow_location')}
          </button>
          <p className="text-center text-[11px] leading-relaxed text-slate-500">Location access is required to continue in the Android app. If permission was denied permanently, enable it in Android Settings → Apps → YatriBus → Permissions → Location.</p>
        </div>
      </section>
    </div>
  );
};
