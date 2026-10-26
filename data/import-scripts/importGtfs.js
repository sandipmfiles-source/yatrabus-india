/**
 * Repeatable GTFS (General Transit Feed Specification) Parser
 * Ingests agency.txt, routes.txt, stops.txt, trips.txt, and stop_times.txt
 */

export function parseCsvRows(csvString) {
  if (!csvString) return [];
  const lines = csvString.trim().split(/\r?\n/);
  if (lines.length < 2) return [];

  const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
  const rows = [];

  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(',').map(v => v.trim().replace(/^"|"$/g, ''));
    if (values.length === headers.length) {
      const row = {};
      headers.forEach((h, idx) => {
        row[h] = values[idx];
      });
      rows.push(row);
    }
  }

  return rows;
}

export function convertGtfsToYatraBus(gtfsData) {
  const { agencies = [], routes = [], stops = [], trips = [], stopTimes = [] } = gtfsData;

  const operators = agencies.map(a => ({
    id: `op-${a.agency_id || 'gov'}`,
    name: a.agency_name,
    shortCode: a.agency_id || a.agency_name.substring(0, 4).toUpperCase(),
    state: 'India Transit',
    serviceArea: 'Metropolitan / Regional Route',
    contactPhone: a.agency_phone || undefined,
    contactEmail: a.agency_email || undefined,
    isGovernment: true,
    verificationStatus: 'admin_verified'
  }));

  const places = stops.map(s => ({
    id: `plc-gtfs-${s.stop_id}`,
    canonicalName: s.stop_name,
    placeType: 'bus_stop',
    state: 'General',
    district: 'General',
    latitude: parseFloat(s.stop_lat),
    longitude: parseFloat(s.stop_lon),
    sourceDataset: 'GTFS Feed',
    verificationStatus: 'admin_verified',
    aliases: [],
    lastUpdated: new Date().toISOString()
  }));

  // Build Stop Times map by trip_id
  const stopTimesByTrip = new Map();
  stopTimes.forEach(st => {
    if (!stopTimesByTrip.has(st.trip_id)) {
      stopTimesByTrip.set(st.trip_id, []);
    }
    stopTimesByTrip.get(st.trip_id).push(st);
  });

  // Convert routes
  const convertedRoutes = routes.map(r => {
    // Find first trip for this route to get stops sequence
    const trip = trips.find(t => t.route_id === r.route_id);
    const tripStops = trip ? (stopTimesByTrip.get(trip.trip_id) || []) : [];
    tripStops.sort((a, b) => parseInt(a.stop_sequence) - parseInt(b.stop_sequence));

    const sequencedStops = tripStops.map((st, idx) => {
      const stopObj = places.find(p => p.id === `plc-gtfs-${st.stop_id}`);
      return {
        routeId: `rt-gtfs-${r.route_id}`,
        stopId: `plc-gtfs-${st.stop_id}`,
        stopName: stopObj ? stopObj.canonicalName : `Stop ${st.stop_id}`,
        stopSequence: idx + 1,
        arrivalOffsetMinutes: idx * 8, // Estimated 8 min per stop if raw time offset
        departureOffsetMinutes: idx * 8,
        distanceFromOriginKm: parseFloat((idx * 2.5).toFixed(1)),
        latitude: stopObj ? stopObj.latitude : 0,
        longitude: stopObj ? stopObj.longitude : 0
      };
    });

    const originStop = sequencedStops[0];
    const destStop = sequencedStops[sequencedStops.length - 1];

    return {
      id: `rt-gtfs-${r.route_id}`,
      routeNumber: r.route_short_name || r.route_id,
      name: r.route_long_name || `${r.route_short_name} Express`,
      operatorId: operators[0]?.id || 'op-gov',
      originPlaceId: originStop?.stopId || 'origin',
      originName: originStop?.stopName || 'Origin',
      destinationPlaceId: destStop?.stopId || 'destination',
      destinationName: destStop?.stopName || 'Destination',
      direction: 'up',
      durationMinutes: sequencedStops.length * 8,
      distanceKm: parseFloat((sequencedStops.length * 2.5).toFixed(1)),
      operatingDays: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
      status: 'active',
      verificationStatus: 'admin_verified',
      firstDepartureTime: '06:00',
      lastDepartureTime: '22:00',
      frequencyMinutes: 15,
      polyline: sequencedStops.map(s => [s.latitude, s.longitude]),
      stops: sequencedStops
    };
  });

  return { operators, places, routes: convertedRoutes };
}
