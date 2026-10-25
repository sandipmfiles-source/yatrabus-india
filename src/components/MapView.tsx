import React, { useEffect, useRef } from 'react';
import { RouteStop, RouteGeometryPoint } from '@shared/types/bus.js';
import { AggregatedBusLocation } from '@shared/types/tracking.js';

interface MapViewProps {
  stops: RouteStop[];
  geometry?: RouteGeometryPoint[];
  busLocation?: AggregatedBusLocation | null;
  className?: string;
}

export const MapView: React.FC<MapViewProps> = ({
  stops,
  geometry,
  busLocation,
  className = "w-full h-80 rounded-2xl overflow-hidden border border-yatriwarm-200 shadow-card",
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);

  useEffect(() => {
    if (!mapContainerRef.current) return;

    // Check if Leaflet L global is loaded via index.html CDN
    const L = (window as any).L;
    if (!L) return;

    // Default center on Delhi or first stop
    const initialLat = stops.length > 0 ? stops[0].latitude : 28.6139;
    const initialLon = stops.length > 0 ? stops[0].longitude : 77.2090;

    if (!mapInstanceRef.current) {
      const map = L.map(mapContainerRef.current, {
        zoomControl: true,
        scrollWheelZoom: false,
      }).setView([initialLat, initialLon], 12);

      // OpenStreetMap standard tiles (₹0 free tier respecting attribution)
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        maxZoom: 18,
      }).addTo(map);

      mapInstanceRef.current = map;
    }

    const map = mapInstanceRef.current;

    // Clear existing layers other than tile layer
    map.eachLayer((layer: any) => {
      if (layer instanceof L.Marker || layer instanceof L.Polyline || layer instanceof L.Circle) {
        map.removeLayer(layer);
      }
    });

    const latLngs: [number, number][] = [];

    // Draw route polyline
    const pathPoints = geometry && geometry.length >= 2
      ? geometry
      : stops.map(s => ({ latitude: s.latitude, longitude: s.longitude }));

    for (const pt of pathPoints) {
      latLngs.push([pt.latitude, pt.longitude]);
    }

    if (latLngs.length >= 2) {
      const polyline = L.polyline(latLngs, {
        color: '#0E4D34', // Brand Deep Green
        weight: 5,
        opacity: 0.85,
        smoothFactor: 1,
      }).addTo(map);

      map.fitBounds(polyline.getBounds(), { padding: [30, 30] });
    }

    // Add Stop Markers
    stops.forEach((stop, idx) => {
      const isTerminus = idx === 0 || idx === stops.length - 1;
      const markerColor = isTerminus ? '#0E4D34' : '#10B981';

      const stopIcon = L.divIcon({
        className: 'custom-stop-marker',
        html: `<div style="background-color: ${markerColor}; width: 14px; height: 14px; border: 2px solid white; border-radius: 50%; box-shadow: 0 1px 4px rgba(0,0,0,0.3);"></div>`,
        iconSize: [14, 14],
        iconAnchor: [7, 7],
      });

      L.marker([stop.latitude, stop.longitude], { icon: stopIcon })
        .addTo(map)
        .bindPopup(`<strong>${stop.stopSequence}. ${stop.stopName}</strong><br/>Scheduled: ${stop.scheduledArrivalTime || 'N/A'}`);
    });

    // Add Bus Marker if location exists
    if (busLocation && busLocation.latitude && busLocation.longitude) {
      const isLive = busLocation.displayState === 'LIVE';
      const busMarkerColor = isLive ? '#059669' : '#0284C7';

      const busIcon = L.divIcon({
        className: 'custom-bus-marker',
        html: `
          <div style="position: relative; display: flex; align-items: center; justify-content: center;">
            ${isLive ? '<div style="position: absolute; width: 36px; height: 36px; background-color: rgba(16, 185, 129, 0.35); border-radius: 50%; animation: pulse-ring 2s infinite;"></div>' : ''}
            <div style="background-color: ${busMarkerColor}; color: white; width: 28px; height: 28px; border: 2px solid white; border-radius: 50%; display: flex; align-items: center; justify-content: center; box-shadow: 0 2px 8px rgba(0,0,0,0.4); font-size: 14px;">
              🚌
            </div>
          </div>
        `,
        iconSize: [28, 28],
        iconAnchor: [14, 14],
      });

      L.marker([busLocation.latitude, busLocation.longitude], { icon: busIcon })
        .addTo(map)
        .bindPopup(`<strong>Bus Location (${busLocation.displayState})</strong><br/>${busLocation.statusExplanation}`);
    }

    return () => {};
  }, [stops, geometry, busLocation]);

  return (
    <div className={className}>
      <div ref={mapContainerRef} className="w-full h-full min-h-[300px] z-10" />
    </div>
  );
};
