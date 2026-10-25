import React, { useState } from 'react';
import { useTracking } from '../context/TrackingContext.js';
import { useLanguage } from '../context/LanguageContext.js';
import { BusFront, Check, X, Clock } from 'lucide-react';

interface JourneyConfirmBannerProps {
  busId: string;
  routeId: string;
  routeNumber: string;
}

export const JourneyConfirmBanner: React.FC<JourneyConfirmBannerProps> = ({
  busId,
  routeId,
  routeNumber,
}) => {
  const { openConsentModalForBus, activeSession } = useTracking();
  const { t } = useLanguage();
  const [isDismissed, setIsDismissed] = useState(false);

  // If user is already tracking this bus or dismissed
  if (isDismissed || activeSession?.busId === busId) {
    return null;
  }

  return (
    <div className="bg-gradient-to-r from-yatribrand-50 to-emerald-50/50 border border-yatribrand-200 rounded-xl p-4 shadow-subtle mb-4">
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 rounded-full bg-yatribrand-800 text-white flex items-center justify-center shrink-0 shadow-xs">
          <BusFront className="w-5 h-5" />
        </div>
        <div className="flex-1">
          <h4 className="text-sm font-semibold text-yatriwarm-900">
            {t('journey_prompt_title')}
          </h4>
          <p className="text-xs text-yatriwarm-600 mt-0.5 leading-relaxed">
            {t('journey_prompt_desc')}
          </p>

          <div className="flex flex-wrap items-center gap-2 mt-3">
            <button
              type="button"
              onClick={() => openConsentModalForBus({ busId, routeId, routeNumber })}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-yatribrand-900 hover:bg-yatribrand-950 text-white text-xs font-medium rounded-lg shadow-xs transition-colors"
            >
              <Check className="w-3.5 h-3.5 text-emerald-400" />
              {t('journey_prompt_yes')}
            </button>

            <button
              type="button"
              onClick={() => setIsDismissed(true)}
              className="inline-flex items-center gap-1 px-3 py-1.5 bg-white hover:bg-yatriwarm-100 text-yatriwarm-700 text-xs font-medium rounded-lg border border-yatriwarm-200 transition-colors"
            >
              <X className="w-3.5 h-3.5" />
              {t('journey_prompt_no')}
            </button>

            <button
              type="button"
              onClick={() => setIsDismissed(true)}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 text-yatriwarm-500 hover:text-yatriwarm-800 text-xs font-medium"
            >
              <Clock className="w-3 h-3" />
              {t('journey_prompt_not_now')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
