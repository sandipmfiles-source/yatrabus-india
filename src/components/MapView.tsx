import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Route, RouteStop, RouteGeometryPoint } from '@shared/types/bus.js';
import { AggregatedBusLocation } from '@shared/types/tracking.js';

interface MapViewProps {
  stops: RouteStop[];
  geometry?: RouteGeometryPoint[];
  route?: Route;
  busLocation?: AggregatedBusLocation | null;
  className?: string;
}

const validCoordinate = (latitude: unknown, longitude: unknown): latitude is number =>
  typeof latitude === 'number' && Number.isFinite(latitude) && latitude >= -90 && latitude <= 90 &&
  typeof longitude === 'number' && Number.isFinite(longitude) && longitude >= -180 && longitude <= 180;

const timeMinutes = (value?: string): number | null => {
  if (!value || !/^\d{1,2}:\d{2}$/.test(value)) return null;
  const [hours, minutes] = value.split(':').map(Number);
  return hours < 24 && minutes < 60 ? hours * 60 + minutes : null;
};

const currentIndiaTime = () => {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(new Date());
  const hour = Number(parts.find(part => part.type === 'hour')?.value || 0);
  const minute = Number(parts.find(part => part.type === 'minute')?.value || 0);
  return hour * 60 + minute;
};

const estimateBusPosition = (route: Route | undefined, now: number): [number, number] | null => {
  if (!route || route.stops.length < 2 || route.typicalDurationMinutes <= 0) return null;
  const stops = [...route.stops].sort((a, b) => a.stopSequence - b.stopSequence);
  if (stops.some(stop => !validCoordinate(stop.latitude, stop.longitude))) return null;

  // Prefer explicit per-stop timetable times; they place the marker between the
  // two stops whose scheduled passage times bracket the current Indian time.
  const scheduledStops = stops
    .map(stop => ({ stop, minute: timeMinutes(stop.scheduledArrivalTime || stop.scheduledDepartureTime) }))
    .filter((item): item is { stop: RouteStop; minute: number } => item.minute !== null);
  if (scheduledStops.length >= 2) {
    let minuteNow = now;
    const first = scheduledStops[0].minute;
    const last = scheduledStops[scheduledStops.length - 1].minute;
    if (last < first && minuteNow < first) minuteNow += 1440;
    const times = scheduledStops.map(item => item.minute < first ? item.minute + 1440 : item.minute);
    for (let i = 0; i < scheduledStops.length - 1; i++) {
      if (minuteNow < times[i] || minuteNow > times[i + 1] || times[i + 1] <= times[i]) continue;
      const fraction = (minuteNow - times[i]) / (times[i + 1] - times[i]);
      const a = scheduledStops[i].stop, b = scheduledStops[i + 1].stop;
      return [a.latitude + (b.latitude - a.latitude) * fraction, a.longitude + (b.longitude - a.longitude) * fraction];
    }
    return null;
  }

  // Otherwise estimate the currently-running trip from published departures.
  const candidates = (route.departureTimes || [])
    .map(timeMinutes)
    .filter((value): value is number => value !== null);
  if (candidates.length === 0) {
    const first = timeMinutes(route.firstDepartureTime);
    const last = timeMinutes(route.lastDepartureTime);
    const frequency = Math.max(1, route.frequencyMinutes || 20);
    if (first !== null && last !== null && last >= first) {
      for (let t = first; t <= last; t += frequency) candidates.push(t);
    }
  }
  if (candidates.length === 0) {
    const first = timeMinutes(route.firstDepartureTime);
    if (first !== null) candidates.push(first);
  }
  const departure = candidates
    .filter(value => value <= now)
    .sort((a, b) => b - a)[0];
  if (departure === undefined) return null;
  const elapsed = now - departure;
  if (elapsed < 0 || elapsed > route.typicalDurationMinutes) return null;
  const fraction = elapsed / route.typicalDurationMinutes;
  const totalDistance = Math.max(0, ...stops.map(stop => stop.distanceFromStartKm || 0));
  const targetDistance = totalDistance > 0 ? totalDistance * fraction : (stops.length - 1) * fraction;
  let segment = stops.length - 2;
  for (let i = 0; i < stops.length - 1; i++) {
    const start = totalDistance > 0 ? (stops[i].distanceFromStartKm || 0) : i;
    const end = totalDistance > 0 ? (stops[i + 1].distanceFromStartKm || start) : i + 1;
    if (targetDistance <= end) { segment = i; break; }
  }
  const a = stops[segment], b = stops[segment + 1];
  const start = totalDistance > 0 ? (a.distanceFromStartKm || 0) : segment;
  const end = totalDistance > 0 ? (b.distanceFromStartKm || start) : segment + 1;
  const fractionInSegment = end > start ? Math.max(0, Math.min(1, (targetDistance - start) / (end - start))) : 0;
  return [a.latitude + (b.latitude - a.latitude) * fractionInSegment, a.longitude + (b.longitude - a.longitude) * fractionInSegment];
};

