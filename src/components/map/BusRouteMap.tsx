import React, { useEffect, useRef, useState } from 'react';
import { Route, LocationObservation } from '../../types';
import { MapPin, Navigation, Info, AlertTriangle } from 'lucide-react';
import { t } from '../../i18n';

interface BusRouteMapProps {
  route?: Route;
  activeObservation?: LocationObservation | null;
  selectedStopId?: string;
  onSelectStop?: (stopId: string) => void;
  className?: string;
}

export const BusRouteMap: React.FC<BusRouteMapProps> = ({
  route,
  activeObservation,
  selectedStopId,
  onSelectStop,
  className = "w-full h-80 rounded-2xl"
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const markersLayerRef = useRef<any>(null);
  const polylineLayerRef = useRef<any>(null);
  const [mapError, setMapError] = useState(false);

  useEffect(() => {
    if (!mapContainerRef.current) return;

    // Check if Leaflet is loaded
    const L = (window as any).L;
    if (!L) {
      setMapError(true);
      return;
    }

    try {
      if (!mapInstanceRef.current) {
        // Default center: India center (approx 21.0, 78.0)
        const initialCenter = route?.polyline?.[0] || [28.6139, 77.2090];
        const map = L.map(mapContainerRef.current, {
          center: initialCenter,
          zoom: 12,
          zoomControl: false,
        });

        // Add zoom control at bottom right for thumb accessibility
        L.control.zoom({ position: 'bottomright' }).addTo(map);

        // Add OpenStreetMap tiles with proper attribution
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          maxZoom: 19,
          attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        }).addTo(map);

        markersLayerRef.current = L.layerGroup().addTo(map);
        polylineLayerRef.current = L.layerGroup().addTo(map);
        mapInstanceRef.current = map;
      }
    } catch (e) {
      console.error('Error initializing map:', e);
      setMapError(true);
    }

    return () => {
      // Keep map instance or cleanup on unmount
    };
  }, []);

  // Update Route Polyline & Markers
  useEffect(() => {
    const L = (window as any).L;
    if (!L || !mapInstanceRef.current) return;

    try {
      markersLayerRef.current.clearLayers();
      polylineLayerRef.current.clearLayers();

      if (route && route.polyline && route.polyline.length > 0) {
        // Draw route polyline
        const polyline = L.polyline(route.polyline, {
          color: '#0e5a36',
          weight: 5,
          opacity: 0.85,
          smoothFactor: 1,
          lineJoin: 'round'
        }).addTo(polylineLayerRef.current);

        // Fit map bounds to route
        mapInstanceRef.current.fitBounds(polyline.getBounds(), { padding: [30, 30] });

        // Add stop markers
        route.stops.forEach((stop, index) => {
          const isSelected = selectedStopId === stop.stopId;
          const isOrigin = index === 0;
          const isDestination = index === route.stops.length - 1;

          const pinColor = isOrigin ? '#16a34a' : isDestination ? '#dc2626' : isSelected ? '#2563eb' : '#0e5a36';

          const stopIcon = L.divIcon({
            className: 'custom-stop-marker',
            html: `
              <div style="
                width: 22px; 
                height: 22px; 
                background: #ffffff; 
                border: 3px solid ${pinColor}; 
                border-radius: 50%; 
                display: flex; 
                align-items: center; 
                justify-content: center; 
                box-shadow: 0 2px 4px rgba(0,0,0,0.25);
                font-size: 10px;
                font-weight: bold;
                color: ${pinColor};
              ">
                ${stop.stopSequence}
              </div>
            `,
            iconSize: [22, 22],
            iconAnchor: [11, 11]
          });

          const marker = L.marker([stop.latitude, stop.longitude], { icon: stopIcon })
            .bindPopup(`
              <div style="font-family: sans-serif; font-size: 13px; line-height: 1.4;">
                <b style="color: #0e5a36;">${stop.stopName}</b><br/>
                <span style="color: #64748b;">Stop #${stop.stopSequence} • +${stop.arrivalOffsetMinutes} min</span><br/>
                <span style="color: #64748b;">${stop.distanceFromOriginKm} km from origin</span>
              </div>
            `)
            .addTo(markersLayerRef.current);

          marker.on('click', () => {
            if (onSelectStop) onSelectStop(stop.stopId);
          });
        });
      }

      // Add Live Bus Location Marker
      if (activeObservation) {
        const isLive = activeObservation.trackingStatus === 'live_gps';
        const busColor = isLive ? '#10b981' : '#f59e0b';

        const busIcon = L.divIcon({
          className: 'custom-bus-live-marker',
          html: `
            <div style="position: relative; width: 34px; height: 34px;">
              ${isLive ? `<div style="position: absolute; inset: -4px; border-radius: 50%; background: ${busColor}; opacity: 0.4; animation: ping 1.5s cubic-bezier(0, 0, 0.2, 1) infinite;"></div>` : ''}
              <div style="
                width: 34px; 
                height: 34px; 
                background: ${busColor}; 
                border: 2px solid #ffffff; 
                border-radius: 50%; 
                display: flex; 
                align-items: center; 
                justify-content: center; 
                box-shadow: 0 4px 6px -1px rgba(0,0,0,0.3);
                color: #ffffff;
              ">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2"/>
                  <circle cx="7" cy="17" r="2"/>
                  <path d="M9 17h6"/>
                  <circle cx="17" cy="17" r="2"/>
                </svg>
              </div>
            </div>
          `,
          iconSize: [34, 34],
          iconAnchor: [17, 17]
        });

        L.marker([activeObservation.latitude, activeObservation.longitude], { icon: busIcon, zIndexOffset: 1000 })
          .bindPopup(`
            <div style="font-family: sans-serif; font-size: 13px;">
              <b style="color: ${busColor};">${isLive ? '🟢 Live Bus GPS' : '🟠 Last Known Location'}</b><br/>
              <span>Speed: ${Math.round(activeObservation.speedKmh || 0)} km/h</span><br/>
              <span style="font-size: 11px; color: #64748b;">Confidence: ${activeObservation.confidence.toUpperCase()}</span>
            </div>
          `)
          .addTo(markersLayerRef.current);
      }
    } catch (err) {
      console.error('Error rendering map layers:', err);
    }
  }, [route, activeObservation, selectedStopId]);

  if (mapError) {
    return (
      <div className={`flex flex-col items-center justify-center bg-surface-subtle border border-surface-border p-6 text-center text-slate-600 ${className}`}>
        <AlertTriangle className="w-8 h-8 text-amber-500 mb-2" />
        <p className="font-semibold text-slate-800">Map view is running in offline / data-saver mode</p>
        <p className="text-xs text-slate-500 mt-1 max-w-sm">
          Route stops and timetable are fully accessible in the stop sequence list below.
        </p>
      </div>
    );
  }

  return (
    <div className={`relative border border-surface-border overflow-hidden shadow-sm ${className}`}>
      {/* Map DOM Container */}
      <div ref={mapContainerRef} className="w-full h-full min-h-[300px]" />

      {/* Floating Status Pill */}
      {activeObservation && (
        <div className="absolute top-3 left-3 z-[400] flex items-center space-x-2 px-3 py-1.5 rounded-full bg-white/95 backdrop-blur-sm border border-surface-border shadow-md text-xs font-semibold">
          <span className={`w-2.5 h-2.5 rounded-full ${activeObservation.trackingStatus === 'live_gps' ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`} />
          <span className="text-slate-800">
            {activeObservation.trackingStatus === 'live_gps' ? t('status_live_gps') : t('status_last_known')}
          </span>
          <span className="text-slate-400">•</span>
          <span className="text-slate-500 font-normal">
            {activeObservation.confidence === 'high' ? t('confidence_high') : t('confidence_moderate')}
          </span>
        </div>
      )}
    </div>
  );
};
