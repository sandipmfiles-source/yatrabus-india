import { LanguageCode } from '@shared/i18n/index.js';

export interface RecentSearchItem {
  id: string;
  from: string;
  to: string;
  timestamp: string;
}

const STORAGE_KEYS = {
  RECENT_SEARCHES: 'yatribus_recent_searches',
  LANGUAGE: 'yatribus_preferred_lang',
  ACTIVE_SESSION: 'yatribus_active_journey_session',
  DISMISSED_PROMPTS: 'yatribus_dismissed_prompts',
};

export const storage = {
  getRecentSearches(): RecentSearchItem[] {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.RECENT_SEARCHES);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  },

  addRecentSearch(from: string, to: string) {
    if (!from || !to) return;
    try {
      const current = this.getRecentSearches().filter(
        item => !(item.from.toLowerCase() === from.toLowerCase() && item.to.toLowerCase() === to.toLowerCase())
      );
      current.unshift({
        id: `search-${Date.now()}`,
        from,
        to,
        timestamp: new Date().toISOString(),
      });
      localStorage.setItem(STORAGE_KEYS.RECENT_SEARCHES, JSON.stringify(current.slice(0, 5)));
    } catch {}
  },

  clearRecentSearches() {
    try {
      localStorage.removeItem(STORAGE_KEYS.RECENT_SEARCHES);
    } catch {}
  },

  hasLanguagePreference(): boolean {
    try {
      const lang = localStorage.getItem(STORAGE_KEYS.LANGUAGE);
      return lang === 'hi' || lang === 'bn' || lang === 'en';
    } catch {
      return false;
    }
  },

  getLanguage(): LanguageCode {
    try {
      const lang = localStorage.getItem(STORAGE_KEYS.LANGUAGE);
      if (lang === 'hi' || lang === 'bn' || lang === 'en') return lang;
      return 'en';
    } catch {
      return 'en';
    }
  },

  setLanguage(lang: LanguageCode) {
    try {
      localStorage.setItem(STORAGE_KEYS.LANGUAGE, lang);
    } catch {}
  },

  getActiveSession(): any | null {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.ACTIVE_SESSION);
      return data ? JSON.parse(data) : null;
    } catch {
      return null;
    }
  },

  setActiveSession(session: any) {
    try {
      localStorage.setItem(STORAGE_KEYS.ACTIVE_SESSION, JSON.stringify(session));
    } catch {}
  },

  clearActiveSession() {
    try {
      localStorage.removeItem(STORAGE_KEYS.ACTIVE_SESSION);
    } catch {}
  },

  recordPromptDismissal(routeId: string) {
    try {
      const record = JSON.parse(localStorage.getItem(STORAGE_KEYS.DISMISSED_PROMPTS) || '{}');
      record[routeId] = (record[routeId] || 0) + 1;
      localStorage.setItem(STORAGE_KEYS.DISMISSED_PROMPTS, JSON.stringify(record));
    } catch {}
  },

  getDismissedCount(routeId: string): number {
    try {
      const record = JSON.parse(localStorage.getItem(STORAGE_KEYS.DISMISSED_PROMPTS) || '{}');
      return record[routeId] || 0;
    } catch {
      return 0;
    }
  },
};
