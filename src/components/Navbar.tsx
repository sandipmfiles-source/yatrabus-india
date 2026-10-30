import React from 'react';
import { useLanguage } from '../context/LanguageContext.js';
import { Link, useLocation } from 'react-router-dom';
import { BusIllustration } from '../assets/BusIllustration.js';
import { LanguageSwitcher } from './LanguageSwitcher.js';
import { ShieldCheck, PlusCircle, Search, UserCheck } from 'lucide-react';

export const Navbar: React.FC = () => {
  const location = useLocation();
  const { t } = useLanguage();

  const isActive = (path: string) => location.pathname === path;

  return (
    <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-yatriwarm-200">
      <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between gap-4">
        {/* Brand identity */}
        <Link to="/" className="flex items-center gap-2.5 group">
          <div className="w-10 h-10 rounded-xl bg-yatribrand-900 flex items-center justify-center shadow-subtle group-hover:bg-yatribrand-800 transition-colors">
            <BusIllustration variant="icon" className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-lg font-bold tracking-tight text-yatribrand-900">
                YatriBus
              </span>
              <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-yatribrand-100 text-yatribrand-800">
                India
              </span>
            </div>
            <p className="text-[10px] text-yatriwarm-500 font-medium hidden sm:block">
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
            to="/operator-claim"
            className={`px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 ${
              isActive('/operator-claim') ? 'bg-yatribrand-50 text-yatribrand-900 font-semibold' : 'text-yatriwarm-700 hover:bg-yatriwarm-100'
            }`}
          >
            <UserCheck className="w-4 h-4" />
            {t('nav_operator_portal')}
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