export const MapView: React.FC<MapViewProps> = ({
  stops,
  geometry,
  route,
  busLocation,
  className = 'w-full h-80 rounded-2xl overflow-hidden border border-yatriwarm-200 shadow-card',
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const overlayRef = useRef<L.LayerGroup | null>(null);
  const [clockTick, setClockTick] = useState(0);

  // Refresh the timetable estimate once a minute so the yellow bus advances with IST.
  useEffect(() => {
    const timer = window.setInterval(() => setClockTick(value => value + 1), 60000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;
    const map = L.map(mapContainerRef.current, { zoomControl: true, scrollWheelZoom: false });
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 19,
    }).addTo(map);
    mapRef.current = map;
    overlayRef.current = L.layerGroup().addTo(map);
    const initial = stops.find(stop => validCoordinate(stop.latitude, stop.longitude));
    map.setView(initial ? [initial.latitude, initial.longitude] : [22.9734, 78.6569], initial ? 12 : 5);
    const frame = window.requestAnimationFrame(() => map.invalidateSize());
    return () => {
      window.cancelAnimationFrame(frame);
      map.remove();
      mapRef.current = null;
      overlayRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    const overlay = overlayRef.current;
    if (!map || !overlay) return;
    overlay.clearLayers();

    const validStops = stops.filter(stop => validCoordinate(stop.latitude, stop.longitude));
    const routePoints = (geometry && geometry.length >= 2 ? geometry : validStops)
      .filter(point => validCoordinate(point.latitude, point.longitude));
    const boundsPoints: L.LatLngExpression[] = [];

    if (routePoints.length >= 2) {
      const line = L.polyline(routePoints.map(point => [point.latitude, point.longitude] as [number, number]), {
        color: '#0E4D34', weight: 6, opacity: 0.9, lineCap: 'round', lineJoin: 'round',
      }).addTo(overlay);
      line.bringToBack();
      boundsPoints.push(...line.getLatLngs() as L.LatLng[]);
    }

    let activeStopId: string | null = null;
    const hasLiveGps = !!busLocation && busLocation.displayState === 'LIVE' && busLocation.isLive &&
      validCoordinate(busLocation.latitude, busLocation.longitude);
    if (hasLiveGps && validStops.length) {
      let nearestDistance = Number.POSITIVE_INFINITY;
      for (const stop of validStops) {
        const distance = map.distance([busLocation!.latitude!, busLocation!.longitude!], [stop.latitude, stop.longitude]);
        if (distance < nearestDistance) { nearestDistance = distance; activeStopId = stop.id; }
      }
    }

    validStops.forEach((stop, index) => {
      const isTerminus = index === 0 || index === validStops.length - 1;
      const isActive = stop.id === activeStopId;
      const color = isActive ? '#F59E0B' : isTerminus ? '#0E4D34' : '#10B981';
      const stopIcon = L.divIcon({
        className: 'yatribus-stop-icon',
        html: `<div style="width:${isActive ? 22 : 15}px;height:${isActive ? 22 : 15}px;border-radius:50%;background:${color};border:${isActive ? 4 : 2}px solid #fff;box-shadow:0 1px 7px rgba(0,0,0,.38);"></div>`,
        iconSize: [isActive ? 22 : 15, isActive ? 22 : 15],
        iconAnchor: [isActive ? 11 : 7.5, isActive ? 11 : 7.5],
      });
      L.marker([stop.latitude, stop.longitude], { icon: stopIcon }).addTo(overlay)
        .bindPopup(`<strong>${stop.stopSequence}. ${stop.stopName}</strong>${isActive ? '<br/><b>Nearest stop to live bus GPS</b>' : ''}<br/>Scheduled: ${stop.scheduledArrivalTime || 'Not listed'}`);
      boundsPoints.push([stop.latitude, stop.longitude]);
    });

    // Green means an actual fresh GPS fix. Otherwise show only a yellow
    // timetable-based estimate, and never disguise it as a live location.
    const estimatedPosition = hasLiveGps ? null : estimateBusPosition(route, currentIndiaTime());
    const busPosition: [number, number] | null = hasLiveGps
      ? [busLocation!.latitude!, busLocation!.longitude!]
      : estimatedPosition;
    if (busPosition) {
      const color = hasLiveGps ? '#059669' : '#EAB308';
      const busIcon = L.divIcon({
        className: 'yatribus-bus-icon',
        html: `<div style="width:34px;height:34px;border-radius:50%;background:${color};border:2px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,.38);display:flex;align-items:center;justify-content:center;font-size:20px;line-height:1;">🚌</div>`,
        iconSize: [34, 34], iconAnchor: [17, 17],
      });
      L.marker(busPosition, { icon: busIcon, zIndexOffset: 1000 }).addTo(overlay)
        .bindPopup(hasLiveGps
          ? '<strong>🚌 Live GPS location</strong>'
          : '<strong>🚌 Possible position (timetable estimate)</strong><br/>Not a confirmed live location');
      boundsPoints.push(busPosition);
    }

    if (boundsPoints.length > 1) map.fitBounds(L.latLngBounds(boundsPoints), { padding: [28, 28], maxZoom: 15 });
    else if (boundsPoints.length === 1) map.setView(boundsPoints[0], 14);
    window.requestAnimationFrame(() => map.invalidateSize());
  }, [stops, geometry, route, busLocation, clockTick]);

  return (
    <div className={className}>
      <div ref={mapContainerRef} className="w-full h-full min-h-[300px] z-10" />
      <div className="relative z-20 -mt-10 ml-3 flex flex-wrap gap-2 pointer-events-none">
        <span className="rounded-full bg-white/95 px-2.5 py-1 text-[10px] font-semibold text-yatriwarm-800 shadow">● Stops</span>
        <span className="rounded-full bg-white/95 px-2.5 py-1 text-[10px] font-semibold text-amber-700 shadow">● Nearest stop</span>
        <span className="rounded-full bg-white/95 px-2.5 py-1 text-[10px] font-semibold text-emerald-700 shadow">🚌 Live GPS</span>
        <span className="rounded-full bg-white/95 px-2.5 py-1 text-[10px] font-semibold text-yellow-700 shadow">🚌 Possible position</span>
      </div>
    </div>
  );
};
