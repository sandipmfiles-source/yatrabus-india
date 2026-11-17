import { PagesContext, json, unavailable, boundedInt, parsePayload } from "../../../_lib/api";


type OSMStop = {
  place: { id: string; canonicalName: string; latitude: number; longitude: number; district?: string };
  distanceMeters: number;
  kind: "BUS_STAND" | "BUS_STOP";
  feedName: string;
  routeCount: number;
  source: "OPENSTREETMAP";
};

const osmNearbyCache = new Map<string, { expiresAt: number; stops: OSMStop[] }>();

async function fetchOsmNearbyStops(lat: number, lng: number, radiusMeters: number): Promise<OSMStop[]> {
  const cacheKey = lat.toFixed(3) + ":" + lng.toFixed(3) + ":" + radiusMeters;
  const cached = osmNearbyCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) return cached.stops;

  const query = '[out:json][timeout:15];(' +
    'nwr(around:' + radiusMeters + ',' + lat + ',' + lng + ')["amenity"="bus_station"];' +
    'nwr(around:' + radiusMeters + ',' + lat + ',' + lng + ')["highway"="bus_stop"];' +
    'nwr(around:' + radiusMeters + ',' + lat + ',' + lng + ')["public_transport"~"^(station|platform|stop_position)$"];' +
    'nwr(around:' + radiusMeters + ',' + lat + ',' + lng + ')[bus=yes];' +
    ');out center tags 100;';

  let payload: { elements?: Array<Record<string, any>> } | null = null;
  const endpoints: Array<{ url: string; method: "POST" | "GET" }> = [
    { url: "https://overpass-api.de/api/interpreter", method: "POST" },
    { url: "https://overpass.kumi.systems/api/interpreter", method: "POST" },
    { url: "https://overpass.private.coffee/api/interpreter", method: "GET" },
  ];
  let emptyPayload: { elements?: Array<Record<string, any>> } | null = null;
  let lastFailure = "NO_RESPONSE";
  for (const endpoint of endpoints) {
    try {
      const requestUrl = endpoint.method === "GET" ? endpoint.url + "?data=" + encodeURIComponent(query) : endpoint.url;
      const response = await fetch(requestUrl, {
        method: endpoint.method,
        headers: {
          "Accept": "application/json",
          ...(endpoint.method === "POST" ? { "Content-Type": "application/x-www-form-urlencoded" } : {}),
        },
        ...(endpoint.method === "POST" ? { body: "data=" + encodeURIComponent(query) } : {}),
        signal: AbortSignal.timeout(18000),
      });
      if (!response.ok) {
        lastFailure = "HTTP_" + response.status;
        continue;
      }
      const candidate = await response.json() as { elements?: Array<Record<string, any>> };
      if (!Array.isArray(candidate.elements)) {
        lastFailure = "INVALID_JSON_SHAPE";
        continue;
      }
      if (candidate.elements.length > 0) {
        payload = candidate;
        break;
      }
      emptyPayload = candidate;
      lastFailure = "EMPTY_RESULT";
    } catch (error) {
      lastFailure = error instanceof Error ? error.name : "FETCH_FAILED";
    }
  }
  payload = payload || emptyPayload;
  if (!payload) throw new Error("OSM_UPSTREAM_" + lastFailure);
  const radians = (value: number) => value * Math.PI / 180;
  const distance = (aLat: number, aLng: number) => {
    const dLat = radians(aLat - lat), dLng = radians(aLng - lng);
    const a = Math.sin(dLat / 2) ** 2 +
      Math.cos(radians(lat)) * Math.cos(radians(aLat)) * Math.sin(dLng / 2) ** 2;
    return 6371000 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  };
  const seen = new Set<string>();
  const stops: OSMStop[] = [];
  for (const element of Array.isArray(payload.elements) ? payload.elements : []) {
    const tags = element.tags || {};
    const rawName = String(tags.name || tags["name:en"] || tags["name:hi"] || tags.official_name || tags.ref || "").trim();
    const isStand = tags.amenity === "bus_station" || tags.public_transport === "station" ||
      /\b(isbt|bus\s*(stand|station|terminal|depot)|terminal|depot)\b/i.test(rawName);
    const isStop = tags.highway === "bus_stop" || tags.public_transport === "platform" ||
      tags.public_transport === "stop_position" || tags.bus === "yes";
    if (!isStand && !isStop) continue;
    const name = rawName || String(tags["addr:street"] || tags["addr:suburb"] || tags.operator || (isStand ? "Bus stand" : "Bus stop")).trim();
    const stopLat = Number(element.lat ?? element.center?.lat);
    const stopLng = Number(element.lon ?? element.center?.lon);
    if (!Number.isFinite(stopLat) || !Number.isFinite(stopLng) ||
        stopLat < 6 || stopLat > 38 || stopLng < 68 || stopLng > 98) continue;
    const meters = distance(stopLat, stopLng);
    if (meters > radiusMeters) continue;
    const dedupe = name.toLocaleLowerCase("en-IN") + ":" + stopLat.toFixed(4) + ":" + stopLng.toFixed(4);
    if (seen.has(dedupe)) continue;
    seen.add(dedupe);
    stops.push({
      place: {
        id: "osm-bus-stop-" + String(element.type || "node") + "-" + String(element.id || dedupe),
        canonicalName: name,
        latitude: stopLat,
        longitude: stopLng,
        district: String(tags["addr:district"] || tags["addr:city"] || tags["addr:suburb"] || "") || undefined,
      },
      distanceMeters: Math.round(meters),
      kind: isStand ? "BUS_STAND" : "BUS_STOP",
      feedName: "OpenStreetMap",
      routeCount: 0,
      source: "OPENSTREETMAP",
    });
  }
  stops.sort((a, b) =>
    (a.kind === b.kind ? 0 : a.kind === "BUS_STAND" ? -1 : 1) ||
    a.distanceMeters - b.distanceMeters ||
    a.place.canonicalName.localeCompare(b.place.canonicalName, "en-IN")
  );
  const result = stops.slice(0, 40);
  if (osmNearbyCache.size > 300) osmNearbyCache.delete(osmNearbyCache.keys().next().value as string);
  osmNearbyCache.set(cacheKey, { expiresAt: Date.now() + 10 * 60 * 1000, stops: result });
  return result;
}

