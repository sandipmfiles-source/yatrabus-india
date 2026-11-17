import { PagesContext, json, unavailable, parsePayload } from "../../../_lib/api";
import { parseServiceDate, routeHasServiceFilter, serviceDateParams } from "../../../_lib/serviceCalendar";

type Stop = {
  stopId: string;
  stopName: string;
  stopSequence: number;
  arrivalOffsetMinutes: number;
  departureOffsetMinutes: number;
  latitude?: number;
  longitude?: number;
};
type Route = { id: string; stops?: Stop[] };
type IndexedLeg = {
  payload_json: string;
  board_sequence: number;
  alight_sequence: number;
  board_departure: number;
  alight_arrival: number;
};
type IndexedBoard = { payload_json: string };

export async function onRequestGet({ request, env }: PagesContext): Promise<Response> {
  if (!env.DB) return unavailable();
  const url = new URL(request.url);
  const origin = (url.searchParams.get("origin") || url.searchParams.get("from") || "").trim();
  const destination = (url.searchParams.get("destination") || url.searchParams.get("to") || "").trim();
  const dateValue = url.searchParams.get("date");
  const serviceDate = dateValue ? parseServiceDate(dateValue) : null;
  if (dateValue && !serviceDate) return json({ success: false, error: "Date must be a valid YYYY-MM-DD value" }, 400);
  const dateParams = serviceDate ? serviceDateParams(serviceDate) : [];
  if (!origin || !destination) {
    return json({ success: false, error: "Origin and destination place IDs are required" }, 400);
  }
  if (origin === destination) {
    return json({ success: true, directRoutes: [], transferRoutes: [], data: { directRoutes: [], transferRoutes: [] }, meta: { directCount: 0, transferCount: 0 } });
  }

  try {
    // The indexed stop table avoids loading every route into memory for each search.
    const directRows = await env.DB.prepare(`
      SELECT r.payload_json,
             board.stop_sequence AS board_sequence,
             alight.stop_sequence AS alight_sequence,
             board.departure_offset_minutes AS board_departure,
             alight.arrival_offset_minutes AS alight_arrival
      FROM route_stops AS board
      JOIN route_stops AS alight
        ON alight.route_id = board.route_id
       AND alight.stop_id = ?
       AND alight.stop_sequence > board.stop_sequence
      JOIN routes AS r ON r.id = board.route_id
      WHERE board.stop_id = ?
        AND r.status = 'active'
        ${serviceDate ? `AND ${routeHasServiceFilter("r")}` : ""}
      ORDER BY (alight.arrival_offset_minutes - board.departure_offset_minutes), r.name
      LIMIT 50
    `).bind(destination, origin, ...dateParams).all<IndexedLeg>();

    const directRoutes = (directRows.results || []).map(row => {
      const route = parsePayload(row) as Route | null;
      if (!route) return null;
      return {
        route,
        boardStopSequence: Number(row.board_sequence),
        alightStopSequence: Number(row.alight_sequence),
        stopsCount: Math.max(2, Number(row.alight_sequence) - Number(row.board_sequence) + 1),
        estimatedMinutes: Math.max(10, Number(row.alight_arrival) - Number(row.board_departure))
      };
    }).filter(Boolean);

    const transferRoutes: Array<Record<string, unknown>> = [];
    if (directRoutes.length <= 2) {
      const firstRows = await env.DB.prepare(`
        SELECT DISTINCT r.payload_json
        FROM route_stops AS board
        JOIN routes AS r ON r.id = board.route_id
        WHERE board.stop_id = ? AND r.status = 'active'
          ${serviceDate ? `AND ${routeHasServiceFilter("r")}` : ""}
        LIMIT 20
      `).bind(origin, ...dateParams).all<IndexedBoard>();

      const firstLegsByTransfer = new Map<string, Array<{ route: Route; originStop: Stop; transferStop: Stop }>>();
      for (const row of firstRows.results || []) {
        const route = parsePayload(row) as Route | null;
        const stops = route?.stops || [];
        const boardIndex = stops.findIndex(stop => stop.stopId === origin);
        if (!route || boardIndex < 0) continue;
        const originStop = stops[boardIndex];
        for (const transferStop of stops.slice(boardIndex + 1, boardIndex + 11)) {
          if (!transferStop.stopId || !transferStop.stopName) continue;
          const legs = firstLegsByTransfer.get(transferStop.stopId) || [];
          if (legs.length < 4) legs.push({ route, originStop, transferStop });
          firstLegsByTransfer.set(transferStop.stopId, legs);
        }
      }

      const transferIds = [...firstLegsByTransfer.keys()].slice(0, 40);
      if (transferIds.length) {
        const placeholders = transferIds.map(() => "?").join(",");
        const secondRows = await env.DB.prepare(`
          SELECT second.payload_json,
                 board.stop_id AS transfer_stop_id,
                 board.stop_sequence AS board_sequence,
                 alight.stop_sequence AS alight_sequence,
                 board.departure_offset_minutes AS board_departure,
                 alight.arrival_offset_minutes AS alight_arrival
          FROM route_stops AS board
          JOIN route_stops AS alight
            ON alight.route_id = board.route_id
           AND alight.stop_id = ?
           AND alight.stop_sequence > board.stop_sequence
          JOIN routes AS second ON second.id = board.route_id
          WHERE board.stop_id IN (${placeholders})
            AND second.status = 'active'
            ${serviceDate ? `AND ${routeHasServiceFilter("second")}` : ""}
          ORDER BY (alight.arrival_offset_minutes - board.departure_offset_minutes)
          LIMIT 100
        `).bind(destination, ...transferIds, ...dateParams).all<IndexedLeg & { transfer_stop_id: string }>();

        const placeRows = await env.DB.prepare(`
          SELECT id, payload_json FROM places WHERE id IN (${placeholders})
        `).bind(...transferIds).all<{ id: string; payload_json: string }>();
        const places = new Map((placeRows.results || []).map(row => [row.id, parsePayload(row)]));
        const seen = new Set<string>();

        for (const row of secondRows.results || []) {
          const secondRoute = parsePayload(row) as Route | null;
          if (!secondRoute) continue;
          const firstLegs = firstLegsByTransfer.get(row.transfer_stop_id) || [];
          for (const first of firstLegs) {
            if (first.route.id === secondRoute.id) continue;
            const key = first.route.id + "|" + secondRoute.id + "|" + row.transfer_stop_id;
            if (seen.has(key)) continue;
            const transferPlace = places.get(row.transfer_stop_id);
            if (!transferPlace) continue;
            const minsA = first.transferStop.arrivalOffsetMinutes - first.originStop.departureOffsetMinutes;
            const minsB = Number(row.alight_arrival) - Number(row.board_departure);
            transferRoutes.push({
              firstRoute: first.route,
              secondRoute,
              transferPlace,
              totalEstimatedMinutes: Math.max(10, minsA) + Math.max(10, minsB) + 15
            });
            seen.add(key);
            if (transferRoutes.length >= 30) break;
          }
          if (transferRoutes.length >= 30) break;
        }
      }
    }

    return json({
      success: true,
      directRoutes,
      transferRoutes,\n      data: { directRoutes, transferRoutes },
      meta: { directCount: directRoutes.length, transferCount: transferRoutes.length, serviceDate: serviceDate?.date || null }
    });
  } catch {
    return json({ success: false, error: "Route search is temporarily unavailable." }, 503);
  }
}
