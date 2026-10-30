import React from 'react';
import { useLanguage } from '../context/LanguageContext.js';
import { Link, useLocation } from 'react-router-dom';
import { BusIllustration } from '../assets/BusIllustration.js';
import { LanguageSwitcher } from './LanguageSwitcher.js';
import { ShieldCheck, PlusCircle, Search, BusFront } from 'lucide-react';

export const Navbar: React.FC = () => {
  const location = useLocation();
  const { t } = useLanguage();

  const isActive = (path: string) => location.pathname === path;

  return (
    <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-yatriwarm-200">
      <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between gap-4">
        {/* Brand identity */}
        <Link to="/" className="flex items-center gap-3 group yb-brand-lockup">
          <div className="yb-brand-mark w-11 h-11 rounded-2xl flex items-center justify-center shadow-subtle transition-all">
            <BusIllustration variant="icon" className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="yb-brand-name text-lg font-extrabold tracking-tight text-white">
                YatriBus
              </span>
              <span className="yb-brand-country text-[10px] uppercase font-bold tracking-wider px-2 py-1 rounded-md">
                India
              </span>
            </div>
            <p className="yb-brand-tagline text-[10px] font-medium hidden sm:block">
              {t('nav_tagline')}
            </p>
          </div>
        </Link>

        {/* Center / Navigation Links */}
        <nav className="hidden md:flex items-center gap-1 text-sm font-medium">
          <Link
            to="/"
            className={`px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 ${
              isActive('/') ? 'bg-yatribrand-50 text-yatribrand-900 font-semibold' : 'text-yatriwarm-700 hover:bg-yatriwarm-100'
            }`}
          >
            <Search className="w-4 h-4" />
            {t('nav_find_buses')}
          </Link>
          <Link
            to="/contribute"
            className={`px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 ${
              isActive('/contribute') ? 'bg-yatribrand-50 text-yatribrand-900 font-semibold' : 'text-yatriwarm-700 hover:bg-yatriwarm-100'
            }`}
          >
            <PlusCircle className="w-4 h-4" />
            {t('nav_contribute')}
          </Link>
          <Link
            to="/contribute?type=SUGGEST_ROUTE"
            className={`px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 ${
              isActive('/operator') || isActive('/operator-claim') ? 'bg-yatribrand-50 text-yatribrand-900 font-semibold' : 'text-yatriwarm-700 hover:bg-yatriwarm-100'
            }`}
          >
            <BusFront className="w-4 h-4" />
            Add Bus / Route
          </Link>
        </nav>

        {/* Right side controls: Language Switcher & Admin */}
        <div className="flex items-center gap-2.5">
          <LanguageSwitcher />

          <Link
            to="/admin"
            className="p-2 text-yatriwarm-600 hover:text-yatribrand-900 hover:bg-yatriwarm-100 rounded-lg text-xs font-medium flex items-center gap-1 transition-colors"
            title={t('nav_admin_title')}
          >
            <ShieldCheck className="w-4 h-4" />
            <span className="hidden sm:inline">Admin</span>
          </Link>
        </div>
      </div>
    </header>
  );
};
