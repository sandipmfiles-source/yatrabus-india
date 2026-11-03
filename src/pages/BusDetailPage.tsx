import React, { useState, useEffect } from 'react';
import { useLanguage } from '../context/LanguageContext.js';
import { useParams, Link, useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '../services/api.js';
import { Route, RouteStop } from '@shared/types/bus.js';
import { AggregatedBusLocation } from '@shared/types/tracking.js';
import { ETAResult } from '@shared/engine/etaCalculator.js';
import { StatusBadge } from '../components/StatusBadge.js';
import { ConfidenceBadge } from '../components/ConfidenceBadge.js';
import { JourneyConfirmBanner } from '../components/JourneyConfirmBanner.js';
import { BusIllustration } from '../assets/BusIllustration.js';
import { MapView } from '../components/MapView.js';
import { phase4 } from '../services/phase4.js';
import { getJourneyAlertCandidates } from '@shared/engine/phase4Policy.js';
import { ArrowLeft, Clock, MapPin, ShieldCheck, AlertTriangle, Edit3, Flag, BusFront, Heart, Share2, QrCode } from 'lucide-react';

export const BusDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const selectedStopId = searchParams.get('stop');
  const qrToken = searchParams.get('qrToken');
  const requestedBusId = searchParams.get('bus');
  const navigate = useNavigate();
  const { t } = useLanguage();

  const [isLoading, setIsLoading] = useState(true);
  const [route, setRoute] = useState<Route | null>(null);
  const [isFavourite, setIsFavourite] = useState(false);
  const [qrVerified, setQrVerified] = useState(false);
  const [alertsEnabled, setAlertsEnabled] = useState(() => phase4.alertsEnabled());
  const [shareMessage, setShareMessage] = useState('');
  const [activeBusId, setActiveBusId] = useState<string | null>(null);
  const [location, setLocation] = useState<AggregatedBusLocation | null>(null);
  const [stopETAs, setStopETAs] = useState<ETAResult[]>([]);
  const [corrections, setCorrections] = useState<any[]>([]);
  const [editingStopId, setEditingStopId] = useState<string | null>(null);
  const [editingPlaceStopId, setEditingPlaceStopId] = useState<string | null>(null);
  const [editPlaceName, setEditPlaceName] = useState('');
  const [editTime, setEditTime] = useState('');
  const [correctionBusy, setCorrectionBusy] = useState(false);
  const [correctionMessage, setCorrectionMessage] = useState('');
  const [visitorId] = useState(() => {
    try {
      const saved = localStorage.getItem('yatribus_community_visitor_id');
      if (saved) return saved;
      const generated = typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : 'yb-' + Date.now() + '-' + Math.random().toString(36).slice(2);
      localStorage.setItem('yatribus_community_visitor_id', generated);
      return generated;
    } catch { return 'yb-' + Date.now() + '-' + Math.random().toString(36).slice(2); }
  });

  useEffect(() => {
    let active = true;
    setQrVerified(false);
    if (route && qrToken && selectedStopId) {
      api.verifyStopQrToken(qrToken).then(result => {
        if (active && result.routeId === route.id && result.stopId === selectedStopId) setQrVerified(true);
      }).catch(() => { if (active) setQrVerified(false); });
    }
    return () => { active = false; };
  }, [route?.id, qrToken, selectedStopId]);

  useEffect(() => {
    if (!route || !selectedStopId) return;
    document.getElementById('yb-stop-' + selectedStopId)?.scrollIntoView({
      behavior: phase4.getAccessibility().reducedMotion ? 'auto' : 'smooth',
      block: 'center',
    });
  }, [route?.id, selectedStopId]);

  useEffect(() => {
    if (!id) return;

    setIsLoading(true);
    setActiveBusId(null);
    setLocation(null);
    api.getRouteById(id).then(res => {
      if (res.route) {
        setRoute(res.route);
        setIsFavourite(phase4.isFavourite(res.route.id));
        void phase4.cacheVerifiedRoutes([res.route]).catch(() => undefined);
        const routeBus = res.buses?.find((bus: any) => bus.id === requestedBusId && bus.routeId === res.route.id) || res.buses?.find((bus: any) => bus.routeId === res.route.id);
        if (routeBus?.id) setActiveBusId(routeBus.id);
      }
      setIsLoading(false);
    }).catch(async () => {
      try {
        const cached = await phase4.getOfflineRoutes();
        const savedRoute = cached.find(item => item.id === id);
        if (savedRoute) {
          setRoute(savedRoute);
          setIsFavourite(phase4.isFavourite(savedRoute.id));
          setCorrectionMessage('Offline copy: source-verified timetable details are cached and may be stale. Confirm with the operator; live GPS is unavailable.');
        } else {
          setCorrectionMessage('This route is not saved for offline use. Connect to the internet and open it once to cache its verified timetable.');
        }
      } catch {
        setCorrectionMessage('Route details are unavailable while offline.');
      }
      setIsLoading(false);
    });
  }, [id]);

  useEffect(() => {
    if (!activeBusId || !route?.id) return;
    let cancelled = false;
    const refreshBusLocation = async () => {
      try {
        const busRes = await api.getBusById(activeBusId, route.id);
        if (!cancelled) {
          setLocation(busRes.location || null);
          const currentEtas: ETAResult[] = busRes.stopETAs || [];
          setStopETAs(currentEtas);
          if (alertsEnabled) {
            const alerts = getJourneyAlertCandidates(route, busRes.location?.isLive === true, currentEtas);
            for (const alert of alerts) void phase4.notifyOnce(alert.key, alert.title, alert.body);
          }
        }
      } catch {
        // Keep the last confirmed location visible if a temporary refresh fails.
      }
    };
    void refreshBusLocation();
    const intervalId = window.setInterval(() => { void refreshBusLocation(); }, 15000);
    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [activeBusId, route?.id, alertsEnabled, requestedBusId]);

  useEffect(() => {
    if (!route?.id) return;
    api.getRouteCorrections(route.id).then(data => setCorrections(data.corrections || [])).catch(() => setCorrections([]));
  }, [route?.id]);

  // Project a fresh GPS fix onto the ordered stop-to-stop corridor.
  // The timeline marker is intentionally hidden unless GPS is genuinely live.
  const liveBusProgress = (() => {
    if (!route || !(location?.isLive || location?.displayState === 'LAST_KNOWN') || typeof location.latitude !== 'number' || typeof location.longitude !== 'number' || route.stops.length < 2) return null;
    const stops = route.stops;
    let best: { ratio: number; error: number } | null = null;
    for (let i = 0; i < stops.length - 1; i++) {
      const a = stops[i], b = stops[i + 1];
      const meanLat = ((a.latitude + b.latitude) / 2) * Math.PI / 180;
      const sx = (b.longitude - a.longitude) * Math.cos(meanLat), sy = b.latitude - a.latitude;
      const px = (location.longitude - a.longitude) * Math.cos(meanLat), py = location.latitude - a.latitude;
      const lengthSquared = sx * sx + sy * sy;
      const fraction = lengthSquared > 0 ? Math.max(0, Math.min(1, (px * sx + py * sy) / lengthSquared)) : 0;
      const dx = px - fraction * sx, dy = py - fraction * sy;
      const error = Math.sqrt(dx * dx + dy * dy);
      const startKm = a.distanceFromStartKm || 0;
      const endKm = b.distanceFromStartKm || startKm;
      const ratio = route.distanceKm > 0 ? (startKm + (endKm - startKm) * fraction) / route.distanceKm : (i + fraction) / (stops.length - 1);
      if (!best || error < best.error) best = { ratio: Math.max(0, Math.min(1, ratio)), error };
    }
    // Do not place a bus on this route when its GPS fix is far off the corridor.
    // Only show the timeline bus when its GPS fix is close to the actual stop corridor (about 220 m).\n    return best !== null && best.error < 0.002 ? best.ratio : null;
  })();

  const enableAlerts = async () => {
    try {
      const granted = await phase4.enableLiveAlerts();
      setAlertsEnabled(granted);
      setShareMessage(granted ? 'Journey alerts enabled on this device.' : 'Notification permission was not granted.');
    } catch {
      setShareMessage('Notifications are not available on this device or browser.');
    }
  };

  const toggleFavourite = () => {
    if (!route) return;
    const saved = phase4.toggleFavourite(route);
    setIsFavourite(saved);
    if (!saved) void phase4.cancelRouteReminder(route.id);
  };

  const shareJourney = async () => {
    if (!route) return;
    const query = new URLSearchParams();
    if (activeBusId) query.set('bus', activeBusId);
    const url = window.location.origin + '/routes/' + encodeURIComponent(route.id) + (query.toString() ? '?' + query.toString() : '');
    try {
      if (navigator.share) await navigator.share({ title: route.routeName, text: route.originStopName + ' to ' + route.destinationStopName, url });
      else if (navigator.clipboard?.writeText) { await navigator.clipboard.writeText(url); setShareMessage('Journey link copied.'); }
      else setShareMessage(url);
    } catch (error) {
      if ((error as any)?.name !== 'AbortError') setShareMessage('Share this link: ' + url);
    }
  };

  const copyStopLink = async (stopId: string) => {
    if (!route) return;
    const url = window.location.origin + '/stop/' + encodeURIComponent(route.id) + '/' + encodeURIComponent(stopId);
    try {
      await navigator.clipboard.writeText(url);
      setShareMessage('Stop link copied. It can be encoded as a QR label.');
    } catch { setShareMessage(url); }
  };

  const refreshCorrections = async () => {
    if (!route) return;
    const data = await api.getRouteCorrections(route.id);
    setCorrections(data.corrections || []);
  };

  const submitStopCorrection = async (stop: RouteStop) => {
    if (!route || !editTime || correctionBusy) return;
    setCorrectionBusy(true);
    setCorrectionMessage('');
    try {
      const field = 'scheduledArrivalTime';
      const result = await api.submitContribution({
        submissionType: 'CORRECT_TIMETABLE',
        entityType: 'TIMETABLE',
        targetEntityId: route.id,
        contributorNote: 'Passenger suggested a timetable correction',
        proposedData: {
          routeNumber: route.routeNumber,
          timetableEntry: false,
          action: 'CORRECT_STOP_TIME',
          stopId: stop.id,
          stopName: stop.stopName,
          field,
          value: editTime,
          originalValue: stop.scheduledArrivalTime || '',
        },
      });
      setCorrectionMessage('Correction submitted for review. Reference: ' + result.referenceId);
      setEditingStopId(null);
      setEditTime('');
      await refreshCorrections();
    } catch (error) {
      setCorrectionMessage(error instanceof Error ? error.message : 'Could not submit correction.');
    } finally {
      setCorrectionBusy(false);
    }
  };

  const submitPlaceCorrection = async (stop: RouteStop) => {
    if (!route || !editPlaceName.trim() || correctionBusy) return;
    setCorrectionBusy(true);
    setCorrectionMessage('');
    try {
      const result = await api.submitContribution({
        submissionType: 'CORRECT_TIMETABLE',
        entityType: 'TIMETABLE',
        targetEntityId: route.id,
        contributorNote: 'Passenger suggested a bus stop name correction',
        proposedData: {
          routeNumber: route.routeNumber,
          timetableEntry: false,
          action: 'CORRECT_STOP_NAME',
          stopId: stop.id,
          stopName: stop.stopName,
          field: 'stopName',
          value: editPlaceName.trim().slice(0, 120),
          originalValue: stop.stopName,
        },
      });
      setCorrectionMessage('Stop name correction submitted. Reference: ' + result.referenceId);
      setEditingPlaceStopId(null);
      setEditPlaceName('');
      await refreshCorrections();
    } catch (error) {
      setCorrectionMessage(error instanceof Error ? error.message : 'Could not submit stop correction.');
    } finally { setCorrectionBusy(false); }
  };

  const voteForCorrection = async (correction: any) => {
    try {
      await api.voteOnCorrection(
        correction.referenceId,
        correction.proposedData?.field || 'scheduledArrivalTime',
        correction.proposedData?.value || '',
        visitorId
      );
      await refreshCorrections();
      setCorrectionMessage('Your vote has been counted.');
    } catch (error) {
      setCorrectionMessage(error instanceof Error ? error.message : 'Vote could not be counted.');
    }
  };

  if (isLoading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8 text-center text-yatriwarm-500">
        {t('loading_route_details')}
      </div>
    );
  }

  if (!route) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8 text-center space-y-3">
        <h2 className="text-lg font-bold text-yatriwarm-900">{t('route_not_found')}</h2>
        <Link to="/" className="text-xs text-yatribrand-900 font-semibold underline">
          {t('return_to_search')}
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
      {/* Top Bar */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate(-1)}
          className="p-2 rounded-xl bg-white hover:bg-yatriwarm-100 border border-yatriwarm-200 text-yatriwarm-700 transition-colors shadow-subtle"
          aria-label="Back"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>

        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span className="text-xl font-extrabold text-yatribrand-900">{route.routeNumber}</span>
            <span className="text-xs font-semibold px-2 py-0.5 rounded-md bg-yatribrand-100 text-yatribrand-800">
              {route.operatorName || 'Transit Agency'}
            </span>
            <StatusBadge status={route.serviceStatus} />
          </div>
          <h1 className="text-sm font-semibold text-yatriwarm-600 line-clamp-1 mt-0.5">
            {route.routeName}
          </h1>
          {route.contributedBy && <p className="text-[10px] text-yatriwarm-500 mt-0.5">Helped by {route.contributedBy}</p>}
        </div>
      </div>

      {/* Journey Confirmation Prompt */}
      {activeBusId && <JourneyConfirmBanner
        busId={activeBusId}
        routeId={route.id}
        routeNumber={route.routeNumber}
        destinationStopId={route.destinationStopId}
      />}

      {/* Hero Visual Card with SVG Artwork */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white rounded-3xl p-5 border border-yatriwarm-200 shadow-card flex flex-col justify-between">
          <BusIllustration
            variant="banner"
            className="w-full h-44"
            routeNumber={route.routeNumber}
            destinationText={route.destinationStopName}
          />
          <div className="mt-4 flex items-center justify-between text-xs text-yatriwarm-600 border-t border-yatriwarm-100 pt-3">
            <span>{route.timetableDataStatus === 'UNAVAILABLE' ? 'Timetable unavailable' : `${t('operating_days')}: ${route.operatingDays.join(', ')}`}</span>
            <span>{route.timetableDataStatus === 'UNAVAILABLE' ? 'Frequency not verified' : `${t('frequency_label')}: ~${route.frequencyMinutes || 20}m`}</span>
          </div>
        </div>

        {/* Live Location / Confidence Overview */}
        <div className="bg-white rounded-3xl p-5 border border-yatriwarm-200 shadow-card space-y-4 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-yatriwarm-500">
                {t('tracking_engine_status')}
              </span>
              <ConfidenceBadge displayState={location?.displayState || 'ESTIMATED'} />
            </div>

            <div className="mt-3 p-3.5 rounded-2xl bg-yatriwarm-50 border border-yatriwarm-200 text-xs space-y-1.5">
              <div className="font-semibold text-yatriwarm-900">
                {location?.statusExplanation || t('timetable_prediction')}
              </div>
              {location?.isLive && (
                <div className="text-emerald-700 font-medium">
                  ✓ {t('fresh_observation')}
                </div>
              )}
              {!location?.isLive && (
                <div className="text-yatriwarm-500">
                  {t('scheduled_location_note')}
                </div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 pt-2">
            <div className="p-3 bg-yatriwarm-50 rounded-xl border border-yatriwarm-200 text-center">
              <div className="text-[11px] text-yatriwarm-500 font-medium">{t('route_distance')}</div>
              <div className="text-base font-bold text-yatriwarm-900 mt-0.5">{route.distanceKm} km</div>
            </div>
            <div className="p-3 bg-yatriwarm-50 rounded-xl border border-yatriwarm-200 text-center">
              <div className="text-[11px] text-yatriwarm-500 font-medium">{t('typical_duration')}</div>
              <div className="text-base font-bold text-yatriwarm-900 mt-0.5">{route.timetableDataStatus === 'UNAVAILABLE' ? '—' : `${route.typicalDurationMinutes} min`}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Interactive Map View */}
      <div className="space-y-2">
        <h3 className="text-xs font-bold uppercase tracking-wider text-yatriwarm-700">
          {t('route_map_stops')}
        </h3>
        <MapView
          stops={route.stops}
          route={route}
          geometry={route.geometry}
          busLocation={location}
          className="w-full h-80 rounded-3xl overflow-hidden border border-yatriwarm-200 shadow-card"
        />
      </div>

      {/* Stop Sequence & ETA Timeline */}
      <div className="bg-white rounded-3xl p-5 sm:p-7 border border-yatriwarm-200 shadow-card space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-yatriwarm-200">
          <div>
            <h3 className="text-base font-bold text-yatriwarm-900">
              {t('ordered_stop_sequence')}
            </h3>
            <p className="text-xs text-yatriwarm-500">
              {t('eta_explanation')}
            </p>
          </div>
          <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-yatriwarm-100 text-yatriwarm-700">
            {route.stops.length} {t('stops_label')}
          </span>
        </div>

        <div className="relative pl-6 space-y-6 before:absolute before:left-2.5 before:top-3 before:bottom-3 before:w-0.5 before:bg-yatriwarm-200">
          {typeof liveBusProgress === 'number' && (
            <div className="absolute z-20 left-[10px] -translate-x-1/2 -translate-y-1/2 pointer-events-none" style={{ top: `calc(12px + ${liveBusProgress * 100}% - ${liveBusProgress * 24}px)` }} aria-label="Live bus position on route timeline" title="Live GPS bus position">
              <span className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-white bg-yatribrand-900 text-white shadow-lg ring-2 ring-emerald-300">
                <BusFront className="h-4 w-4" aria-hidden="true" />
              </span>
            </div>
          )}
          {route.stops.map((stop, idx) => {
            const eta = stopETAs.find(e => e.stopId === stop.stopId);
            const isTerminus = idx === 0 || idx === route.stops.length - 1;

            return (
              <div id={`yb-stop-${stop.id}`} key={stop.id} className={`relative flex min-h-[56px] items-start justify-between gap-4 rounded-xl px-2 py-2 ${selectedStopId === stop.id ? "bg-emerald-50 ring-2 ring-emerald-500" : ""}`}>
                {/* Timeline node */}
                <div
                  className={`absolute -left-6 top-1 w-3.5 h-3.5 rounded-full border-2 border-white shadow-xs ${
                    isTerminus ? 'bg-yatribrand-900' : 'bg-emerald-500'
                  }`}
                />

                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-yatriwarm-400">#{stop.stopSequence}</span>
                    {(() => {
                      const related = corrections.filter(item => item.proposedData?.stopId === stop.id && item.proposedData?.field === 'stopName');
                      const totals: Record<string, number> = {};
                      related.forEach(item => Object.entries(item.communityVotes || {}).forEach(([key, count]) => {
                        const split = key.indexOf(':');
                        if (split >= 0) { const value = key.slice(split + 1); totals[value] = (totals[value] || 0) + Number(count || 0); }
                      }));
                      const winner = Object.entries(totals).sort((a, b) => b[1] - a[1])[0];
                      return <h4 className="text-sm font-semibold text-yatriwarm-900">{winner && winner[1] >= 2 ? winner[0] : stop.stopName}</h4>;
                    })()}
                    <button type="button" onClick={() => { setEditingPlaceStopId(editingPlaceStopId === stop.id ? null : stop.id); setEditPlaceName(stop.stopName); }} className="text-yatribrand-900" aria-label={`Suggest stop name correction for ${stop.stopName}`}><Edit3 className="w-3 h-3" /></button>
                  </div>
                  <div className="text-[11px] text-yatriwarm-500 mt-0.5">
                    {stop.distanceFromStartKm} km from start
                  </div>
                </div>

                <div className="text-right shrink-0 min-w-[112px]">
                  {(() => {
                    const related = corrections.filter(item => item.proposedData?.stopId === stop.id && item.proposedData?.field === 'scheduledArrivalTime');
                    const totals: Record<string, number> = {};
                    related.forEach(item => Object.entries(item.communityVotes || {}).forEach(([key, count]) => {
                      const split = key.indexOf(':');
                      if (split >= 0) {
                        const value = key.slice(split + 1);
                        totals[value] = (totals[value] || 0) + Number(count || 0);
                      }
                    }));
                    const winner = Object.entries(totals).sort((a, b) => b[1] - a[1])[0];
                    const useConsensus = !!winner && winner[1] >= 2;
                    return <>
                      <div className="text-xs font-bold text-yatriwarm-900">
                        {useConsensus ? winner[0] : (route.timetableDataStatus === 'UNAVAILABLE' && eta?.calculationType !== 'OBSERVATION_BASED' ? '—' : (eta?.predictedTime || stop.scheduledArrivalTime || '—'))}
                      </div>
                      <div className="text-[10px] text-yatriwarm-500">
                        {useConsensus ? `Community majority · ${winner[1]} votes` : eta?.calculationType === 'OBSERVATION_BASED' ? `Live ETA · ${eta.confidenceScore}% ${eta.confidenceCategory.toLowerCase()} confidence` : route.timetableDataStatus === 'UNAVAILABLE' ? 'No source-verified timetable' : `Timetable estimate · ${eta?.confidenceScore ?? 0}% confidence`}
                      </div>
                      {!useConsensus && eta?.confidenceNote && <div className="mt-0.5 text-[9px] text-yatriwarm-400">{eta.confidenceNote}</div>}
                    </>;
                  })()}
                  <button type="button" onClick={() => { setEditingStopId(editingStopId === stop.id ? null : stop.id); setEditTime(stop.scheduledArrivalTime || ''); }} className="mt-1 inline-flex items-center gap-1 text-[10px] text-yatribrand-900 font-semibold" aria-label={`Suggest time correction for ${stop.stopName}`}>
                    <Edit3 className="w-3 h-3" />Edit
                  </button>
                </div>
              </div>
            );
          })}
        </div>
        {editingPlaceStopId && (
          <div className="mt-4 p-3 rounded-xl border border-yatriwarm-200 bg-yatriwarm-50 flex flex-wrap items-end gap-3">
            <div className="flex-1 min-w-[180px]"><label className="block text-xs font-semibold text-yatriwarm-700 mb-1">Correct bus stop name</label><input type="text" value={editPlaceName} onChange={event => setEditPlaceName(event.target.value)} className="w-full px-3 py-2 rounded-lg border border-yatriwarm-200 bg-white text-sm" /></div>
            <button type="button" disabled={correctionBusy || !editPlaceName.trim()} onClick={() => { const stop = route.stops.find(item => item.id === editingPlaceStopId); if (stop) void submitPlaceCorrection(stop); }} className="px-4 py-2 rounded-lg bg-yatribrand-900 text-white text-xs font-semibold disabled:opacity-50">{correctionBusy ? 'Sending…' : 'Submit place correction'}</button>
            <button type="button" onClick={() => setEditingPlaceStopId(null)} className="px-3 py-2 rounded-lg border border-yatriwarm-200 text-xs">Cancel</button>
          </div>
        )}
        {editingStopId && (
          <div className="mt-4 p-3 rounded-xl border border-yatriwarm-200 bg-yatriwarm-50 flex flex-wrap items-end gap-3">
            <div className="flex-1 min-w-[150px]">
              <label className="block text-xs font-semibold text-yatriwarm-700 mb-1">Correct arrival time</label>
              <input type="time" value={editTime} onChange={event => setEditTime(event.target.value)} className="w-full px-3 py-2 rounded-lg border border-yatriwarm-200 bg-white text-sm" />
            </div>
            <button type="button" disabled={correctionBusy || !editTime} onClick={() => { const stop = route.stops.find(item => item.id === editingStopId); if (stop) void submitStopCorrection(stop); }} className="px-4 py-2 rounded-lg bg-yatribrand-900 text-white text-xs font-semibold disabled:opacity-50">{correctionBusy ? 'Sending…' : 'Submit correction'}</button>
            <button type="button" onClick={() => setEditingStopId(null)} className="px-3 py-2 rounded-lg border border-yatriwarm-200 text-xs">Cancel</button>
          </div>
        )}
        {corrections.length > 0 && (
          <div className="mt-4 space-y-2">
            <h4 className="text-xs font-bold text-yatriwarm-800">Community time suggestions</h4>
            {corrections.map(item => <div key={item.id} className="flex items-center justify-between gap-3 p-2 rounded-lg border border-yatriwarm-200 text-xs">
              <span className="text-yatriwarm-700">{item.proposedData?.stopName}: <strong>{item.proposedData?.value}</strong></span>
              <button type="button" onClick={() => void voteForCorrection(item)} className="px-3 py-1.5 rounded-lg border border-yatriwarm-200 font-semibold text-yatribrand-900">Vote ({Object.values(item.communityVotes || {}).reduce((sum: number, value: any) => sum + Number(value || 0), 0)})</button>
            </div>)}
          </div>
        )}
        {correctionMessage && <p role="status" className="mt-2 text-xs text-yatriwarm-600">{correctionMessage}</p>}
      </div>

      {/* Phase 4 passenger tools */}
      <section className="rounded-2xl border border-yatriwarm-200 bg-white p-4 space-y-3">
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={toggleFavourite} aria-pressed={isFavourite} className="rounded-xl border px-3 py-2 text-xs font-semibold">
            <Heart className="inline h-4 w-4 mr-1" fill={isFavourite ? 'currentColor' : 'none'}/>{isFavourite ? 'Saved favourite' : 'Save favourite'}
          </button>
          <button type="button" onClick={() => void shareJourney()} className="rounded-xl border px-3 py-2 text-xs font-semibold"><Share2 className="inline h-4 w-4 mr-1"/>Share journey</button>
          <button type="button" onClick={() => void enableAlerts()} aria-pressed={alertsEnabled} className="rounded-xl border px-3 py-2 text-xs font-semibold">{alertsEnabled ? 'Journey alerts on' : 'Enable live alerts'}</button>
          <Link to="/scan" className="rounded-xl border px-3 py-2 text-xs font-semibold"><QrCode className="inline h-4 w-4 mr-1"/>Scan stop QR</Link>
        </div>
        {shareMessage && <p role="status" className="text-xs text-yatriwarm-600 break-all">{shareMessage}</p>}
        <p className="text-[10px] text-yatriwarm-500">Live GPS arrival and delay alerts are evaluated while this route screen is active and fresh GPS is available. Android background restrictions may pause live checks; scheduled journey reminders are separate.</p>
        <div>
          <h3 className="text-xs font-bold text-yatriwarm-900 mb-2">Stop links for QR labels</h3>
          <div className="max-h-44 overflow-y-auto space-y-1">
            {route.stops.map(stop => <div key={stop.id} className="flex items-center justify-between gap-2 text-xs border-b border-yatriwarm-100 py-1.5">
              <span>{stop.stopSequence}. {stop.stopName}</span>
              <button type="button" onClick={() => void copyStopLink(stop.id)} className="shrink-0 rounded-lg border px-2 py-1 font-semibold">Copy stop link</button>
            </div>)}
          </div>
          <p className="mt-2 text-[10px] text-yatriwarm-500">Stop links resolve to route records; an unverified stop remains unverified. Do not use a printed link as proof of a surveyed stop.</p>
        </div>
      </section>

      {/* Community Actions */}
      <section className="min-w-0 rounded-xl border border-yatriwarm-200 bg-white p-3 shadow-subtle space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
          <h3 className="text-xs font-bold text-yatriwarm-900">
            Report a schedule or route issue
          </h3>
          <span className="text-[10px] text-yatriwarm-500">Suggestions reviewed</span>
        </div>

        <div className="flex min-w-0 flex-nowrap gap-1.5 overflow-x-auto overscroll-x-contain pb-1">
          <Link
            to={`/contribute?routeId=${route.id}&type=CORRECT_TIMETABLE`}
            title="Suggest a timetable correction"
            aria-label="Suggest a timetable correction"
            className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-lg border border-yatriwarm-200 bg-yatriwarm-50 px-2.5 py-2 text-[11px] font-semibold text-yatribrand-900 hover:bg-yatribrand-50 focus:outline-none focus:ring-2 focus:ring-yatribrand-700"
          >
            <Edit3 className="h-3.5 w-3.5" /> Timetable
          </Link>

          <Link
            to={`/contribute?routeId=${route.id}&type=REPORT_CHANGED_ROUTE`}
            title="Report diversion or service issue"
            aria-label="Report diversion or service issue"
            className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-lg border border-rose-200 bg-rose-50 px-2.5 py-2 text-[11px] font-semibold text-rose-700 hover:bg-rose-100 focus:outline-none focus:ring-2 focus:ring-rose-500"
          >
            <Flag className="h-3.5 w-3.5" /> Diversion / issue
          </Link>

          <Link
            to={`/contribute?routeId=${route.id}&type=UPDATE_ROUTE&source=OPERATOR`}
            title="Update route details"
            aria-label="Update route details"
            className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-lg border border-yatriwarm-200 bg-yatriwarm-50 px-2.5 py-2 text-[11px] font-semibold text-yatribrand-900 hover:bg-yatribrand-50 focus:outline-none focus:ring-2 focus:ring-yatribrand-700"
          >
            <Edit3 className="h-3.5 w-3.5" /> Route details
          </Link>

          {activeBusId && <>
            <Link
              to={`/contribute?routeId=${route.id}&busId=${activeBusId}&type=CORRECT_TIMETABLE&source=OPERATOR`}
              title="Update this bus timetable"
              aria-label="Update this bus timetable"
              className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-lg border border-yatriwarm-200 bg-yatriwarm-50 px-2.5 py-2 text-[11px] font-semibold text-yatribrand-900 hover:bg-yatribrand-50 focus:outline-none focus:ring-2 focus:ring-yatribrand-700"
            >
              <Clock className="h-3.5 w-3.5" /> Bus timings
            </Link>
            <Link
              to={`/contribute?routeId=${route.id}&busId=${activeBusId}&type=DELETE_BUS&source=OPERATOR`}
              title="Request review to remove this bus"
              aria-label="Request bus removal"
              className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-lg border border-rose-200 bg-rose-50 px-2.5 py-2 text-[11px] font-semibold text-rose-700 hover:bg-rose-100 focus:outline-none focus:ring-2 focus:ring-rose-500"
            >
              <Flag className="h-3.5 w-3.5" /> Remove bus
            </Link>
          </>}
        </div>
        <p className="text-[10px] leading-tight text-yatriwarm-500">Swipe the options sideways to see all actions. Reports are reviewed before changes are applied.</p>
      </section>
    </div>
  );
};
