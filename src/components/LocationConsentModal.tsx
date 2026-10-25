import React from 'react';
import { useTracking } from '../context/TrackingContext.js';
import { ShieldCheck, MapPin, X } from 'lucide-react';

export const LocationConsentModal: React.FC = () => {
  const { isConsentModalOpen, pendingBusForTracking, grantConsentAndStartTracking, declineConsent } = useTracking();

  if (!isConsentModalOpen || !pendingBusForTracking) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-elevated border border-yatriwarm-200">
        <div className="flex items-center justify-between pb-3 border-b border-yatriwarm-200">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-yatribrand-50 flex items-center justify-center text-yatribrand-800">
              <MapPin className="w-4 h-4" />
            </div>
            <h3 className="text-base font-semibold text-yatriwarm-900">Passenger Assisted Live Tracking</h3>
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
            Confirming journey on: <span className="text-yatribrand-900 font-semibold">{pendingBusForTracking.routeNumber || 'Selected Bus'}</span>
          </p>

          <p className="leading-relaxed bg-yatriwarm-50 p-3 rounded-xl border border-yatriwarm-200 text-xs">
            “Help other passengers find buses more reliably. With your explicit permission, your device can share anonymous location observations while you travel on this bus. You can continue using search without sharing your location.”
          </p>

          <div className="space-y-2 pt-1 text-xs">
            <div className="flex items-start gap-2">
              <ShieldCheck className="w-4 h-4 text-yatribrand-700 shrink-0 mt-0.5" />
              <span><strong>Privacy Preserving:</strong> Your location is aggregated at the bus level. Your personal movement history is never stored or published.</span>
            </div>
            <div className="flex items-start gap-2">
              <ShieldCheck className="w-4 h-4 text-yatribrand-700 shrink-0 mt-0.5" />
              <span><strong>Safety Limited:</strong> Session terminates automatically when you click stop or after max 12 hours.</span>
            </div>
          </div>
        </div>

        <div className="mt-6 flex flex-col gap-2">
          <button
            type="button"
            onClick={grantConsentAndStartTracking}
            className="w-full py-2.5 px-4 bg-yatribrand-900 hover:bg-yatribrand-950 text-white font-medium text-sm rounded-xl shadow-subtle transition-colors flex items-center justify-center gap-2"
          >
            <MapPin className="w-4 h-4 text-emerald-400" />
            Enable Location & Assist Passengers
          </button>

          <button
            type="button"
            onClick={declineConsent}
            className="w-full py-2 px-4 bg-yatriwarm-100 hover:bg-yatriwarm-200 text-yatriwarm-700 font-medium text-sm rounded-xl transition-colors"
          >
            Not Now (Keep Searching)
          </button>
        </div>
      </div>
    </div>
  );
};
