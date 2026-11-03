import { LocalNotifications } from '@capacitor/local-notifications';
import type { Route } from '@shared/types/bus.js';

const FAVOURITES_KEY = 'yatribus_favourite_routes_v1';
const ACCESSIBILITY_KEY = 'yatribus_accessibility_v1';
const ALERTS_ENABLED_KEY = 'yatribus_live_alerts_enabled_v1';
const ALERT_HISTORY_KEY = 'yatribus_live_alert_history_v1';
const DB_NAME = 'yatribus-offline-v1';
const STORE_NAME = 'verified-routes';

export interface FavouriteRoute {
  routeId: string;
  routeName: string;
  origin: string;
  destination: string;
  savedAt: string;
}

export interface AccessibilityPreferences {
  textSize: 'normal' | 'large' | 'largest';
  highContrast: boolean;
  reducedMotion: boolean;
}

const DEFAULT_ACCESSIBILITY: AccessibilityPreferences = {
  textSize: 'normal', highContrast: false, reducedMotion: false,
};

function openOfflineDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') return reject(new Error('Offline storage is not supported in this browser.'));
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) db.createObjectStore(STORE_NAME, { keyPath: 'id' });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('Unable to open offline storage.'));
  });
}

export const phase4 = {
  getFavourites(): FavouriteRoute[] {
    try { return JSON.parse(localStorage.getItem(FAVOURITES_KEY) || '[]'); }
    catch { return []; }
  },

  isFavourite(routeId: string): boolean {
    return this.getFavourites().some(item => item.routeId === routeId);
  },

  toggleFavourite(route: Pick<Route, 'id' | 'routeName' | 'originStopName' | 'destinationStopName'>): boolean {
    const current = this.getFavourites();
    const exists = current.some(item => item.routeId === route.id);
    const next = exists
      ? current.filter(item => item.routeId !== route.id)
      : [{ routeId: route.id, routeName: route.routeName, origin: route.originStopName, destination: route.destinationStopName, savedAt: new Date().toISOString() }, ...current].slice(0, 100);
    localStorage.setItem(FAVOURITES_KEY, JSON.stringify(next));
    return !exists;
  },

  getAccessibility(): AccessibilityPreferences {
    try { return { ...DEFAULT_ACCESSIBILITY, ...JSON.parse(localStorage.getItem(ACCESSIBILITY_KEY) || '{}') }; }
    catch { return DEFAULT_ACCESSIBILITY; }
  },

  saveAccessibility(value: AccessibilityPreferences) {
    localStorage.setItem(ACCESSIBILITY_KEY, JSON.stringify(value));
    const root = document.documentElement;
    root.dataset.textSize = value.textSize;
    root.dataset.highContrast = String(value.highContrast);
    root.dataset.reducedMotion = String(value.reducedMotion);
  },

  applyAccessibility() { this.saveAccessibility(this.getAccessibility()); },

  async cacheVerifiedRoutes(routes: Route[]): Promise<number> {
    const eligible = routes.filter(route =>
      route.timetableDataStatus === 'SCHEDULED' &&
      Boolean(route.timetableSource?.trim()) &&
      /^https:\/\//i.test(route.timetableSourceUrl || '') &&
      Boolean(route.timetableVerifiedAt) &&
      Array.isArray(route.stops) && route.stops.length > 0
    );
    if (!eligible.length) return 0;
    const db = await openOfflineDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      eligible.forEach(route => store.put({ ...route, cachedAt: new Date().toISOString() }));
      tx.oncomplete = () => { db.close(); resolve(eligible.length); };
      tx.onerror = () => { db.close(); reject(tx.error || new Error('Offline cache write failed.')); };
    });
  },

  async getOfflineRoutes(): Promise<Route[]> {
    const db = await openOfflineDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const request = tx.objectStore(STORE_NAME).getAll();
      request.onsuccess = () => {
        db.close();
        resolve((request.result || []).filter((route: any) => route.timetableDataStatus === 'SCHEDULED' && route.timetableVerifiedAt && /^https:\\/\\//i.test(route.timetableSourceUrl || '') && route.timetableSource?.trim()));
      };
      request.onerror = () => { db.close(); reject(request.error || new Error('Offline cache read failed.')); };
    });
  },

  async scheduleFavouriteReminder(route: FavouriteRoute, at: Date): Promise<void> {
    if (!Number.isFinite(at.getTime()) || at.getTime() <= Date.now()) throw new Error('Reminder time must be in the future.');
    let permission = await LocalNotifications.checkPermissions();
    if (permission.display !== 'granted') permission = await LocalNotifications.requestPermissions();
    if (permission.display !== 'granted') throw new Error('Notification permission was not granted.');
    const id = Math.floor(Date.now() % 2147483000);
    await LocalNotifications.schedule({ notifications: [{
      id,
      title: 'YatraBus journey reminder',
      body: `Check the verified timetable for ${route.origin} to ${route.destination}.`,
      schedule: { at },
      extra: { routeId: route.routeId },
    }] });
  },

  alertsEnabled(): boolean {
    return localStorage.getItem(ALERTS_ENABLED_KEY) === 'true';
  },

  async enableLiveAlerts(): Promise<boolean> {
    let permission = await LocalNotifications.checkPermissions();
    if (permission.display !== 'granted') permission = await LocalNotifications.requestPermissions();
    const granted = permission.display === 'granted';
    localStorage.setItem(ALERTS_ENABLED_KEY, String(granted));
    return granted;
  },

  async notifyOnce(key: string, title: string, body: string): Promise<void> {
    if (!this.alertsEnabled()) return;
    let history: Record<string, number> = {};
    try { history = JSON.parse(localStorage.getItem(ALERT_HISTORY_KEY) || '{}'); } catch { history = {}; }
    const now = Date.now();
    if (history[key] && now - history[key] < 30 * 60 * 1000) return;
    const permission = await LocalNotifications.checkPermissions();
    if (permission.display !== 'granted') return;
    const id = Math.max(1, Math.floor(now % 2147483000));
    try {
      await LocalNotifications.schedule({ notifications: [{
        id, title, body, schedule: { at: new Date(now + 1000) }, extra: { alertKey: key },
      }] });
    } catch { return; }
    history[key] = now;
    for (const [savedKey, timestamp] of Object.entries(history)) {
      if (now - timestamp > 7 * 24 * 60 * 60 * 1000) delete history[savedKey];
    }
    localStorage.setItem(ALERT_HISTORY_KEY, JSON.stringify(history));
  },

  async cancelNotifications(): Promise<void> {
    const pending = await LocalNotifications.getPending();
    if (pending.notifications.length) {
      await LocalNotifications.cancel({ notifications: pending.notifications.map(item => ({ id: item.id })) });
    }
  },
};