export async function onRequestGet({ request, env }: PagesContext): Promise<Response> {
  if (!env.DB) return unavailable();
  const url = new URL(request.url);
  const lat = Number(url.searchParams.get("lat"));
  const rawLng = url.searchParams.get("lng") ?? url.searchParams.get("lon");
  const lng = Number(rawLng);
  const rawKm = url.searchParams.get("radiusKm");
  const rawMeters = url.searchParams.get("radius");
  const radiusKm = Math.max(0.1, Math.min(100,
    rawKm !== null ? Number(rawKm) : rawMeters !== null ? Number(rawMeters) / 1000 : 5
  ));
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180 || !Number.isFinite(radiusKm))
    return json({ success: false, error: "Valid latitude and longitude are required" }, 400);

  const latDelta = radiusKm / 110.574;
  const lngDelta = radiusKm / (111.320 * Math.max(0.01, Math.cos(lat * Math.PI / 180)));
  try {
    const rows = await env.DB.prepare(`
      SELECT id, place_type, payload_json, latitude, longitude
      FROM places
      WHERE LOWER(place_type) IN ('bus_stop','bus_terminal','bus_station','bus_stand')
        AND latitude BETWEEN ? AND ?
        AND longitude BETWEEN ? AND ?
    `).bind(lat-latDelta, lat+latDelta, lng-lngDelta, lng+lngDelta)
      .all<{id:string;place_type:string;payload_json:string;latitude:number;longitude:number}>();

    const rad = (x:number) => x * Math.PI / 180;
    const places = (rows.results || []).map(row => {
      const place = parsePayload(row);
      if (!place) return null;
      const dLat = rad(Number(row.latitude)-lat), dLng = rad(Number(row.longitude)-lng);
      const a = Math.sin(dLat/2)**2 + Math.cos(rad(lat))*Math.cos(rad(Number(row.latitude)))*Math.sin(dLng/2)**2;
      const distanceKm = 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
      return distanceKm <= radiusKm ? { ...place, distanceKm: Math.round(distanceKm*100)/100 } : null;
    }).filter(Boolean).sort((a:any,b:any)=>a.distanceKm-b.distanceKm)
      .slice(0, boundedInt(url.searchParams.get("limit"),10,1,50));

    const routeCounts = new Map<string, number>();
    if (places.length) {
      try {
        const ids = places.map((place:any) => String(place.id));
        const placeholders = ids.map(() => "?").join(",");
        const counts = await env.DB.prepare(`
          SELECT stop_id, COUNT(DISTINCT route_id) AS route_count
          FROM route_stops WHERE stop_id IN (${placeholders}) GROUP BY stop_id
        `).bind(...ids).all<{stop_id:string;route_count:number}>();
        for (const row of counts.results || []) routeCounts.set(row.stop_id, Number(row.route_count || 0));
      } catch { /* Directory results remain useful when route index is not yet populated. */ }
    }

    const directoryStops = places.map((place:any) => ({
      place,
      distanceMeters: Math.round(Number(place.distanceKm) * 1000),
      kind: ["bus_terminal","bus_station","bus_stand"].includes(String(place.placeType || "")) ? "BUS_STAND" : "BUS_STOP",
      feedName: place.sourceDataset || "",
      routeCount: routeCounts.get(String(place.id)) || 0,
      source: String(place.sourceDataset || "").toUpperCase() === "OPENSTREETMAP"
        ? "OPENSTREETMAP"
        : "YATRIBUS_DIRECTORY"
    }));

    // D1 is the curated directory, not a complete inventory of every local bus stop.
    // Supplement it with mapped OSM stops so towns without a published GTFS feed
    // can still discover nearby physical bus stands/stops.
    let osmStops: OSMStop[] = [];
    let osmAvailable = true;
    let osmError: string | null = null;
    try {
      osmStops = await fetchOsmNearbyStops(lat, lng, Math.round(radiusKm * 1000));
    } catch (error) {
      osmAvailable = false;
      osmError = error instanceof Error ? error.message.slice(0, 80) : "OSM_UPSTREAM_FAILED";
    }
    const knownNames = new Set(directoryStops.map((item:any) =>
      String(item.place?.canonicalName || "").trim().toLocaleLowerCase("en-IN")
    ));
    const uniqueOsmStops = osmStops.filter(item =>
      !knownNames.has(item.place.canonicalName.trim().toLocaleLowerCase("en-IN"))
    );
    const stops = [...directoryStops, ...uniqueOsmStops]
      .sort((a:any, b:any) =>
        (a.kind === b.kind ? 0 : a.kind === "BUS_STAND" ? -1 : 1) ||
        a.distanceMeters - b.distanceMeters ||
        String(a.place?.canonicalName || "").localeCompare(String(b.place?.canonicalName || ""), "en-IN")
      )
      .slice(0, boundedInt(url.searchParams.get("limit"), 10, 1, 50));
    return json({
      success: true,
      data: stops.map((item:any) => item.place),
      stops,
      meta: {
        count: stops.length,
        radiusKm,
        sources: {
          yatribusDirectory: directoryStops.filter((item:any) => item.source !== "OPENSTREETMAP").length,
          openStreetMap: directoryStops.filter((item:any) => item.source === "OPENSTREETMAP").length + uniqueOsmStops.length
        },
        osmAvailable,
        osmError,
        timetableVerified: false
      },
      attribution: "Mapped stop data © OpenStreetMap contributors. OSM locations do not by themselves verify current bus service or timetable."
    });
  } catch {
    return json({ success: false, error: "Nearby bus-stop search is temporarily unavailable." }, 503);
  }
}
