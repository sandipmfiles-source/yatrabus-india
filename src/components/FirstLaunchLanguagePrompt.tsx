import React from 'react';
import { useLanguage } from '../context/LanguageContext.js';

export const FirstLaunchLanguagePrompt: React.FC = () => {
  const { isLanguagePromptOpen, setLanguage, supportedLanguages } = useLanguage();

  if (!isLanguagePromptOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-signal-charcoal-950/80 backdrop-blur-sm p-4" role="dialog" aria-modal="true" aria-labelledby="language-welcome-title">
      <section className="w-full max-w-md rounded-3xl border border-signal-yellow-200 bg-white p-6 shadow-2xl">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-signal-yellow-100 text-signal-charcoal-900 text-2xl" aria-hidden="true">🌐</div>
        <p className="text-center text-xs font-bold uppercase tracking-[0.18em] text-red-700">YatriBus India</p>
        <h1 id="language-welcome-title" className="mt-2 text-center text-2xl font-extrabold text-signal-charcoal-950">Choose your language</h1>
        <p className="mt-1 text-center text-sm text-signal-charcoal-600">अपनी भाषा चुनें · আপনার ভাষা নির্বাচন করুন</p>
        <div className="mt-6 space-y-3">
          {supportedLanguages.map(lang => (
            <button
              key={lang.code}
              type="button"
              onClick={() => setLanguage(lang.code)}
              className="flex w-full items-center justify-between rounded-2xl border border-signal-charcoal-200 bg-signal-yellow-50 px-4 py-4 text-left transition hover:border-red-500 hover:bg-signal-yellow-100 focus:outline-none focus:ring-2 focus:ring-red-500"
            >
              <span>
                <span className="block text-base font-bold text-signal-charcoal-950">{lang.nativeName}</span>
                <span className="block text-xs text-signal-charcoal-600">{lang.label}</span>
              </span>
              <span className="text-xs font-bold text-red-700">Select →</span>
            </button>
          ))}
        </div>
        <p className="mt-5 text-center text-[11px] text-signal-charcoal-500">You can change your language anytime from the top menu.</p>
      </section>
    </div>
  );
};
