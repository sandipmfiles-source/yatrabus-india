import { PagesContext, json, unavailable, boundedInt, parsePayload } from "../../../_lib/api";

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
      WHERE place_type IN ('bus_stop','bus_terminal','bus_station','bus_stand')
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

    const stops = places.map((place:any) => ({
      place,
      distanceMeters: Math.round(Number(place.distanceKm) * 1000),
      kind: ["bus_terminal","bus_station","bus_stand"].includes(String(place.placeType || "")) ? "BUS_STAND" : "BUS_STOP",
      feedName: place.sourceDataset || "",
      routeCount: routeCounts.get(String(place.id)) || 0
    }));
    return json({ success: true, data: places, stops, meta: { count: places.length, radiusKm } });
  } catch {
    return json({ success: false, error: "Nearby bus-stop search is temporarily unavailable." }, 503);
  }
}
