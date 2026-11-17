import React from 'react';
import { Link } from 'react-router-dom';
import { ShieldCheck, Heart } from 'lucide-react';

export const Footer: React.FC = () => {
  return (
    <footer className="mt-20 border-t border-yatriwarm-200 bg-white text-yatriwarm-600 text-xs py-10">
      <div className="max-w-6xl mx-auto px-4 grid grid-cols-1 md:grid-cols-4 gap-8">
        <div className="md:col-span-2 space-y-3">
          <div className="flex items-center gap-2">
            <span className="text-base font-bold text-yatribrand-900">YatriBus India</span>
            <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-emerald-100 text-emerald-800">
              Community Powered
            </span>
          </div>
          <p className="text-yatriwarm-500 max-w-md leading-relaxed">
            A public transport directory and live tracking platform built for Indian passengers. Discover routes, timetables, and passenger-assisted bus positions with zero mandatory accounts or tracking without consent.
          </p>
          <div className="flex items-center gap-4 text-yatriwarm-500 text-[11px] pt-1">
            <span>₹0 Initial Cloud Budget</span>
            <span>•</span>
            <span>OpenStreetMap Tiles</span>
            <span>•</span>
            <span>PostGIS Geodatabase</span>
          </div>
        </div>

        <div>
          <h4 className="font-semibold text-yatriwarm-900 mb-2">Explore</h4>
          <ul className="space-y-1.5">
            <li><Link to="/" className="hover:text-yatribrand-900">Route Search</Link></li>
            <li><Link to="/contribute" className="hover:text-yatribrand-900">Add Missing Bus or Stop</Link></li>
            <li><Link to="/operator-claim" className="hover:text-yatribrand-900">Bus Operator Portal</Link></li>
            <li><Link to="/admin" className="hover:text-yatribrand-900">Verifier Dashboard</Link></li>
          </ul>
        </div>

        <div>
          <h4 className="font-semibold text-yatriwarm-900 mb-2">Trust & Privacy</h4>
          <ul className="space-y-1.5">
            <li><Link to="/privacy" className="hover:text-yatribrand-900">Privacy Policy & Consent</Link></li>
            <li><span className="text-yatriwarm-500">No Passenger Account Needed</span></li>
            <li><span className="text-yatriwarm-500">Bus-Level Anonymization</span></li>
            <li><span className="text-yatriwarm-500">12h Maximum Session Limit</span></li>
          </ul>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 mt-8 pt-6 border-t border-yatriwarm-100 flex flex-col sm:flex-row items-center justify-between text-yatriwarm-400 gap-2">
        <p>© 2026 YatriBus Open Source Contributors • Built with care for Indian Transit</p>
        <p className="flex items-center gap-1">
          Made for daily commuters across India <Heart className="w-3 h-3 text-rose-500 fill-rose-500" />
        </p>
      </div>
    </footer>
  );
};
