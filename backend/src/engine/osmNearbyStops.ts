export type OsmNearbyStop = {
  place: { id: string; canonicalName: string; latitude: number; longitude: number };
  distanceMeters: number;
  kind: 'BUS_STAND' | 'BUS_STOP';
  feedName: 'OpenStreetMap';
  routeCount: 0;
  source: 'OPENSTREETMAP';
};

export function mapOsmNearbyStops(
  elements: any[],
  latitude: number,
  longitude: number,
  radiusMeters = 5000,
  limit = 20,
): OsmNearbyStop[] {
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude) ||
      latitude < 6 || latitude > 38 || longitude < 68 || longitude > 98) return [];
  const radians = (value: number) => value * Math.PI / 180;
  const distance = (lat: number, lon: number) => {
    const dLat = radians(lat - latitude), dLon = radians(lon - longitude);
    const a = Math.sin(dLat / 2) ** 2 +
      Math.cos(radians(latitude)) * Math.cos(radians(lat)) * Math.sin(dLon / 2) ** 2;
    return 6371000 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  };
  const seen = new Set<string>();
  const output: OsmNearbyStop[] = [];
  for (const element of Array.isArray(elements) ? elements : []) {
    const tags = element?.tags || {};
    const isStand = tags.amenity === 'bus_station' ||
      tags.public_transport === 'station' ||
      /\b(isbt|bus\s*(stand|station|terminal|depot)|terminal|depot)\b/i.test(String(tags.name || ''));
    const isStop = tags.highway === 'bus_stop' ||
      tags.public_transport === 'platform' ||
      tags.public_transport === 'stop_position' ||
      tags.bus === 'yes';
    if (!isStand && !isStop) continue;
    const lat = Number(element.lat ?? element.center?.lat);
    const lon = Number(element.lon ?? element.center?.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lon) || lat < 6 || lat > 38 || lon < 68 || lon > 98) continue;
    const meters = distance(lat, lon);
    if (meters > radiusMeters) continue;
    const name = String(tags.name || tags['name:en'] || tags['name:hi'] || tags.official_name || tags.ref || '').trim();
    if (!name) continue;
    const dedupe = name.toLocaleLowerCase('en-IN') + ':' + lat.toFixed(4) + ':' + lon.toFixed(4);
    if (seen.has(dedupe)) continue;
    seen.add(dedupe);
    output.push({
      place: { id: 'osm-bus-stop-' + String(element.type || 'node') + '-' + String(element.id || dedupe), canonicalName: name, latitude: lat, longitude: lon },
      distanceMeters: Math.round(meters),
      kind: isStand ? 'BUS_STAND' : 'BUS_STOP',
      feedName: 'OpenStreetMap',
      routeCount: 0,
      source: 'OPENSTREETMAP',
    });
  }
  return output.sort((a, b) =>
    (a.kind === b.kind ? 0 : a.kind === 'BUS_STAND' ? -1 : 1) ||
    a.distanceMeters - b.distanceMeters || a.place.canonicalName.localeCompare(b.place.canonicalName, 'en-IN')
  ).slice(0, Math.max(1, Math.min(40, limit)));
}
