import { en } from './en.js';
import { hi } from './hi.js';
import { bn } from './bn.js';

export type LanguageCode = 'en' | 'hi' | 'bn';

export const translations = {
  en,
  hi,
  bn,
};

export function getTranslation(lang: LanguageCode, key: keyof typeof en): string {
  const dict = translations[lang] || translations.en;
  return dict[key] || translations.en[key] || key;
}

export const SUPPORTED_LANGUAGES = [
  { code: 'en' as LanguageCode, label: 'English', nativeName: 'English' },
  { code: 'hi' as LanguageCode, label: 'Hindi', nativeName: 'हिन्दी' },
  { code: 'bn' as LanguageCode, label: 'Bengali', nativeName: 'বাংলা' },
];
