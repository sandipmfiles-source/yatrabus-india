import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { LanguageProvider } from './context/LanguageContext.js';
import { TrackingProvider } from './context/TrackingContext.js';
import { Navbar } from './components/Navbar.js';
import { Footer } from './components/Footer.js';
import { LocationConsentModal } from './components/LocationConsentModal.js';
import { ActiveTrackingWidget } from './components/ActiveTrackingWidget.js';
import { StartupGate } from './components/StartupGate.js';
import { AdminGuard } from './components/AdminGuard.js';

import { HomePage } from './pages/HomePage.js';
import { SearchResultsPage } from './pages/SearchResultsPage.js';
import { BusDetailPage } from './pages/BusDetailPage.js';
import { ContributePage } from './pages/ContributePage.js';
import { OperatorClaimPage } from './pages/OperatorClaimPage.js';
import { PrivacyPolicyPage } from './pages/PrivacyPolicyPage.js';

import { AdminLoginPage } from './pages/admin/AdminLoginPage.js';
import { AdminDashboardPage } from './pages/admin/AdminDashboardPage.js';
import { AdminSubmissionsPage } from './pages/admin/AdminSubmissionsPage.js';
import { AdminDuplicatesPage } from './pages/admin/AdminDuplicatesPage.js';
import { AdminTrackingPage } from './pages/admin/AdminTrackingPage.js';
import { AdminPlacesPage } from './pages/admin/AdminPlacesPage.js';
import { AdminBusesPage } from './pages/admin/AdminBusesPage.js';
import { AdminAutomationPage } from './pages/admin/AdminAutomationPage.js';
import { AdminHealthPage } from './pages/admin/AdminHealthPage.js';

export const App: React.FC = () => {
  return (
    <LanguageProvider>
      <TrackingProvider>
        <BrowserRouter>
          <StartupGate>
          <div className="flex flex-col min-h-screen">
            <Navbar />
            <main className="flex-1">
              <Routes>
                <Route path="/" element={<HomePage />} />
                <Route path="/search" element={<SearchResultsPage />} />
                <Route path="/routes/:id" element={<BusDetailPage />} />
                <Route path="/contribute" element={<ContributePage />} />
                <Route path="/operator-claim" element={<OperatorClaimPage />} />
                <Route path="/privacy" element={<PrivacyPolicyPage />} />

                {/* Admin routes */}
                <Route path="/admin" element={<AdminLoginPage />} />
                <Route path="/admin/dashboard" element={<AdminGuard><AdminDashboardPage /></AdminGuard>} />
                <Route path="/admin/submissions" element={<AdminGuard><AdminSubmissionsPage /></AdminGuard>} />
                <Route path="/admin/duplicates" element={<AdminGuard><AdminDuplicatesPage /></AdminGuard>} />
                <Route path="/admin/tracking" element={<AdminGuard><AdminTrackingPage /></AdminGuard>} />
                <Route path="/admin/places" element={<AdminGuard><AdminPlacesPage /></AdminGuard>} />
                <Route path="/admin/buses" element={<AdminGuard><AdminBusesPage /></AdminGuard>} />
                <Route path="/admin/automation" element={<AdminGuard><AdminAutomationPage /></AdminGuard>} />
                <Route path="/admin/health" element={<AdminGuard><AdminHealthPage /></AdminGuard>} />
              </Routes>
            </main>
            <Footer />

            {/* Persistent Global Modals & Widgets */}
            <LocationConsentModal />
            <ActiveTrackingWidget />
          </div>
          </StartupGate>
        </BrowserRouter>
      </TrackingProvider>
    </LanguageProvider>
  );
};

export default App;
