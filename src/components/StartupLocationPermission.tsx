import React, { useCallback, useEffect, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { Geolocation } from '@capacitor/geolocation';
import { useLanguage } from '../context/LanguageContext.js';

export const StartupLocationPermission: React.FC = () => {
  const { t } = useLanguage();
  const [visible, setVisible] = useState(() => Capacitor.isNativePlatform());
  const [requesting, setRequesting] = useState(false);
  const [message, setMessage] = useState('');

  const verifyLocationReady = useCallback(async (requestPermission: boolean) => {
    setRequesting(true);
    setMessage('');
    try {
      const permission = requestPermission
        ? await Geolocation.requestPermissions()
        : await Geolocation.checkPermissions();
      if (permission.location !== 'granted') {
        setVisible(true);
        setMessage(t('location_permission_denied'));
        return;
      }
      // A granted permission alone is not enough: the device Location switch
      // must also be enabled. A fresh fix works without mobile data when GPS is available.
      await Geolocation.getCurrentPosition({ enableHighAccuracy: true, timeout: 30000, maximumAge: 0 });
      setVisible(false);
      setMessage('');
    } catch {
      setVisible(true);
      setMessage(t('location_services_disabled'));
    } finally {
      setRequesting(false);
    }
  }, [t]);

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    void verifyLocationReady(false);
  }, [verifyLocationReady]);

  const allowLocation = () => {
    void verifyLocationReady(true);
  };

  if (!visible) return null;

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-signal-charcoal-950/90 backdrop-blur-sm p-4" role="dialog" aria-modal="true" aria-labelledby="startup-location-title">
      <section className="w-full max-w-md rounded-3xl border border-signal-yellow-200 bg-white p-6 shadow-2xl">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-signal-yellow-100 text-signal-charcoal-900 text-2xl" aria-hidden="true">📍</div>
        <p className="text-center text-xs font-bold uppercase tracking-[0.18em] text-red-700">YatriBus India</p>
        <h1 id="startup-location-title" className="mt-2 text-center text-2xl font-extrabold text-signal-charcoal-950">{t('location_startup_title')}</h1>
        <p className="mt-4 text-sm leading-relaxed text-signal-charcoal-700">{t('location_startup_description')}</p>
        <p className="mt-2 text-xs text-signal-charcoal-600">{t('location_startup_privacy')}</p>
        {message && <p role="alert" className="mt-3 rounded-xl bg-amber-50 p-3 text-xs text-amber-900">{message}</p>}
        <div className="mt-5 flex flex-col gap-2">
          <button type="button" disabled={requesting} onClick={allowLocation} className="w-full rounded-xl bg-signal-charcoal-950 px-4 py-3 text-sm font-bold text-white disabled:opacity-60">
            {requesting ? t('requesting_permission') : t('allow_location')}
          </button>
          <p className="text-center text-[11px] leading-relaxed text-signal-charcoal-500">{t('location_gate_instruction')}</p>
        </div>
      </section>
    </div>
  );
};
