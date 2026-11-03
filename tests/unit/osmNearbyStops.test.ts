import { mapOsmNearbyStops } from '../../backend/src/engine/osmNearbyStops.js';

export function runOsmNearbyStopTests(assert: (description: string, pass: boolean) => void) {
  const elements = [
    { type: 'node', id: 1, lat: 22.346, lon: 87.232, tags: { amenity: 'bus_station', name: 'Kharagpur Bus Stand' } },
    { type: 'way', id: 2, center: { lat: 22.35, lon: 87.24 }, tags: { public_transport: 'platform', name: 'Town Road Bus Stop' } },
    { type: 'node', id: 3, lat: 22.9, lon: 87.9, tags: { highway: 'bus_stop', name: 'Far Bus Stop' } },
    { type: 'node', id: 4, lat: 22.347, lon: 87.233, tags: { highway: 'bus_stop' } },
    { type: 'node', id: 5, lat: 22.347, lon: 87.233, tags: { amenity: 'cafe', name: 'Cafe' } },
  ];
  const results = mapOsmNearbyStops(elements, 22.345, 87.233, 5000, 20);
  assert('OSM nearby search prioritizes named bus stands before ordinary stops', results.length === 2 && results[0].kind === 'BUS_STAND' && results[1].kind === 'BUS_STOP');
  assert('OSM way geometry uses its centre coordinates and preserves the stop name', results[1].place.canonicalName === 'Town Road Bus Stop' && results[1].place.latitude === 22.35);
  assert('OSM mapped stops are labelled separately from timetable-verified GTFS routes', results.every(item => item.source === 'OPENSTREETMAP' && item.routeCount === 0));
  assert('OSM nearby search rejects invalid coordinates and out-of-radius stops', mapOsmNearbyStops(elements, 0, 0, 5000).length === 0 && mapOsmNearbyStops(elements, 22.345, 87.233, 100).length < results.length);
}
