import { PagesContext, json, unavailable, parsePayload } from "../../../_lib/api";
type Stop = { stopId: string; stopName: string; stopSequence: number; arrivalOffsetMinutes: number; departureOffsetMinutes: number };
type Route = { id: string; stops?: Stop[] };
export async function onRequestGet({ request, env }: PagesContext): Promise<Response> {
  if (!env.DB) return unavailable();
  const url = new URL(request.url), origin = url.searchParams.get("origin") || "", destination = url.searchParams.get("destination") || "";
  if (!origin || !destination) return json({ success: false, error: "Origin and destination place IDs are required" }, 400);
  if (origin === destination) return json({ success: true, data: { directRoutes: [], transferRoutes: [] }, meta: { directCount: 0, transferCount: 0 } });
  try {
    const rows = await env.DB.prepare("SELECT payload_json FROM routes WHERE status = 'active'").all<{payload_json:string}>();
    const routes = (rows.results || []).map(parsePayload).filter(Boolean) as Route[];
    const directRoutes:any[] = [], transferRoutes:any[] = [];
    for (const route of routes) {
      const stops = route.stops || [];
      const board = stops.findIndex(s => s.stopId === origin), alight = stops.findIndex(s => s.stopId === destination);
      if (board >= 0 && alight > board) {
        const a = stops[board], b = stops[alight];
        directRoutes.push({ route, boardStopSequence: a.stopSequence, alightStopSequence: b.stopSequence,
          stopsCount: alight-board+1, estimatedMinutes: Math.max(10, b.arrivalOffsetMinutes-a.departureOffsetMinutes) });
      }
    }
    if (directRoutes.length <= 2) {
      for (const first of routes) {
        const a = (first.stops || []).findIndex(s => s.stopId === origin);
        if (a < 0) continue;
        for (let i=a+1; i<(first.stops || []).length; i++) {
          const transfer = first.stops![i];
          for (const second of routes) {
            if (first.id === second.id) continue;
            const secondStops = second.stops || [];
            const b = secondStops.findIndex(s => s.stopId === transfer.stopId), c = secondStops.findIndex(s => s.stopId === destination);
            if (b >= 0 && c > b) {
              const transferRow = await env.DB!.prepare("SELECT payload_json FROM places WHERE id = ? LIMIT 1").bind(transfer.stopId).first<{payload_json:string}>();
              const transferPlace = parsePayload(transferRow);
              if (!transferPlace) continue;
              const minsA = transfer.arrivalOffsetMinutes-first.stops![a].departureOffsetMinutes;
              const minsB = secondStops[c].arrivalOffsetMinutes-secondStops[b].departureOffsetMinutes;
              transferRoutes.push({ firstRoute:first, secondRoute:second, transferPlace, totalEstimatedMinutes:minsA+minsB+15 });
            }
          }
        }
      }
    }
    return json({ success:true, data:{ directRoutes, transferRoutes }, meta:{ directCount:directRoutes.length, transferCount:transferRoutes.length } });
  } catch { return json({ success:false, error:"Route search is temporarily unavailable." },503); }
}
