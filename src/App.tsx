import React, { useState, useEffect } from 'react';
import { Route, Place } from './types';
import { ApiClient } from './services/apiClient';
import { HomeScreen } from './components/home/HomeScreen';
import { RouteDetailModal } from './components/routes/RouteDetailModal';
import { ContributionModal } from './components/contribution/ContributionModal';
import { AdminDashboard } from './components/admin/AdminDashboard';
import { CustomBusIllustration } from './components/common/CustomBusIllustration';
import { MobileBottomNav } from './components/navigation/MobileBottomNav';
import { OfflineBanner } from './components/common/OfflineBanner';
import { OperatorClaimModal } from './components/operator/OperatorClaimModal';
import {
  Navigation,
  Globe,
  ShieldAlert,
  PlusCircle,
  Radio,
  MapPin,
  Search,
  Lock,
  X,
  Menu
} from 'lucide-react';
import { t, setLanguage, getLanguage, SupportedLanguage } from './i18n';

export const App: React.FC = () => {
  const [currentLang, setCurrentLang] = useState<SupportedLanguage>(getLanguage());
  const [view, setView] = useState<'home' | 'admin' | 'all_routes'>('home');
  const [selectedRoute, setSelectedRoute] = useState<Route | null>(null);
  const [showContributionModal, setShowContributionModal] = useState(false);
  const [showOperatorClaimModal, setShowOperatorClaimModal] = useState(false);
  const [prefillRouteId, setPrefillRouteId] = useState<string | undefined>(undefined);

  // Active Journey Tracking State
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [activeBusId, setActiveBusId] = useState<string | null>(null);
  const [activeRouteId, setActiveRouteId] = useState<string | null>(null);

  // Admin Auth State
  const [isAdminLoggedIn, setIsAdminLoggedIn] = useState(false);
  const [showAdminLoginModal, setShowAdminLoginModal] = useState(false);
  const [adminUsername, setAdminUsername] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [adminAuthError, setAdminAuthError] = useState('');

  // Routes directory list
  const [allRoutes, setAllRoutes] = useState<Route[]>([]);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    ApiClient.getAllRoutes().then(res => {
      if (res.success) setAllRoutes(res.data);
    });
  }, []);

  // Live Location Tracker Worker
  useEffect(() => {
    let watchId: number | null = null;

    if (activeSessionId && activeBusId && activeRouteId) {
      if ('geolocation' in navigator) {
        watchId = navigator.geolocation.watchPosition(
          pos => {
            ApiClient.sendLocationObservation(
              activeSessionId,
              activeBusId,
              activeRouteId,
              pos.coords.latitude,
              pos.coords.longitude,
              pos.coords.accuracy,
              pos.coords.speed !== null && pos.coords.speed !== undefined ? (pos.coords.speed * 3.6) : undefined,
              pos.coords.heading ?? undefined
            );
          },
          err => console.warn('Geolocation warning:', err.message),
          { enableHighAccuracy: true, maximumAge: 10000, timeout: 15000 }
        );
      }
    }

    return () => {
      if (watchId !== null) navigator.geolocation.clearWatch(watchId);
    };
  }, [activeSessionId, activeBusId, activeRouteId]);

  const handleLanguageChange = (lang: SupportedLanguage) => {
    setLanguage(lang);
    setCurrentLang(lang);
  };

  const handleStartTracking = async (busId: string, routeId: string) => {
    const res = await ApiClient.startJourneySession(busId, routeId, true);
    if (res.success && res.data) {
      setActiveSessionId(res.data.sessionId);
      setActiveBusId(busId);
      setActiveRouteId(routeId);
    }
  };

  const handleStopTracking = async () => {
    if (activeSessionId) {
      await ApiClient.stopJourneySession(activeSessionId);
      setActiveSessionId(null);
      setActiveBusId(null);
      setActiveRouteId(null);
    }
  };

  const handleAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAdminAuthError('');
    try {
      const res = await ApiClient.adminLogin(adminPassword, adminUsername);
      if (res.success) {
        setIsAdminLoggedIn(true);
        setShowAdminLoginModal(false);
        setView('admin');
        setAdminPassword('');
      } else {
        setAdminAuthError(res.error || 'Invalid administrator credentials.');
      }
    } catch {
      setAdminAuthError('Failed to communicate with authentication server.');
    }
  };

  return (
    <div className="min-h-screen bg-surface-warm flex flex-col text-slate-800">
      {/* Top Navbar */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-surface-border shadow-sm">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          {/* Brand Logo */}
          <div
            onClick={() => setView('home')}
            className="flex items-center space-x-2.5 cursor-pointer select-none"
          >
            <div className="w-10 h-10 rounded-2xl bg-brand-900 text-white flex items-center justify-center shadow-md">
              <Navigation className="w-5 h-5 text-amber-300" />
            </div>
            <div>
              <div className="flex items-center space-x-1.5">
                <span className="font-extrabold text-base tracking-tight text-slate-900">
                  {t('app_title')}
                </span>
                <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                  Live
                </span>
              </div>
              <p className="text-[10px] text-slate-500 font-medium hidden sm:block">
                Smart Transport Directory
              </p>
            </div>
          </div>

          {/* Center Navigation Links (Desktop) */}
          <nav className="hidden md:flex items-center space-x-1 text-xs font-bold text-slate-600">
            <button
              onClick={() => setView('home')}
              className={`py-2 px-3 rounded-xl transition ${view === 'home' ? 'bg-surface-subtle text-brand-900' : 'hover:bg-surface-subtle'}`}
            >
              {t('nav_home')}
            </button>
            <button
              onClick={() => setView('all_routes')}
              className={`py-2 px-3 rounded-xl transition ${view === 'all_routes' ? 'bg-surface-subtle text-brand-900' : 'hover:bg-surface-subtle'}`}
            >
              {t('nav_routes')}
            </button>
            <button
              onClick={() => {
                setPrefillRouteId(undefined);
                setShowContributionModal(true);
              }}
              className="py-2 px-3 rounded-xl hover:bg-surface-subtle transition flex items-center space-x-1 text-brand-900"
            >
              <PlusCircle className="w-3.5 h-3.5" />
              <span>{t('nav_contribute')}</span>
            </button>
            <button
              onClick={() => {
                if (isAdminLoggedIn) setView('admin');
                else setShowAdminLoginModal(true);
              }}
              className={`py-2 px-3 rounded-xl transition flex items-center space-x-1 ${view === 'admin' ? 'bg-surface-subtle text-brand-900' : 'hover:bg-surface-subtle text-slate-500'}`}
            >
              <ShieldAlert className="w-3.5 h-3.5" />
              <span>{t('nav_admin')}</span>
            </button>
          </nav>

          {/* Right Language Selector & Tracking Pill */}
          <div className="flex items-center space-x-2">
            {activeSessionId && (
              <div className="hidden sm:flex items-center space-x-1.5 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-xs font-semibold text-emerald-800">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span>Tracking Live</span>
              </div>
            )}

            {/* Language Switcher Dropdown */}
            <div className="flex items-center bg-surface-subtle border border-surface-border rounded-xl p-0.5 text-xs font-semibold">
              <button
                onClick={() => handleLanguageChange('en')}
                className={`px-2 py-1 rounded-lg transition ${currentLang === 'en' ? 'bg-white shadow text-brand-900' : 'text-slate-600'}`}
              >
                EN
              </button>
              <button
                onClick={() => handleLanguageChange('hi')}
                className={`px-2 py-1 rounded-lg transition ${currentLang === 'hi' ? 'bg-white shadow text-brand-900' : 'text-slate-600'}`}
              >
                हिन्दी
              </button>
              <button
                onClick={() => handleLanguageChange('bn')}
                className={`px-2 py-1 rounded-lg transition ${currentLang === 'bn' ? 'bg-white shadow text-brand-900' : 'text-slate-600'}`}
              >
                বাংলা
              </button>
            </div>

            {/* Mobile Menu Button */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 rounded-xl border border-surface-border md:hidden text-slate-600"
              aria-label="Toggle navigation menu"
            >
              <Menu className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Mobile Dropdown Menu */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-surface-border bg-white px-4 py-3 space-y-2 text-xs font-bold divide-y divide-surface-border">
            <div className="space-y-1">
              <button
                onClick={() => {
                  setView('home');
                  setMobileMenuOpen(false);
                }}
                className="w-full text-left py-2 px-3 rounded-xl hover:bg-surface-subtle text-slate-800"
              >
                {t('nav_home')}
              </button>
              <button
                onClick={() => {
                  setView('all_routes');
                  setMobileMenuOpen(false);
                }}
                className="w-full text-left py-2 px-3 rounded-xl hover:bg-surface-subtle text-slate-800"
              >
                {t('nav_routes')}
              </button>
              <button
                onClick={() => {
                  setShowContributionModal(true);
                  setMobileMenuOpen(false);
                }}
                className="w-full text-left py-2 px-3 rounded-xl hover:bg-surface-subtle text-brand-900 flex items-center space-x-1.5"
              >
                <PlusCircle className="w-4 h-4" />
                <span>{t('nav_contribute')}</span>
              </button>
              <button
                onClick={() => {
                  setMobileMenuOpen(false);
                  if (isAdminLoggedIn) setView('admin');
                  else setShowAdminLoginModal(true);
                }}
                className="w-full text-left py-2 px-3 rounded-xl hover:bg-surface-subtle text-slate-600 flex items-center space-x-1.5"
              >
                <ShieldAlert className="w-4 h-4" />
                <span>{t('nav_admin')}</span>
              </button>
            </div>
          </div>
        )}
      </header>

      {/* Offline Connectivity Notification Banner */}
      <OfflineBanner />

      {/* Main View Container */}
      <main className="flex-1 pb-16 md:pb-0">
        {view === 'home' && (
          <HomeScreen
            onSelectRoute={setSelectedRoute}
            onOpenContribution={routeId => {
              setPrefillRouteId(routeId);
              setShowContributionModal(true);
            }}
            activeJourneySessionId={activeSessionId}
            onStopTracking={handleStopTracking}
          />
        )}

        {view === 'all_routes' && (
          <div className="max-w-4xl mx-auto p-4 sm:p-6 space-y-4">
            <h2 className="text-xl font-bold text-slate-900">All India Bus Routes Directory</h2>
            <div className="space-y-3">
              {allRoutes.map(r => (
                <div
                  key={r.id}
                  onClick={() => setSelectedRoute(r)}
                  className="p-5 rounded-3xl bg-white border border-surface-border shadow-sm hover:border-brand-900 cursor-pointer transition flex items-center justify-between"
                >
                  <div className="flex items-center space-x-3">
                    <div className="w-12 h-12 rounded-2xl bg-brand-50 border border-brand-200 text-brand-900 flex flex-col items-center justify-center shrink-0">
                      <span className="text-[10px] font-bold">ROUTE</span>
                      <span className="text-xs font-extrabold">{r.routeNumber}</span>
                    </div>
                    <div>
                      <h3 className="font-bold text-sm text-slate-900">{r.name}</h3>
                      <p className="text-xs text-slate-500 mt-0.5">
                        {r.originName} ➔ {r.destinationName} • {r.stops.length} stops • {r.distanceKm} km
                      </p>
                    </div>
                  </div>
                  <span className="text-xs font-bold text-brand-900">View Details ➔</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {view === 'admin' && isAdminLoggedIn && (
          <AdminDashboard
            onLogout={() => {
              ApiClient.adminLogout();
              setIsAdminLoggedIn(false);
              setView('home');
            }}
          />
        )}
      </main>

      {/* Route Detail Modal */}
      {selectedRoute && (
        <RouteDetailModal
          route={selectedRoute}
          onClose={() => setSelectedRoute(null)}
          onOpenContribution={routeId => {
            setPrefillRouteId(routeId);
            setShowContributionModal(true);
          }}
          activeJourneySessionId={activeSessionId}
          onStartTracking={handleStartTracking}
        />
      )}

      {/* Community Contribution Modal */}
      <ContributionModal
        isOpen={showContributionModal}
        onClose={() => setShowContributionModal(false)}
        prefillRouteId={prefillRouteId}
      />

      {/* Admin Login Modal */}
      {showAdminLoginModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-sm bg-white rounded-3xl p-6 shadow-2xl border border-surface-border text-slate-800 relative">
            <button
              onClick={() => setShowAdminLoginModal(false)}
              className="absolute top-4 right-4 p-2 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition"
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="w-12 h-12 rounded-2xl bg-brand-900 text-white flex items-center justify-center mb-4 shadow">
              <Lock className="w-6 h-6 text-amber-300" />
            </div>

            <h3 className="text-lg font-bold text-slate-900">{t('admin_login_title')}</h3>
            <p className="text-xs text-slate-500 mt-1 mb-4">
              Restricted to verified municipal transport administrators & moderators.
            </p>

            {adminAuthError && (
              <div className="mb-3 p-2.5 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700">
                {adminAuthError}
              </div>
            )}

            <form onSubmit={handleAdminLogin} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Username / ID</label>
                <input
                  type="text"
                  required
                  placeholder="admin"
                  value={adminUsername}
                  onChange={e => setAdminUsername(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-surface-border focus:ring-2 focus:ring-brand-900 focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Admin Password</label>
                <input
                  type="password"
                  required
                  placeholder="admin123"
                  value={adminPassword}
                  onChange={e => setAdminPassword(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-surface-border focus:ring-2 focus:ring-brand-900 focus:outline-none"
                />
              </div>

              <button
                type="submit"
                className="w-full py-2.5 rounded-xl bg-brand-900 hover:bg-brand-950 font-bold text-white shadow transition mt-2"
              >
                Sign In to Admin Portal
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Operator Listing Claim Modal */}
      <OperatorClaimModal
        isOpen={showOperatorClaimModal}
        onClose={() => setShowOperatorClaimModal(false)}
      />

      {/* Mobile Responsive Bottom Navigation */}
      <MobileBottomNav
        currentView={view}
        onSelectView={setView}
        onOpenContribution={() => setShowContributionModal(true)}
        activeSessionId={activeSessionId}
      />

      {/* Footer */}
      <footer className="mt-auto border-t border-surface-border bg-white py-6 px-4 text-center text-xs text-slate-500 mb-14 md:mb-0">
        <div className="max-w-4xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
          <p>
            © 2026 YatraBus India • Built with OpenStreetMap & Community Contributions.
          </p>
          <div className="flex flex-wrap justify-center gap-3 text-slate-600 font-medium">
            <span
              onClick={() => setShowOperatorClaimModal(true)}
              className="hover:text-brand-900 cursor-pointer text-brand-900 font-bold"
            >
              Operator Listing Portal
            </span>
            <span>•</span>
            <span className="hover:text-brand-900 cursor-pointer">Privacy & Consent</span>
            <span>•</span>
            <span className="hover:text-brand-900 cursor-pointer">Data Sources</span>
            <span>•</span>
            <span className="hover:text-brand-900 cursor-pointer">₹0 Tech Architecture</span>
          </div>
        </div>
      </footer>
    </div>
  );
};
