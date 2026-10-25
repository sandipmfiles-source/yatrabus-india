import React from 'react';
import { ShieldCheck, Lock, Clock, EyeOff } from 'lucide-react';

export const PrivacyPolicyPage: React.FC = () => {
  return (
    <div className="max-w-3xl mx-auto px-4 py-8 space-y-8">
      <div className="text-center space-y-2">
        <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-800 flex items-center justify-center mx-auto border border-emerald-200">
          <ShieldCheck className="w-6 h-6" />
        </div>
        <h1 className="text-2xl sm:text-3xl font-bold text-yatriwarm-950">
          Privacy Policy & Location Consent
        </h1>
        <p className="text-xs text-yatriwarm-500">
          Effective Date: January 1, 2026 • Dedicated to Indian Passenger Privacy
        </p>
      </div>

      <div className="bg-white rounded-3xl p-6 sm:p-8 border border-yatriwarm-200 shadow-card space-y-6 text-sm text-yatriwarm-700 leading-relaxed">
        <section className="space-y-2">
          <h2 className="text-base font-bold text-yatriwarm-900 flex items-center gap-2">
            <Lock className="w-4 h-4 text-yatribrand-700" />
            1. No Mandatory Accounts for Passengers
          </h2>
          <p>
            You can search routes, look up timetables, view bus stops, and contribute community updates on YatriBus without ever creating an account, sharing your phone number, or linking an email address.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-bold text-yatriwarm-900 flex items-center gap-2">
            <EyeOff className="w-4 h-4 text-yatribrand-700" />
            2. Never Secretly Collecting GPS
          </h2>
          <p>
            YatriBus never collects, transmits, or logs your GPS location secretly. We only ask for location permission when you explicitly choose to:
          </p>
          <ul className="list-disc pl-5 space-y-1 text-xs text-yatriwarm-600">
            <li>Find nearby bus stops based on your current physical vicinity.</li>
            <li>Explicitly opt into passenger-assisted journey tracking to help other commuters.</li>
          </ul>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-bold text-yatriwarm-900 flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-yatribrand-700" />
            3. Bus-Level Location Aggregation
          </h2>
          <p>
            When passengers contribute GPS observations during a confirmed bus trip, individual coordinates are stripped of device identifiers and aggregated onto the transit corridor. Public users see only the estimated bus location, never an individual passenger's path or history.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-bold text-yatriwarm-900 flex items-center gap-2">
            <Clock className="w-4 h-4 text-yatribrand-700" />
            4. 12-Hour Maximum Safety Limit & Instant Stop
          </h2>
          <p>
            A journey session terminates immediately when you tap the <strong>Stop Sharing</strong> button. In addition, an automated safety rule terminates all sessions after a maximum of 12 hours.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-bold text-yatriwarm-900">5. Contact & Data Deletion Requests</h2>
          <p className="text-xs">
            Since we do not store user profiles or personal tracking logs, there is no personal identity tied to transit data. However, for operator listing queries or verifications, you may contact our open source maintainers at <code className="bg-yatriwarm-100 px-1 py-0.5 rounded text-yatribrand-900">privacy@yatribus.in</code>.
          </p>
        </section>
      </div>
    </div>
  );
};
