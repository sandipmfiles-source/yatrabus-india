import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { Capacitor, registerPlugin } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';
import { api } from '../services/api.js';
import { storage } from '../services/storage.js';

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
  trackingError: string;
}

const BackgroundGeolocation = registerPlugin<any>('BackgroundGeolocation');
const TrackingContext = createContext<TrackingContextType | undefined>(undefined);

export const TrackingProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [activeSession, setActiveSession] = useState<ActiveSessionData | null>(null);
  const [isConsentModalOpen, setIsConsentModalOpen] = useState(false);
  const [pendingBusForTracking, setPendingBus] = useState<{ busId: string; routeId: string; routeNumber?: string } | null>(null);
  const [observationsCount, setObservationsCount] = useState(0);
  const [trackingError, setTrackingError] = useState('');
  const nativeWatcherIdRef = useRef<string | null>(null);
  const webWatchIdRef = useRef<number | null>(null);

  useEffect(() => {
    const saved = storage.getActiveSession();
    if (!saved) return;
    const started = new Date(saved.startedAt).getTime();
    if (Number.isFinite(started) && Date.now() - started < 12 * 3600 * 1000) {
      setActiveSession(saved);
    } else {
      storage.clearActiveSession();
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    const sendLocation = (location: any) => {
      if (!location || !activeSession) return;
      const latitude = Number(location.latitude);
      const longitude = Number(location.longitude);
      const accuracyMeters = Number(location.accuracy);
      if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || !Number.isFinite(accuracyMeters)) return;
      void api.sendObservation({
        sessionId: activeSession.sessionId,
        busId: activeSession.busId,
        routeId: activeSession.routeId,
        latitude,
        longitude,
        accuracyMeters,
        speedKmh: Number.isFinite(location.speed) && location.speed !== null ? location.speed * 3.6 : undefined,
        headingDegrees: Number.isFinite(location.bearing) ? location.bearing : undefined,
      }).then(result => {
        if (result?.accepted) setObservationsCount(count => count + 1);
      });
    };

    if (!activeSession) {
      if (nativeWatcherIdRef.current) {
        void BackgroundGeolocation.removeWatcher({ id: nativeWatcherIdRef.current }).catch(() => undefined);
        nativeWatcherIdRef.current = null;
      }
      if (webWatchIdRef.current !== null && navigator.geolocation) {
        navigator.geolocation.clearWatch(webWatchIdRef.current);
        webWatchIdRef.current = null;
      }
      return;
    }

    if (Capacitor.isNativePlatform()) {
      BackgroundGeolocation.addWatcher(
        {
          backgroundMessage: 'YatriBus is sharing anonymous bus location. Tap Stop Sharing in the app to end.',
          backgroundTitle: 'YatriBus live bus tracking',
          requestPermissions: true,
          stale: false,
          distanceFilter: 50,
        },
        (location: any, error: any) => {
          if (error) {
            console.warn('Background location error:', error.message || error.code);
            return;
          }
          sendLocation(location);
        }
      ).then((watcherId: string) => {
        if (cancelled) {
          void BackgroundGeolocation.removeWatcher({ id: watcherId });
        } else {
          nativeWatcherIdRef.current = watcherId;
        }
      }).catch((error: unknown) => {
        console.error('Unable to start native background tracking:', error);
      });
    } else if (navigator.geolocation) {
      webWatchIdRef.current = navigator.geolocation.watchPosition(
        position => sendLocation({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
          speed: position.coords.speed,
          bearing: position.coords.heading,
        }),
        error => console.warn('Browser location error:', error.message),
        { enableHighAccuracy: true, maximumAge: 10000, timeout: 20000 }
      );
    }

    return () => {
      cancelled = true;
      if (nativeWatcherIdRef.current) {
        void BackgroundGeolocation.removeWatcher({ id: nativeWatcherIdRef.current }).catch(() => undefined);
        nativeWatcherIdRef.current = null;
      }
      if (webWatchIdRef.current !== null && navigator.geolocation) {
        navigator.geolocation.clearWatch(webWatchIdRef.current);
        webWatchIdRef.current = null;
      }
    };
  }, [activeSession]);

  const openConsentModalForBus = (bus: { busId: string; routeId: string; routeNumber?: string }) => {
    setPendingBus(bus);
    setIsConsentModalOpen(true);
  };

  const closeConsentModal = () => {
    setIsConsentModalOpen(false);
    setPendingBus(null);
    setTrackingError('');
  };

  const grantConsentAndStartTracking = async () => {
    if (!pendingBusForTracking) return;
    setTrackingError('');
    try {
      if (Capacitor.isNativePlatform()) {
        const apiBase = import.meta.env.VITE_API_BASE_URL?.replace(/\\/$/, '') || '';
        if (!apiBase || !/^https:\\/\\//i.test(apiBase)) {
          throw new Error('Live background GPS requires a deployed HTTPS backend. Configure VITE_API_BASE_URL and rebuild the APK before starting a tracked journey.');
        }
        try {
          await LocalNotifications.requestPermissions();
        } catch (permissionError) {
          console.warn('Notification permission was not granted; Android may limit visible tracking notices.', permissionError);
        }
      }
      const res = await api.startJourneySession(pendingBusForTracking.busId, pendingBusForTracking.routeId);
      const session = res.session;
      try {
        await api.recordConsent(session.sessionId, 'GRANTED', true);
      } catch (consentError) {
        await api.stopJourneySession(session.sessionId, 'USER_STOPPED');
        throw consentError;
      }
      const sessionData: ActiveSessionData = {
        sessionId: session.sessionId,
        busId: pendingBusForTracking.busId,
        routeId: pendingBusForTracking.routeId,
        routeNumber: pendingBusForTracking.routeNumber,
        startedAt: session.startTime || new Date().toISOString(),
      };
      setActiveSession(sessionData);
      storage.setActiveSession(sessionData);
      closeConsentModal();
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Live tracking could not start. Check your connection and try again.';
      setTrackingError(message);
      console.error('Failed to start tracking session', e);
    }
  };

  const declineConsent = () => {
    if (pendingBusForTracking) storage.recordPromptDismissal(pendingBusForTracking.routeId);
    closeConsentModal();
  };

  const stopSharing = async () => {
    if (!activeSession) return;
    await api.stopJourneySession(activeSession.sessionId, 'USER_STOPPED');
    storage.clearActiveSession();
    setActiveSession(null);
    setObservationsCount(0);
  };

  useEffect(() => {
    if (!activeSession) return;
    const startedAt = new Date(activeSession.startedAt).getTime();
    if (!Number.isFinite(startedAt)) {
      storage.clearActiveSession();
      setActiveSession(null);
      return;
    }
    const expiresAt = startedAt + 12 * 60 * 60 * 1000;
    const timeoutId = window.setTimeout(() => { void stopSharing(); }, Math.max(0, expiresAt - Date.now()));
    return () => window.clearTimeout(timeoutId);
  }, [activeSession]);

  return (
    <TrackingContext.Provider value={{
      activeSession, isConsentModalOpen, pendingBusForTracking, openConsentModalForBus,
      closeConsentModal, grantConsentAndStartTracking, declineConsent, stopSharing, observationsCount, trackingError,
    }}>
      {children}
    </TrackingContext.Provider>
  );
};

export const useTracking = () => {
  const ctx = useContext(TrackingContext);
  if (!ctx) throw new Error('useTracking must be used within a TrackingProvider');
  return ctx;
};
