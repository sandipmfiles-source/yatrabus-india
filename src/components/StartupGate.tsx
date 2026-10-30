import React, { useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { Geolocation } from '@capacitor/geolocation';
import { useLanguage } from '../context/LanguageContext.js';
import { Capacitor } from '@capacitor/core';
import { Geolocation } from '@capacitor/geolocation';
import { MapPin, Languages, Navigation, RefreshCw } from 'lucide-react';

const languageOptions = [
  { code: 'bn' as const, label: 'বাংলা', native: 'বাংলা' },
  { code: 'hi' as const, label: 'हिन्दी', native: 'हिन्दी' },
  { code: 'en' as const, label: 'English', native: 'English' },
];

export const StartupGate: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { language, setLanguage } = useLanguage();
  const [languageChosen, setLanguageChosen] = useState(() => {
    try { return localStorage.getItem('yatribus_language_selected') === 'true'; } catch { return false; }
  });
  const [locationReady, setLocationReady] = useState(false);
  const [checkingLocation, setCheckingLocation] = useState(false);
  const [locationError, setLocationError] = useState('');

  const chooseLanguage = (code: 'bn' | 'hi' | 'en') => {
    setLanguage(code);
    try { localStorage.setItem('yatribus_language_selected', 'true'); } catch {}
    setLanguageChosen(true);
  };

  const requestLocation = async () => {
    setCheckingLocation(true);
    setLocationError('');
    try {
      // Android permission dialog is requested directly by the native plugin,
      // so this step does not depend on mobile data or Wi-Fi.
      if (Capacitor.isNativePlatform()) {
        const permissions = await Geolocation.requestPermissions();
        if (permissions.location !== 'granted' && permissions.coarseLocation !== 'granted') {
          throw new Error('PERMISSION_DENIED');
        }
      }
      await Geolocation.getCurrentPosition({ enableHighAccuracy: true, timeout: 30000, maximumAge: 0 });
      setLocationReady(true);
    } catch (error: any) {
      const denied = error?.message === 'PERMISSION_DENIED' || String(error?.message || '').toLowerCase().includes('permission');
      const message = language === 'hi'
        ? (denied ? 'ऐप चलाने के लिए Location permission दें।' : 'फोन की Location/GPS चालू करें और खुले स्थान पर फिर कोशिश करें। इंटरनेट के बिना भी GPS काम कर सकता है।')
        : language === 'bn'
        ? (denied ? 'অ্যাপ চালাতে লোকেশন অনুমতি দিন।' : 'ফোনের Location/GPS চালু করে খোলা জায়গায় আবার চেষ্টা করুন। ইন্টারনেট ছাড়াও GPS কাজ করতে পারে।')
        : (denied ? 'Allow Location permission to use YatriBus.' : 'Turn on Location/GPS and try again in an open area. GPS can work without internet.');
      setLocationError(message);
    } finally {
      setCheckingLocation(false);
    }
  };

  if (!languageChosen) {
    return <div className="min-h-screen bg-yatriwarm-50 flex items-center justify-center p-5">
      <section className="w-full max-w-md rounded-3xl bg-white border border-yatriwarm-200 shadow-elevated p-7 text-center">
        <div className="mx-auto mb-4 w-14 h-14 rounded-2xl bg-yatribrand-100 text-yatribrand-900 flex items-center justify-center"><Languages className="w-7 h-7" /></div>
        <h1 className="text-2xl font-extrabold text-yatriwarm-950">YatriBus</h1>
        <p className="mt-2 text-sm text-yatriwarm-600">Choose your language / भाषा चुनें / ভাষা বেছে নিন</p>
        <div className="mt-6 grid gap-3">
          {languageOptions.map(option => <button key={option.code} onClick={() => chooseLanguage(option.code)} className="w-full rounded-xl border border-yatriwarm-200 bg-yatriwarm-50 hover:bg-yatribrand-50 hover:border-yatribrand-400 p-4 text-lg font-bold text-yatriwarm-900">{option.native}</button>)}
        </div>
      </section>
    </div>;
  }

  if (!locationReady) {
    const copy = language === 'hi'
      ? { title: 'Location चालू करें', desc: 'YatriBus को आपके आसपास के बस स्टॉप और सही रूट दिखाने के लिए Location permission और GPS चाहिए।', action: 'Location अनुमति दें और आगे बढ़ें', retry: 'फिर कोशिश करें' }
      : language === 'bn'
      ? { title: 'Location চালু করুন', desc: 'কাছের বাস স্টপ ও সঠিক রুট দেখাতে YatriBus-এর Location অনুমতি এবং GPS প্রয়োজন।', action: 'লোকেশন অনুমতি দিন ও এগিয়ে যান', retry: 'আবার চেষ্টা করুন' }
      : { title: 'Turn on Location', desc: 'YatriBus needs Location permission and GPS to show nearby stops and accurate route information.', action: 'Allow Location & Continue', retry: 'Try again' };
    return <div className="min-h-screen bg-yatriwarm-50 flex items-center justify-center p-5">
      <section className="w-full max-w-md rounded-3xl bg-white border border-yatriwarm-200 shadow-elevated p-7 text-center">
        <div className="mx-auto mb-4 w-14 h-14 rounded-2xl bg-yatribrand-100 text-yatribrand-900 flex items-center justify-center"><MapPin className="w-7 h-7" /></div>
        <h1 className="text-xl font-extrabold text-yatriwarm-950">{copy.title}</h1>
        <p className="mt-3 text-sm leading-relaxed text-yatriwarm-600">{copy.desc}</p>
        <p className="mt-3 text-xs text-yatriwarm-500">GPS permission can be requested offline. Internet is needed for online maps and server updates.</p>
        {locationError && <p role="alert" className="mt-4 rounded-xl bg-red-50 border border-red-200 p-3 text-xs text-red-800">{locationError}</p>}
        <button onClick={requestLocation} disabled={checkingLocation} className="mt-6 w-full rounded-xl bg-yatribrand-900 hover:bg-yatribrand-800 disabled:opacity-60 text-white font-bold p-3 flex items-center justify-center gap-2">
          {checkingLocation ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Navigation className="w-4 h-4" />}
          {locationError ? copy.retry : copy.action}
        </button>
      </section>
    </div>;
  }

  return <>{children}</>;
};  const requestLocation = async () => {
    setCheckingLocation(true);
    setLocationError('');
    try {
      if (Capacitor.isNativePlatform()) {
        const permissions = await Geolocation.requestPermissions();
        const granted = permissions.location === 'granted' || permissions.coarseLocation === 'granted';
        if (!granted) {
          throw new Error(language === 'hi' ? 'ऐप चलाने के लिए Location permission दें।' : language === 'bn' ? 'অ্যাপ চালাতে লোকেশন অনুমতি দিন।' : 'Allow location permission to use YatriBus.');
        }
        await Geolocation.getCurrentPosition({ enableHighAccuracy: true, timeout: 20000, maximumAge: 0 });
      } else {
        if (!navigator.geolocation) throw new Error(language === 'hi' ? 'इस डिवाइस पर लोकेशन उपलब्ध नहीं है।' : language === 'bn' ? 'এই ডিভাইসে লোকেশন পাওয়া যাচ্ছে না।' : 'Location is not available on this device.');
        await new Promise<GeolocationPosition>((resolve, reject) => navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 }));
      }
      setLocationReady(true);
    } catch (error: any) {
      const denied = error?.code === 1 || String(error?.message || '').toLowerCase().includes('permission');
      const message = denied
        ? (language === 'hi' ? 'ऐप चलाने के लिए Location permission दें।' : language === 'bn' ? 'অ্যাপ চালাতে লোকেশন অনুমতি দিন।' : 'Allow location permission to use YatriBus.')
        : (language === 'hi' ? 'फोन की Location/GPS चालू करके फिर कोशिश करें। इंटरनेट न होने पर भी GPS permission दी जा सकती है।' : language === 'bn' ? 'ফোনের Location/GPS চালু করে আবার চেষ্টা করুন। ইন্টারনেট না থাকলেও GPS অনুমতি দেওয়া যায়।' : 'Turn on Location/GPS and try again. GPS permission can be granted even without internet.');
      setLocationError(error?.message && !denied ? message : message);
    } finally {
      setCheckingLocation(false);
    }
  };

  if (!languageChosen) {
    return <div className="min-h-screen bg-yatriwarm-50 flex items-center justify-center p-5">
      <section className="w-full max-w-md rounded-3xl bg-white border border-yatriwarm-200 shadow-elevated p-7 text-center">
        <div className="mx-auto mb-4 w-14 h-14 rounded-2xl bg-yatribrand-100 text-yatribrand-900 flex items-center justify-center"><Languages className="w-7 h-7" /></div>
        <h1 className="text-2xl font-extrabold text-yatriwarm-950">YatriBus</h1>
        <p className="mt-2 text-sm text-yatriwarm-600">Choose your language / भाषा चुनें / ভাষা বেছে নিন</p>
        <div className="mt-6 grid gap-3">
          {languageOptions.map(option => <button key={option.code} onClick={() => chooseLanguage(option.code)} className="w-full rounded-xl border border-yatriwarm-200 bg-yatriwarm-50 hover:bg-yatribrand-50 hover:border-yatribrand-400 p-4 text-lg font-bold text-yatriwarm-900">{option.native}</button>)}
        </div>
      </section>
    </div>;
  }

  if (!locationReady) {
    const copy = language === 'hi'
      ? { title: 'Location चालू करें', desc: 'YatriBus को आपके आसपास के बस स्टॉप और सही रूट दिखाने के लिए Location permission और GPS चाहिए।', action: 'Location अनुमति दें और आगे बढ़ें', retry: 'फिर कोशिश करें' }
      : language === 'bn'
      ? { title: 'Location চালু করুন', desc: 'কাছের বাস স্টপ ও সঠিক রুট দেখাতে YatriBus-এর Location অনুমতি এবং GPS প্রয়োজন।', action: 'লোকেশন অনুমতি দিন ও এগিয়ে যান', retry: 'আবার চেষ্টা করুন' }
      : { title: 'Turn on Location', desc: 'YatriBus needs Location permission and GPS to show nearby stops and accurate route information.', action: 'Allow Location & Continue', retry: 'Try again' };
    return <div className="min-h-screen bg-yatriwarm-50 flex items-center justify-center p-5">
      <section className="w-full max-w-md rounded-3xl bg-white border border-yatriwarm-200 shadow-elevated p-7 text-center">
        <div className="mx-auto mb-4 w-14 h-14 rounded-2xl bg-yatribrand-100 text-yatribrand-900 flex items-center justify-center"><MapPin className="w-7 h-7" /></div>
        <h1 className="text-xl font-extrabold text-yatriwarm-950">{copy.title}</h1>
        <p className="mt-3 text-sm leading-relaxed text-yatriwarm-600">{copy.desc}</p>
        <p className="mt-3 text-xs text-yatriwarm-500">GPS permission can be requested offline. Internet is needed for online maps and server updates.</p>
        {locationError && <p role="alert" className="mt-4 rounded-xl bg-red-50 border border-red-200 p-3 text-xs text-red-800">{locationError}</p>}
        <button onClick={requestLocation} disabled={checkingLocation} className="mt-6 w-full rounded-xl bg-yatribrand-900 hover:bg-yatribrand-800 disabled:opacity-60 text-white font-bold p-3 flex items-center justify-center gap-2">
          {checkingLocation ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Navigation className="w-4 h-4" />}
          {locationError ? copy.retry : copy.action}
        </button>
      </section>
    </div>;
  }

  return <>{children}</>;
};
