import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { api } from '../services/api.js';
import { storage } from '../services/storage.js';
import { startNativeTracking, stopNativeTracking } from '../services/nativeTracking.js';

interface ActiveSessionData {
  sessionId: string;
  busId: string;
  routeId: string;
  routeNumber?: string;
  originName?: string;
  destinationName?: string;
  startedAt: string;
}

interface TrackingContextType {
  activeSession: ActiveSessionData | null;
  isConsentModalOpen: boolean;
  pendingBusForTracking: { busId: string; routeId: string; routeNumber?: string } | null;
  openConsentModalForBus: (bus: { busId: string; routeId: string; routeNumber?: string }) => void;
  closeConsentModal: () => void;
  grantConsentAndStartTracking: () => Promise<void>;
  declineConsent: () => void;
  stopSharing: () => Promise<void>;
  observationsCount: number;
  isBackgroundTrackingActive: boolean;
  trackingWarning: string;
}

const TrackingContext = createContext<TrackingContextType | undefined>(undefined);

export const TrackingProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [activeSession, setActiveSession] = useState<ActiveSessionData | null>(null);
  const [isConsentModalOpen, setIsConsentModalOpen] = useState(false);
  const [pendingBusForTracking, setPendingBus] = useState<{ busId: string; routeId: string; routeNumber?: string } | null>(null);
  const [observationsCount, setObservationsCount] = useState(0);
  const [isBackgroundTrackingActive, setIsBackgroundTrackingActive] = useState(false);
  const [trackingWarning, setTrackingWarning] = useState('');

  const watchIdRef = useRef<number | null>(null);

  // Restore active session from local storage on mount
  useEffect(() => {
    const saved = storage.getActiveSession();
    if (saved) {
      // Check 12-hour expiry
      const started = new Date(saved.startedAt).getTime();
      const now = Date.now();
      if (now - started < 12 * 3600 * 1000) {
        setActiveSession(saved);
        startNativeTracking(saved).then(setIsBackgroundTrackingActive).catch(error => setTrackingWarning(error?.message || 'Background tracking is not configured.'));
      } else {
        storage.clearActiveSession();
      }
    }
  }, []);

  // Periodic location updater when session is active
  useEffect(() => {
    if (!activeSession) {
      if (watchIdRef.current !== null) {
        navigator.geolocation?.clearWatch?.(watchIdRef.current);
        watchIdRef.current = null;
      }
      return;
    }

    if ('geolocation' in navigator) {
      const id = window.setInterval(() => {
        navigator.geolocation.getCurrentPosition(
          pos => {
            const { latitude, longitude, accuracy, speed, heading } = pos.coords;
            api.sendObservation({
              sessionId: activeSession.sessionId,
              busId: activeSession.busId,
              routeId: activeSession.routeId,
              latitude,
              longitude,
              accuracyMeters: accuracy,
              speedKmh: speed ? speed * 3.6 : undefined,
              headingDegrees: heading || undefined,
            });
            setObservationsCount(prev => prev + 1);
          },
          err => {
            // eslint-disable-next-line no-console
            console.warn('Geolocation observation error:', err.message);
          },
          { enableHighAccuracy: true, timeout: 10000, maximumAge: 10000 }
        );
      }, 25000);

      return () => clearInterval(id);
    }
  }, [activeSession]);

  const openConsentModalForBus = (bus: { busId: string; routeId: string; routeNumber?: string }) => {
    setPendingBus(bus);
    setIsConsentModalOpen(true);
  };

  const closeConsentModal = () => {
    setIsConsentModalOpen(false);
    setPendingBus(null);
  };

  const grantConsentAndStartTracking = async () => {
    if (!pendingBusForTracking) return;

    try {
      const res = await api.startJourneySession(pendingBusForTracking.busId, pendingBusForTracking.routeId);
      const session = res.session;

      await api.recordConsent(session.sessionId, 'GRANTED', true);

      const sessionData: ActiveSessionData = {
        sessionId: session.sessionId,
        busId: pendingBusForTracking.busId,
        routeId: pendingBusForTracking.routeId,
        routeNumber: pendingBusForTracking.routeNumber,
        startedAt: new Date().toISOString(),
      };

      setActiveSession(sessionData);
      storage.setActiveSession(sessionData);
      try {
        const started = await startNativeTracking({ sessionId: session.sessionId, busId: pendingBusForTracking.busId, routeId: pendingBusForTracking.routeId });
        setIsBackgroundTrackingActive(started);
        setTrackingWarning(started ? '' : 'Background GPS is available only in the Android app.');
      } catch (nativeError: any) {
        setIsBackgroundTrackingActive(false);
        setTrackingWarning(nativeError?.message || 'Background GPS could not start.');
        console.warn('Native background tracking could not start; foreground tracking remains available.', nativeError);
      }
      closeConsentModal();
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error('Failed to start tracking session', e);
    }
  };

  const declineConsent = () => {
    if (pendingBusForTracking) {
      storage.recordPromptDismissal(pendingBusForTracking.routeId);
    }
    closeConsentModal();
  };

  const stopSharing = async () => {
    try { await stopNativeTracking(); } catch (nativeError) { console.warn('Could not stop native tracking service', nativeError); }
    setIsBackgroundTrackingActive(false);
    setTrackingWarning('');
    if (activeSession) {
      await api.stopJourneySession(activeSession.sessionId, 'USER_STOPPED');
      storage.clearActiveSession();
      setActiveSession(null);
      setObservationsCount(0);
    }
  };

  return (
    <TrackingContext.Provider
      value={{
        activeSession,
        isConsentModalOpen,
        pendingBusForTracking,
        openConsentModalForBus,
        closeConsentModal,
        grantConsentAndStartTracking,
        declineConsent,
        stopSharing,
        observationsCount,
        isBackgroundTrackingActive,
        trackingWarning,
      }}
    >
      {children}
    </TrackingContext.Provider>
  );
};

export const useTracking = () => {
  const ctx = useContext(TrackingContext);
  if (!ctx) throw new Error('useTracking must be used within a TrackingProvider');
  return ctx;
};
