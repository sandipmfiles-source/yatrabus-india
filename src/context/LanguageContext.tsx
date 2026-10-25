import React, { createContext, useContext, useState, useEffect } from 'react';
import { LanguageCode, getTranslation, SUPPORTED_LANGUAGES } from '@shared/i18n/index.js';
import { storage } from '../services/storage.js';
import { en } from '@shared/i18n/en.js';

interface LanguageContextType {
  language: LanguageCode;
  setLanguage: (lang: LanguageCode) => void;
  t: (key: keyof typeof en) => string;
  supportedLanguages: typeof SUPPORTED_LANGUAGES;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [language, setLangState] = useState<LanguageCode>('en');

  useEffect(() => {
    const saved = storage.getLanguage();
    setLangState(saved);
  }, []);

  const setLanguage = (lang: LanguageCode) => {
    setLangState(lang);
    storage.setLanguage(lang);
  };

  const t = (key: keyof typeof en) => {
    return getTranslation(language, key);
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t, supportedLanguages: SUPPORTED_LANGUAGES }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error('useLanguage must be used within a LanguageProvider');
  return ctx;
};
