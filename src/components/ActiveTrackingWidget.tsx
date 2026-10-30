import React from 'react';
import { useTracking } from '../context/TrackingContext.js';
import { useLanguage } from '../context/LanguageContext.js';
import { Radio, StopCircle } from 'lucide-react';

export const ActiveTrackingWidget: React.FC = () => {
  const { activeSession, stopSharing, observationsCount, isBackgroundTrackingActive, trackingWarning } = useTracking();
  const { t } = useLanguage();

  if (!activeSession) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 sm:left-auto sm:right-6 sm:w-96 z-40 bg-yatribrand-900 text-white rounded-2xl p-3.5 shadow-elevated border border-yatribrand-700 backdrop-blur-md animate-in slide-in-from-bottom duration-300">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="relative flex items-center justify-center w-8 h-8 rounded-full bg-emerald-500/20 text-emerald-400">
            <Radio className="w-4 h-4 animate-pulse" />
            <span className="absolute w-2.5 h-2.5 rounded-full bg-emerald-400 -top-0.5 -right-0.5 live-pulse-badge"></span>
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-bold text-white tracking-wide">
                {isBackgroundTrackingActive ? t('tracking_active') : t('tracking_service_not_active')}: {activeSession.routeNumber || 'Bus'}
              </span>
            </div>
            <p className="text-[11px] text-emerald-200/80">
              {isBackgroundTrackingActive ? `${observationsCount} ${t('tracking_updates_sent')} • ${t('privacy_preserved')}` : trackingWarning || t('tracking_waiting_for_gps')}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={stopSharing}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-rose-600/90 hover:bg-rose-600 text-white text-xs font-semibold rounded-xl transition-colors shadow-xs"
          title={t('tracking_stop_title')}
        >
          <StopCircle className="w-3.5 h-3.5" />
          {t('tracking_stop')}
        </button>
      </div>
    </div>
  );
};
