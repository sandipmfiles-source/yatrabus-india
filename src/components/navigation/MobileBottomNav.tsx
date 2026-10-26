import React from 'react';
import { Home, Route, PlusCircle, ShieldAlert, Navigation } from 'lucide-react';
import { t } from '../../i18n';

interface MobileBottomNavProps {
  currentView: string;
  onSelectView: (view: 'home' | 'all_routes' | 'admin') => void;
  onOpenContribution: () => void;
  activeSessionId: string | null;
}

export const MobileBottomNav: React.FC<MobileBottomNavProps> = ({
  currentView,
  onSelectView,
  onOpenContribution,
  activeSessionId
}) => {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-surface-border md:hidden px-3 py-2 flex items-center justify-around shadow-lg">
      <button
        onClick={() => onSelectView('home')}
        className={`flex flex-col items-center space-y-1 transition ${currentView === 'home' ? 'text-brand-900 font-bold' : 'text-slate-500 hover:text-slate-800'}`}
      >
        <Home className="w-5 h-5" />
        <span className="text-[10px]">{t('nav_home')}</span>
      </button>

      <button
        onClick={() => onSelectView('all_routes')}
        className={`flex flex-col items-center space-y-1 transition ${currentView === 'all_routes' ? 'text-brand-900 font-bold' : 'text-slate-500 hover:text-slate-800'}`}
      >
        <Route className="w-5 h-5" />
        <span className="text-[10px]">{t('nav_routes')}</span>
      </button>

      {/* Prominent Center Add / Contribute Button */}
      <button
        onClick={onOpenContribution}
        className="flex flex-col items-center -mt-5"
      >
        <div className="w-12 h-12 rounded-full bg-brand-900 text-white flex items-center justify-center shadow-lg border-2 border-white hover:bg-brand-950 transition">
          <PlusCircle className="w-6 h-6 text-amber-300" />
        </div>
        <span className="text-[10px] font-bold text-brand-900 mt-1">{t('nav_contribute')}</span>
      </button>

      <button
        onClick={() => onSelectView('admin')}
        className={`flex flex-col items-center space-y-1 transition ${currentView === 'admin' ? 'text-brand-900 font-bold' : 'text-slate-500 hover:text-slate-800'}`}
      >
        <ShieldAlert className="w-5 h-5" />
        <span className="text-[10px]">{t('nav_admin')}</span>
      </button>
    </nav>
  );
};
