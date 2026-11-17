import { PagesContext, json, unavailable, boundedInt, parsePayload } from "../../../_lib/api";
export async function onRequestGet({ request, env }: PagesContext): Promise<Response> {
  if (!env.DB) return unavailable();
  const url = new URL(request.url), lat = Number(url.searchParams.get("lat")), lng = Number(url.searchParams.get("lng"));
  const radiusKm = Math.max(0.1, Math.min(100, Number(url.searchParams.get("radiusKm")) || 5));
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180)
    return json({ success: false, error: "Valid latitude and longitude are required" }, 400);
  const latDelta = radiusKm / 110.574, lngDelta = radiusKm / (111.320 * Math.max(0.01, Math.cos(lat * Math.PI / 180)));
  try {
    const rows = await env.DB.prepare("SELECT payload_json, latitude, longitude FROM places WHERE place_type IN ('bus_stop','bus_terminal','bus_station','interchange') AND latitude BETWEEN ? AND ? AND longitude BETWEEN ? AND ?")
      .bind(lat-latDelta, lat+latDelta, lng-lngDelta, lng+lngDelta).all<{payload_json:string;latitude:number;longitude:number}>();
    const rad = (x:number) => x * Math.PI / 180;
    const data = (rows.results || []).map(row => {
      const p = parsePayload(row); if (!p) return null;
      const dLat = rad(Number(row.latitude)-lat), dLng = rad(Number(row.longitude)-lng);
      const a = Math.sin(dLat/2)**2 + Math.cos(rad(lat))*Math.cos(rad(Number(row.latitude)))*Math.sin(dLng/2)**2;
      const distanceKm = 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
      return distanceKm <= radiusKm ? { ...p, distanceKm: Math.round(distanceKm*100)/100 } : null;
    }).filter(Boolean).sort((a:any,b:any)=>a.distanceKm-b.distanceKm).slice(0, boundedInt(url.searchParams.get("limit"),10,1,50));
    return json({ success: true, data, meta: { count: data.length, radiusKm } });
  } catch { return json({ success: false, error: "Nearby place search is temporarily unavailable." }, 503); }
}
