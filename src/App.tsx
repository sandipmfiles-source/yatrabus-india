import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { LanguageProvider } from './context/LanguageContext.js';
import { TrackingProvider } from './context/TrackingContext.js';
import { Navbar } from './components/Navbar.js';
import { Footer } from './components/Footer.js';
import { LocationConsentModal } from './components/LocationConsentModal.js';
import { ActiveTrackingWidget } from './components/ActiveTrackingWidget.js';
import { FirstLaunchLanguagePrompt } from './components/FirstLaunchLanguagePrompt.js';
import { StartupLocationPermission } from './components/StartupLocationPermission.js';

import { HomePage } from './pages/HomePage.js';
import { SearchResultsPage } from './pages/SearchResultsPage.js';
import { BusDetailPage } from './pages/BusDetailPage.js';
import { ContributePage } from './pages/ContributePage.js';
import { OperatorClaimPage } from './pages/OperatorClaimPage.js';
import { OwnerDashboardPage } from './pages/OwnerDashboardPage.js';
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
          <div className="yatribus-theme flex flex-col min-h-screen">
            <Navbar />
            <main className="flex-1">
              <Routes>
                <Route path="/" element={<HomePage />} />
                <Route path="/search" element={<SearchResultsPage />} />
                <Route path="/routes/:id" element={<BusDetailPage />} />
                <Route path="/contribute" element={<ContributePage />} />
                <Route path="/operator" element={<OwnerDashboardPage />} />
                <Route path="/operator-claim" element={<OperatorClaimPage />} />
                <Route path="/privacy" element={<PrivacyPolicyPage />} />
                <Route path="/admin" element={<AdminLoginPage />} />
                <Route path="/admin/dashboard" element={<AdminDashboardPage />} />
                <Route path="/admin/submissions" element={<AdminSubmissionsPage />} />
                <Route path="/admin/duplicates" element={<AdminDuplicatesPage />} />
                <Route path="/admin/tracking" element={<AdminTrackingPage />} />
                <Route path="/admin/places" element={<AdminPlacesPage />} />
                <Route path="/admin/buses" element={<AdminBusesPage />} />
                <Route path="/admin/automation" element={<AdminAutomationPage />} />
                <Route path="/admin/health" element={<AdminHealthPage />} />
              </Routes>
            </main>
            <Footer />
            <FirstLaunchLanguagePrompt />
            <StartupLocationPermission />
            <LocationConsentModal />
            <ActiveTrackingWidget />
          </div>
        </BrowserRouter>
      </TrackingProvider>
    </LanguageProvider>
  );
};

export default App;
