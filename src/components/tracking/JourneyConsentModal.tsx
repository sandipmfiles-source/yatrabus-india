import React, { useState } from 'react';
import { Route, Bus } from '../../types';
import { ShieldCheck, MapPin, Navigation, X, Check, Clock, AlertCircle } from 'lucide-react';
import { t } from '../../i18n';

interface JourneyConsentModalProps {
  bus: Bus;
  route: Route;
  isOpen: boolean;
  onClose: () => void;
  onConfirmConsent: (consentGiven: boolean) => void;
}

export const JourneyConsentModal: React.FC<JourneyConsentModalProps> = ({
  bus,
  route,
  isOpen,
  onClose,
  onConfirmConsent
}) => {
  const [step, setStep] = useState<'confirm_journey' | 'consent_scope'>('confirm_journey');

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-md bg-white rounded-3xl p-6 shadow-2xl border border-surface-border text-slate-800 relative">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition"
          aria-label="Close"
        >
          <X className="w-5 h-5" />
        </button>

        {step === 'confirm_journey' ? (
          <div>
            {/* Header Icon */}
            <div className="w-12 h-12 rounded-2xl bg-brand-50 border border-brand-200 text-brand-900 flex items-center justify-center mb-4">
              <Navigation className="w-6 h-6 text-brand-900" />
            </div>

            <h3 className="text-xl font-bold text-slate-900">
              {t('prompt_travelling_title')}
            </h3>
            <p className="text-sm font-semibold text-brand-900 mt-1">
              {bus.name} • Route {route.routeNumber}
            </p>
            <p className="text-xs text-slate-500 mt-0.5">
              {route.originName} ➔ {route.destinationName}
            </p>

            <div className="my-5 p-3.5 rounded-2xl bg-surface-subtle border border-surface-border text-xs text-slate-600 space-y-2">
              <div className="flex items-start space-x-2">
                <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <p>{t('prompt_travelling_desc')}</p>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="space-y-2.5">
              <button
                onClick={() => setStep('consent_scope')}
                className="w-full py-3 px-4 rounded-xl font-semibold text-white bg-brand-900 hover:bg-brand-950 shadow-md transition flex items-center justify-center space-x-2"
              >
                <Check className="w-4 h-4" />
                <span>{t('btn_yes_travelling')}</span>
              </button>

              <button
                onClick={() => {
                  onConfirmConsent(false);
                  onClose();
                }}
                className="w-full py-2.5 px-4 rounded-xl font-medium text-slate-600 hover:bg-slate-100 transition"
              >
                {t('btn_not_now')}
              </button>
            </div>
          </div>
        ) : (
          <div>
            {/* Step 2: Location Consent Scope & Verification */}
            <div className="w-12 h-12 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-700 flex items-center justify-center mb-4">
              <ShieldCheck className="w-6 h-6" />
            </div>

            <h3 className="text-lg font-bold text-slate-900">
              Consent-Based Location Contribution
            </h3>

            <div className="mt-3 space-y-2.5 text-xs text-slate-600 leading-relaxed">
              <div className="p-3 bg-surface-subtle rounded-xl border border-surface-border">
                <p className="font-semibold text-slate-800">What we collect:</p>
                <p className="mt-0.5">
                  GPS coordinates and accuracy while you travel on this bus. Raw coordinates are converted into bus-level observations and never tied to your personal identity.
                </p>
              </div>

              <div className="p-3 bg-surface-subtle rounded-xl border border-surface-border">
                <p className="font-semibold text-slate-800">Safety & Expiry:</p>
                <p className="mt-0.5">
                  • You can stop sharing anytime using the visible control in the top bar.<br/>
                  • Automatic hard stop after your journey or maximum 12 hours.<br/>
                  • No account or phone number required.
                </p>
              </div>
            </div>

            <div className="mt-5 space-y-2">
              <button
                onClick={() => {
                  onConfirmConsent(true);
                  onClose();
                }}
                className="w-full py-3 px-4 rounded-xl font-semibold text-white bg-emerald-700 hover:bg-emerald-800 shadow-md transition flex items-center justify-center space-x-2"
              >
                <MapPin className="w-4 h-4" />
                <span>Enable Location & Start Sharing</span>
              </button>

              <button
                onClick={() => {
                  onConfirmConsent(false);
                  onClose();
                }}
                className="w-full py-2.5 px-4 rounded-xl font-medium text-slate-500 hover:bg-slate-100 transition"
              >
                Decline & Continue Without Location
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
