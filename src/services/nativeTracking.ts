import { Capacitor, registerPlugin } from '@capacitor/core';

interface BackgroundTrackingPlugin {
  start(options: { sessionId: string; busId: string; routeId: string; apiBase: string; startedAtMs: number }): Promise<void>;
  stop(): Promise<void>;
}

const BackgroundTracking = registerPlugin<BackgroundTrackingPlugin>('BackgroundTracking');

export async function startNativeTracking(session: { sessionId: string; busId: string; routeId: string; startedAt?: string }): Promise<boolean> {
  if (!Capacitor.isNativePlatform()) return false;
  const apiBase = import.meta.env.VITE_API_BASE_URL?.replace(/\/$/, '');
  if (!apiBase) {
    throw new Error('Background GPS requires VITE_API_BASE_URL pointing to the deployed YatriBus backend.');
  }
  if (!/^https:\/\//i.test(apiBase)) {
    throw new Error('Background GPS requires an HTTPS backend URL for secure location uploads.');
  }
  await BackgroundTracking.start({ sessionId: session.sessionId, busId: session.busId, routeId: session.routeId, apiBase, startedAtMs: session.startedAt ? Date.parse(session.startedAt) : Date.now() });
  return true;
}

export async function stopNativeTracking(): Promise<void> {
  if (Capacitor.isNativePlatform()) await BackgroundTracking.stop();
}
