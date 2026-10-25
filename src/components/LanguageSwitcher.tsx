import React from 'react';
import { useLanguage } from '../context/LanguageContext.js';
import { Globe } from 'lucide-react';

export const LanguageSwitcher: React.FC<{ className?: string }> = ({ className = '' }) => {
  const { language, setLanguage, supportedLanguages } = useLanguage();

  return (
    <div className={`inline-flex items-center bg-white/90 border border-yatriwarm-200 rounded-lg p-0.5 shadow-subtle text-xs ${className}`}>
      <span className="pl-2 pr-1 text-yatriwarm-500">
        <Globe className="w-3.5 h-3.5" />
      </span>
      {supportedLanguages.map(lang => (
        <button
          key={lang.code}
          type="button"
          onClick={() => setLanguage(lang.code)}
          className={`px-2 py-1 rounded-md font-medium transition-colors ${
            language === lang.code
              ? 'bg-yatribrand-900 text-white shadow-xs'
              : 'text-yatriwarm-700 hover:bg-yatriwarm-100'
          }`}
          aria-label={`Switch language to ${lang.label}`}
        >
          {lang.nativeName}
        </button>
      ))}
    </div>
  );
};
