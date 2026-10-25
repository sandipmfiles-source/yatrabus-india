import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { repository } from '../../../backend/src/db/repository.js';
import { Bus, Route } from '@shared/types/bus.js';
import { ArrowLeft, BusFront, CheckCircle, ShieldCheck } from 'lucide-react';
import { StatusBadge } from '../../components/StatusBadge.js';

export const AdminBusesPage: React.FC = () => {
  const [buses, setBuses] = useState<Bus[]>([]);
  const [routes, setRoutes] = useState<Route[]>([]);

  useEffect(() => {
    const allRoutes = repository.getAllRoutes();
    setRoutes(allRoutes);
    const busList = allRoutes.flatMap(r => repository.getBusesForRoute(r.id));
    setBuses(busList);
  }, []);

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-6">
      <div className="flex items-center gap-3">
        <Link
          to="/admin/dashboard"
          className="p-2 rounded-xl bg-white hover:bg-yatriwarm-100 border border-yatriwarm-200 text-yatriwarm-700 transition-colors shadow-subtle"
        >
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-xl font-bold text-yatriwarm-950">Buses & Fleet Management</h1>
          <p className="text-xs text-yatriwarm-500">
            Registered transit fleet vehicles, vehicle types, operators, and fallback SVG asset configuration.
          </p>
        </div>
      </div>

      <div className="bg-white rounded-3xl p-6 border border-yatriwarm-200 shadow-card space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-yatriwarm-200">
          <h3 className="text-sm font-bold text-yatriwarm-900 uppercase tracking-wider">
            Verified Fleet Vehicles ({buses.length})
          </h3>
        </div>

        <div className="divide-y divide-yatriwarm-100">
          {buses.map(bus => (
            <div key={bus.id} className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-bold text-yatriwarm-900 text-sm">{bus.publicIdentifier}</span>
                  <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-yatribrand-100 text-yatribrand-800">
                    {bus.vehicleType.replace('_', ' ')}
                  </span>
                  <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
                    SVG Artwork: Ready
                  </span>
                </div>
                <div className="text-yatriwarm-500 text-[11px] mt-0.5">
                  Registration: {bus.fleetRegistrationNumber || 'Public Route Board'} • Operator ID: {bus.operatorId}
                </div>
              </div>

              <div className="flex items-center gap-3 shrink-0">
                <StatusBadge status={bus.serviceStatus} />
                <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                  <CheckCircle className="w-3 h-3" />
                  {bus.verificationStatus.replace('_', ' ')}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
