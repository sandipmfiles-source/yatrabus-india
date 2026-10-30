import React, { useEffect, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { Geolocation } from '@capacitor/geolocation';

const DISMISSED_KEY = 'yatribus_location_startup_prompt_dismissed';

export const StartupLocationPermission: React.FC = () => {
  const [visible, setVisible] = useState(false);
  const [requesting, setRequesting] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    if (localStorage.getItem(DISMISSED_KEY) === 'true') return;
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
        localStorage.setItem(DISMISSED_KEY, 'true');
        setVisible(false);
      } else {
        setMessage('Location permission was not granted. You can still search buses; live GPS needs permission.');
      }
    } catch {
      setMessage('Could not request location permission. Please check Android app permissions in Settings.');
    } finally {
      setRequesting(false);
    }
  };

  const notNow = () => {
    localStorage.setItem(DISMISSED_KEY, 'true');
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4" role="dialog" aria-modal="true" aria-labelledby="startup-location-title">
      <section className="w-full max-w-md rounded-3xl border border-amber-200 bg-white p-6 shadow-2xl">
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-100 text-2xl" aria-hidden="true">📍</div>
        <h2 id="startup-location-title" className="text-center text-xl font-extrabold text-slate-950">Allow location access?</h2>
        <p className="mt-2 text-center text-sm text-slate-700">स्थान की अनुमति दें · অবস্থানের অনুমতি দিন</p>
        <p className="mt-4 text-sm leading-relaxed text-slate-700">
          YatraBus uses your location to find nearby bus stops and, only when you separately confirm a journey, help share anonymous bus GPS updates. Location is not shared just by opening the app.
        </p>
        <p className="mt-2 text-xs text-slate-500">
          কাছের বাস স্টপ খুঁজতে অবস্থান দরকার। यात्रा शुरू करने और अलग से सहमति देने पर ही बस की GPS जानकारी साझा होगी।
        </p>
        {message && <p role="alert" className="mt-3 rounded-xl bg-amber-50 p-3 text-xs text-amber-900">{message}</p>}
        <div className="mt-5 flex flex-col gap-2">
          <button type="button" disabled={requesting} onClick={allowLocation} className="w-full rounded-xl bg-slate-950 px-4 py-3 text-sm font-bold text-white disabled:opacity-60">
            {requesting ? 'Requesting permission…' : 'Allow Location'}
          </button>
          <button type="button" onClick={notNow} className="w-full rounded-xl bg-slate-100 px-4 py-2.5 text-sm font-semibold text-slate-700">
            Not now
          </button>
        </div>
      </section>
    </div>
  );
};
