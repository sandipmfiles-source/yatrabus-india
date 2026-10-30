import React, { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { RouteStop, RouteGeometryPoint } from '@shared/types/bus.js';
import { AggregatedBusLocation } from '@shared/types/tracking.js';

interface MapViewProps {
  stops: RouteStop[];
  geometry?: RouteGeometryPoint[];
  busLocation?: AggregatedBusLocation | null;
  className?: string;
}

const validCoordinate = (latitude: unknown, longitude: unknown): latitude is number =>
  typeof latitude === 'number' && Number.isFinite(latitude) && latitude >= -90 && latitude <= 90 &&
  typeof longitude === 'number' && Number.isFinite(longitude) && longitude >= -180 && longitude <= 180;

export const MapView: React.FC<MapViewProps> = ({
  stops,
  geometry,
  busLocation,
  className = 'w-full h-80 rounded-2xl overflow-hidden border border-yatriwarm-200 shadow-card',
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const overlayRef = useRef<L.LayerGroup | null>(null);

  // Create the Leaflet map once. Importing Leaflet here (rather than expecting
  // window.L from a CDN) also makes the map work inside the Capacitor APK.
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    const map = L.map(mapContainerRef.current, {
      zoomControl: true,
      scrollWheelZoom: false,
    });
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 19,
    }).addTo(map);

    mapRef.current = map;
    overlayRef.current = L.layerGroup().addTo(map);
    const initial = stops.find(stop => validCoordinate(stop.latitude, stop.longitude));
    map.setView(initial ? [initial.latitude, initial.longitude] : [22.9734, 78.6569], initial ? 12 : 5);

    // Leaflet needs a size refresh after a mobile/web layout has settled.
    const frame = window.requestAnimationFrame(() => map.invalidateSize());
    return () => {
      window.cancelAnimationFrame(frame);
      map.remove();
      mapRef.current = null;
      overlayRef.current = null;
    };
  }, []);

  // Refresh route, active-stop and bus overlays without recreating the base map.
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
        color: '#0E4D34',
        weight: 6,
        opacity: 0.9,
        lineCap: 'round',
        lineJoin: 'round',
      }).addTo(overlay);
      line.bringToBack();
      boundsPoints.push(...line.getLatLngs() as L.LatLng[]);
    }

    // Highlight the next/nearest stop when a usable GPS fix is available.
    let activeStopId: string | null = null;
    const hasBusCoordinates = !!busLocation && validCoordinate(busLocation.latitude, busLocation.longitude);
    if (hasBusCoordinates && validStops.length) {
      let nearestDistance = Number.POSITIVE_INFINITY;
      for (const stop of validStops) {
        const distance = map.distance(
          [busLocation!.latitude!, busLocation!.longitude!],
          [stop.latitude, stop.longitude],
        );
        if (distance < nearestDistance) {
          nearestDistance = distance;
          activeStopId = stop.id;
        }
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
      L.marker([stop.latitude, stop.longitude], { icon: stopIcon })
        .addTo(overlay)
        .bindPopup(`<strong>${stop.stopSequence}. ${stop.stopName}</strong>${isActive ? '<br/><b>Nearest stop to reported bus location</b>' : ''}<br/>Scheduled: ${stop.scheduledArrivalTime || 'Not listed'}`);
      boundsPoints.push([stop.latitude, stop.longitude]);
    });

    if (hasBusCoordinates) {
      const isLive = busLocation!.displayState === 'LIVE' && busLocation!.isLive;
      const busColor = isLive ? '#059669' : '#D97706';
      const busIcon = L.divIcon({
        className: 'yatribus-bus-icon',
        html: `<div style="position:relative;width:42px;height:42px;display:flex;align-items:center;justify-content:center;">
          ${isLive ? '<span style="position:absolute;inset:0;border-radius:50%;background:rgba(16,185,129,.25);animation:yatribus-pulse 1.8s infinite;"></span>' : ''}
          <span style="position:relative;width:34px;height:34px;border-radius:50%;background:${busColor};border:3px solid #fff;box-shadow:0 2px 9px rgba(0,0,0,.4);display:flex;align-items:center;justify-content:center;font-size:19px;">🚌</span>
        </div>
        <style>@keyframes yatribus-pulse{0%{transform:scale(.75);opacity:.9}100%{transform:scale(1.45);opacity:0}}</style>`,
        iconSize: [42, 42],
        iconAnchor: [21, 21],
      });
      L.marker([busLocation!.latitude!, busLocation!.longitude!], { icon: busIcon, zIndexOffset: 1000 })
        .addTo(overlay)
        .bindPopup(`<strong>🚌 Bus ${isLive ? 'LIVE GPS location' : 'last reported location'}</strong><br/>${busLocation!.statusExplanation}<br/>Updated: ${busLocation!.lastObservedAt ? new Date(busLocation!.lastObservedAt).toLocaleString() : 'Time unavailable'}`);
      boundsPoints.push([busLocation!.latitude!, busLocation!.longitude!]);
    }

    if (boundsPoints.length > 1) {
      map.fitBounds(L.latLngBounds(boundsPoints), { padding: [28, 28], maxZoom: 15 });
    } else if (boundsPoints.length === 1) {
      map.setView(boundsPoints[0], 14);
    }
    window.requestAnimationFrame(() => map.invalidateSize());
  }, [stops, geometry, busLocation]);

  return (
    <div className={className}>
      <div ref={mapContainerRef} className="w-full h-full min-h-[300px] z-10" />
      <div className="relative z-20 -mt-10 ml-3 flex flex-wrap gap-2 pointer-events-none">
        <span className="rounded-full bg-white/95 px-2.5 py-1 text-[10px] font-semibold text-yatriwarm-800 shadow">● Stops</span>
        <span className="rounded-full bg-white/95 px-2.5 py-1 text-[10px] font-semibold text-amber-700 shadow">● Nearest stop</span>
        <span className="rounded-full bg-white/95 px-2.5 py-1 text-[10px] font-semibold text-emerald-700 shadow">🚌 Bus GPS</span>
      </div>
    </div>
  );
};
