import React, { useState, useEffect } from 'react';
import { Route, Bus, TimetableDeparture, LocationObservation, ETAResult, ServiceAlert } from '../../types';
import { ApiClient } from '../../services/apiClient';
import { CustomBusIllustration } from '../common/CustomBusIllustration';
import { BusRouteMap } from '../map/BusRouteMap';
import { JourneyConsentModal } from '../tracking/JourneyConsentModal';
import {
  Clock,
  MapPin,
  ShieldCheck,
  Navigation,
  AlertTriangle,
  Radio,
  X,
  ChevronRight,
  Share2,
  Calendar,
  Zap,
  Info
} from 'lucide-react';
import { t } from '../../i18n';

interface RouteDetailModalProps {
  route: Route;
  serviceDate: string;
  onClose: () => void;
  onOpenContribution: (routeId: string) => void;
  activeJourneySessionId: string | null;
  onStartTracking: (busId: string, routeId: string) => void;
  onStopTracking: () => void;
}

export const RouteDetailModal: React.FC<RouteDetailModalProps> = ({
  route,
  serviceDate,
  onClose,
  onOpenContribution,
  activeJourneySessionId,
  onStartTracking,
  onStopTracking
}) => {
  const [activeTab, setActiveTab] = useState<'stops' | 'timetable' | 'map'>('stops');
  const [selectedServiceDate, setSelectedServiceDate] = useState(serviceDate);
  const [timetables, setTimetables] = useState<TimetableDeparture[]>([]);
  const [buses, setBuses] = useState<Bus[]>([]);
  const [selectedBus, setSelectedBus] = useState<Bus | null>(null);
  const [activeObservation, setActiveObservation] = useState<LocationObservation | null>(null);
  const [selectedStopId, setSelectedStopId] = useState<string | undefined>(route.stops[0]?.stopId);
  const [eta, setEta] = useState<ETAResult | null>(null);
  const [showConsentModal, setShowConsentModal] = useState(false);
  const [serviceAlerts, setServiceAlerts] = useState<ServiceAlert[]>(route.serviceAlerts || []);

  useEffect(() => {
    setSelectedServiceDate(serviceDate);
  }, [serviceDate]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [ttRes, busesRes, routeRes] = await Promise.all([
          ApiClient.getTimetables(route.id, selectedServiceDate),
          ApiClient.getAllBuses(),
          ApiClient.getRouteById(route.id)
        ]);

        if (ttRes.success) setTimetables(ttRes.data);
        if (routeRes.success) setServiceAlerts(routeRes.data.serviceAlerts || []);
        if (busesRes.success) {
          const matchingBuses = busesRes.data.filter((b: Bus) => b.operatorId === route.operatorId);
          setBuses(matchingBuses);
          const firstBus = matchingBuses[0] || null;
          setSelectedBus(firstBus);

          if (!firstBus) setActiveObservation(null);
        }
      } catch (err) {
        console.error('Error loading route details:', err);
      }
    };

    fetchData();
  }, [route.id, selectedServiceDate]);

  useEffect(() => {
    let cancelled = false;
    if (!selectedBus) {
      setActiveObservation(null);
      return;
    }
    const refreshLocation = async () => {
      try {
        const response = await ApiClient.getBusById(selectedBus.id, route.id);
        if (!cancelled) {
          setActiveObservation(response.success ? (response.data?.currentLocation || null) : null);
        }
      } catch {
        if (!cancelled) setActiveObservation(null);
      }
    };
    void refreshLocation();
    const intervalId = window.setInterval(() => { void refreshLocation(); }, 15_000);
    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [selectedBus?.id, route.id]);

  useEffect(() => {
    if (selectedStopId) {
      ApiClient.getETA(route.id, selectedStopId, selectedServiceDate).then(res => {
        if (res.success) setEta(res.data);
      });
    }
  }, [route.id, selectedStopId, selectedServiceDate]);

  const handleConsentDecision = (consentGiven: boolean) => {
    if (consentGiven && selectedBus) {
      onStartTracking(selectedBus.id, route.id);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in overflow-y-auto">
      <div className="w-full max-w-2xl bg-white rounded-3xl shadow-2xl border border-surface-border text-slate-800 relative my-4 max-h-[92vh] flex flex-col overflow-hidden">
        {/* Sticky Header */}
        <div className="p-4 sm:p-5 border-b border-surface-border bg-white flex items-center justify-between shrink-0">
          <div>
            <div className="flex items-center space-x-2">
              <span className="px-2.5 py-0.5 rounded-full bg-brand-900 text-white font-mono font-bold text-xs">
                Route {route.routeNumber}
              </span>
              <span className={`text-xs px-2 py-0.5 rounded-full font-semibold flex items-center space-x-1 ${route.verificationStatus === 'admin_verified' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-900'}`}>
                {route.verificationStatus === 'admin_verified' ? <ShieldCheck className="w-3 h-3" /> : <Info className="w-3 h-3" />}
                <span>{t(route.verificationStatus === 'admin_verified' ? 'badge_admin_verified' : route.verificationStatus === 'community_corroborated' ? 'badge_community' : route.verificationStatus === 'published_unverified' ? 'badge_published_unverified' : 'badge_unverified')}</span>
              </span>
            </div>
            <h2 className="text-base sm:text-lg font-bold text-slate-900 mt-1">
              {route.name}
            </h2>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition shrink-0"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Content Body */}
        <div className="overflow-y-auto p-4 sm:p-6 space-y-5 flex-1">
          {serviceAlerts.length > 0 && (
            <div className="rounded-2xl border border-amber-300 bg-amber-50 p-3 space-y-2">
              <div className="text-xs font-bold text-amber-900">{t('service_alert')}</div>
              {serviceAlerts.map(alert => (
                <div key={alert.id} className="text-xs text-amber-900">
                  <span className="font-semibold">{alert.alertType.replace(/_/g, ' ')}:</span> {alert.details}
                  {alert.validUntil && <span className="block text-[10px] text-amber-700 mt-1">{t('valid_until')} {new Date(alert.validUntil).toLocaleString()}</span>}
                </div>
              ))}
            </div>
          )}

          {/* Custom SVG Bus Artwork Display */}
          <div className="relative">
            <CustomBusIllustration
              variant={selectedBus?.vehicleType === 'electric' ? 'city' : 'express'}
              operatorName={selectedBus?.name || route.name}
              routeCode={route.routeNumber}
              className="h-40 sm:h-48"
            />
          </div>

          {/* Live Status and ETA Banner */}
          <div className="p-4 rounded-2xl bg-surface-subtle border border-surface-border flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center space-x-3">
              <div className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 ${activeObservation?.trackingStatus === 'live_gps' ? 'bg-emerald-100 text-emerald-800 animate-pulse' : 'bg-amber-100 text-amber-800'}`}>
                <Radio className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center space-x-2">
                  <span className="font-bold text-xs text-slate-900">
                    {activeObservation?.trackingStatus === 'live_gps' ? t('status_live_gps') : (activeObservation || eta) ? t('status_estimated') : t('status_unavailable')}
                  </span>
                  <span className="text-[10px] text-slate-400">•</span>
                  <span className="text-[11px] text-slate-500 font-medium">
                    {activeObservation?.trackingStatus === 'live_gps' ? t('gps_corroborated') : activeObservation ? t('approximate_gps_report') : eta ? 'Timetable Projection' : t('tracking_not_available')}
                  </span>
                </div>
                {eta && (
                  <p className="text-xs text-slate-600 mt-0.5">
                    Next Stop: <b className="text-slate-900">{eta.stopName}</b> at <span className="text-brand-900 font-bold">{eta.predictedArrival || eta.scheduledArrival}</span>
                  </p>
                )}
              </div>
            </div>

            {/* Select the actual bus before consenting to location sharing */}
            {buses.length > 1 && (
              <select
                aria-label={t('select_bus')}
                value={selectedBus?.id || ''}
                onChange={event => setSelectedBus(buses.find(bus => bus.id === event.target.value) || null)}
                className="w-full sm:w-auto rounded-xl border border-surface-border bg-white px-3 py-2 text-xs font-semibold text-slate-800"
              >
                {buses.map(bus => <option key={bus.id} value={bus.id}>{bus.name}</option>)}
              </select>
            )}

            {/* Travel Confirmation CTA */}
            {!activeJourneySessionId && selectedBus && (
              <button
                onClick={() => setShowConsentModal(true)}
                className="px-3.5 py-2 rounded-xl bg-brand-900 hover:bg-brand-950 font-semibold text-white text-xs transition shadow-sm flex items-center justify-center space-x-1.5 shrink-0"
              >
                <Navigation className="w-3.5 h-3.5" />
                <span>Travelling on this bus?</span>
              </button>
            )}
            {activeJourneySessionId && (
              <button
                onClick={onStopTracking}
                className="px-3.5 py-2 rounded-xl border border-rose-200 bg-rose-50 text-rose-800 font-semibold text-xs hover:bg-rose-100 transition shrink-0"
              >
                {t('stop_sharing')}
              </button>
            )}
            {!selectedBus && !activeJourneySessionId && <p className="text-[11px] text-slate-500">{t('tracking_not_available')}</p>}
          </div>

          {/* Navigation Sub-Tabs */}
          <div className="grid grid-cols-3 gap-1 p-1 bg-surface-subtle rounded-2xl border border-surface-border text-xs font-bold">
            <button
              onClick={() => setActiveTab('stops')}
              className={`py-2 rounded-xl transition ${activeTab === 'stops' ? 'bg-white shadow text-brand-900' : 'text-slate-600 hover:text-slate-900'}`}
            >
              Stop Sequence ({route.stops.length})
            </button>
            <button
              onClick={() => setActiveTab('timetable')}
              className={`py-2 rounded-xl transition ${activeTab === 'timetable' ? 'bg-white shadow text-brand-900' : 'text-slate-600 hover:text-slate-900'}`}
            >
              Timetable ({timetables.length})
            </button>
            <button
              onClick={() => setActiveTab('map')}
              className={`py-2 rounded-xl transition ${activeTab === 'map' ? 'bg-white shadow text-brand-900' : 'text-slate-600 hover:text-slate-900'}`}
            >
              Interactive Map
            </button>
          </div>

          {/* Tab 1: Stop Sequence */}
          {activeTab === 'stops' && (
            <div className="space-y-2">
              {route.stops.map((stop, idx) => {
                const isOrigin = idx === 0;
                const isDest = idx === route.stops.length - 1;
                const isSelected = selectedStopId === stop.stopId;

                return (
                  <div
                    key={stop.stopId}
                    onClick={() => setSelectedStopId(stop.stopId)}
                    className={`p-3 rounded-2xl border cursor-pointer transition flex items-center justify-between ${isSelected ? 'border-brand-900 bg-brand-50/50 shadow-sm' : 'border-surface-border bg-white hover:border-slate-300'}`}
                  >
                    <div className="flex items-center space-x-3">
                      <div className={`w-7 h-7 rounded-full flex items-center justify-center font-bold text-xs shrink-0 ${isOrigin ? 'bg-emerald-600 text-white' : isDest ? 'bg-red-600 text-white' : 'bg-slate-100 text-slate-700'}`}>
                        {stop.stopSequence}
                      </div>
                      <div>
                        <h4 className="font-bold text-xs text-slate-900">{stop.stopName}</h4>
                        <span className="text-[11px] text-slate-500">
                          {stop.distanceFromOriginKm} km • Offset +{stop.arrivalOffsetMinutes} min
                        </span>
                      </div>
                    </div>

                    <div className="text-right">
                      <span className="text-xs font-semibold text-brand-900">
                        Scheduled +{stop.arrivalOffsetMinutes}m
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Tab 2: Timetable Departures */}
          {activeTab === 'timetable' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-3 text-xs text-slate-500 px-1">
                <span>{t('operating_days')}: {route.operatingDays?.join(' · ') || t('schedule_days_unavailable')}</span>
                <input
                  type="date"
                  required
                  aria-label={t('travel_date')}
                  min={new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())}
                  value={selectedServiceDate}
                  onChange={event => setSelectedServiceDate(event.target.value)}
                  className="rounded-lg border border-surface-border bg-white px-2 py-1.5 text-xs font-semibold text-slate-800"
                />
              </div>

              <div className="space-y-2">
                {timetables.map(tt => (
                  <div
                    key={tt.id}
                    className="p-3.5 rounded-2xl bg-white border border-surface-border shadow-sm flex items-center justify-between text-xs"
                  >
                    <div className="flex items-center space-x-3">
                      <div className="w-8 h-8 rounded-xl bg-surface-subtle border border-surface-border flex items-center justify-center text-slate-700">
                        <Clock className="w-4 h-4 text-brand-900" />
                      </div>
                      <div>
                        <div className="font-bold text-slate-900 text-sm">
                          {tt.departureTime} ➔ {tt.arrivalTime}
                        </div>
                        <span className="text-[11px] text-slate-500 uppercase">
                          {tt.tripCode}{tt.headsign ? ' • ' + tt.headsign : ''}{tt.vehicleType ? ' • ' + tt.vehicleType : ''}{tt.operatingDays?.length ? ' • ' + tt.operatingDays.join('/') : ''}
                        </span>
                      </div>
                    </div>

                    <div className="text-right">
                      <div className="font-bold text-emerald-700 text-sm">
                        {tt.fareInRupees !== undefined && tt.fareInRupees !== null ? '₹' + tt.fareInRupees : t('fare_not_provided')}
                      </div>
                      <span className="text-[10px] text-slate-400">{tt.fareInRupees !== undefined && tt.fareInRupees !== null ? t('published_fare') : t('fare_unavailable')}</span>
                    </div>
                  </div>
                ))}
                {timetables.length === 0 && <p className="text-xs text-slate-500 p-3">{t('no_scheduled_departures')}</p>}
              </div>
              {route.sourceAttribution && <p className="text-[10px] text-slate-500">{t('source_attribution')} · {route.sourceSnapshotDate}</p>}
              {route.sourceAttribution && <p className="text-[10px] text-slate-500">{t('independent_service_notice')}</p>}
            </div>
          )}

          {/* Tab 3: Interactive Map */}
          {activeTab === 'map' && (
            <div className="space-y-3">
              <BusRouteMap
                route={route}
                activeObservation={activeObservation}
                selectedStopId={selectedStopId}
                onSelectStop={setSelectedStopId}
                className="h-80 rounded-2xl"
              />
              <p className="text-[11px] text-slate-500 text-center">
                Click on any sequenced stop marker to view intermediate details.
              </p>
            </div>
          )}

          {/* Footer Contribution Link */}
          <div className="pt-2 text-center">
            <button
              onClick={() => onOpenContribution(route.id)}
              className="text-xs text-brand-900 hover:text-brand-950 font-semibold underline underline-offset-4"
            >
              Notice an outdated schedule or route change? Suggest a correction
            </button>
          </div>
        </div>

        {/* Consent Modal if triggered */}
        {selectedBus && (
          <JourneyConsentModal
            bus={selectedBus}
            route={route}
            isOpen={showConsentModal}
            onClose={() => setShowConsentModal(false)}
            onConfirmConsent={handleConsentDecision}
          />
        )}
      </div>
    </div>
  );
};
