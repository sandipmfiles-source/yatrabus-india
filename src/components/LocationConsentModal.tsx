import React from 'react';
import { useLanguage } from '../context/LanguageContext.js';
import { useTracking } from '../context/TrackingContext.js';
import { ShieldCheck, MapPin, X } from 'lucide-react';

export const LocationConsentModal: React.FC = () => {
  const { isConsentModalOpen, pendingBusForTracking, grantConsentAndStartTracking, declineConsent } = useTracking();
  const { t } = useLanguage();

  if (!isConsentModalOpen || !pendingBusForTracking) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-elevated border border-yatriwarm-200">
        <div className="flex items-center justify-between pb-3 border-b border-yatriwarm-200">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-yatribrand-50 flex items-center justify-center text-yatribrand-800">
              <MapPin className="w-4 h-4" />
            </div>
            <h3 className="text-base font-semibold text-yatriwarm-900">{t('consent_title')}</h3>
          </div>
          <button
            onClick={declineConsent}
            className="text-yatriwarm-400 hover:text-yatriwarm-700 p-1 rounded-lg"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="mt-4 space-y-3 text-sm text-yatriwarm-700">
          <p className="font-medium text-yatriwarm-900">
            {t('tracking_bus_confirmed')} <span className="text-yatribrand-900 font-semibold">{pendingBusForTracking.routeNumber || 'Selected Bus'}</span>
          </p>

          <p className="leading-relaxed bg-yatriwarm-50 p-3 rounded-xl border border-yatriwarm-200 text-xs">
            {t('tracking_consent_message')}
          </p>

          <div className="space-y-2 pt-1 text-xs">
            <div className="flex items-start gap-2">
              <ShieldCheck className="w-4 h-4 text-yatribrand-700 shrink-0 mt-0.5" />
              <span><strong>{t('privacy_preserved')}:</strong> {t('tracking_privacy_detail')}</span>
            </div>
            <div className="flex items-start gap-2">
              <ShieldCheck className="w-4 h-4 text-yatribrand-700 shrink-0 mt-0.5" />
              <span><strong>{t('tracking_expiry_detail')}</strong></span>
            </div>
          </div>
            <p className="text-[11px] text-yatriwarm-500">{t('tracking_background_note')}</p>
          </div>
        </div>

        <div className="mt-6 flex flex-col gap-2">
          <button
            type="button"
            onClick={grantConsentAndStartTracking}
            className="w-full py-2.5 px-4 bg-yatribrand-900 hover:bg-yatribrand-950 text-white font-medium text-sm rounded-xl shadow-subtle transition-colors flex items-center justify-center gap-2"
          >
            <MapPin className="w-4 h-4 text-emerald-400" />
            {t('tracking_enable_button')}
          </button>

          <button
            type="button"
            onClick={declineConsent}
            className="w-full py-2 px-4 bg-yatriwarm-100 hover:bg-yatriwarm-200 text-yatriwarm-700 font-medium text-sm rounded-xl transition-colors"
          >
            {t('tracking_not_now')}
          </button>
        </div>
      </div>
    </div>
  );
};
