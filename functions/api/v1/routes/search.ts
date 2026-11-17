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

async function resolvePlaceId(db: NonNullable<PagesContext["env"]["DB"]>, value: string): Promise<string | null> {
  const byId = await db.prepare("SELECT id FROM places WHERE id = ? LIMIT 1")
    .bind(value).first<{ id: string }>();
  if (byId?.id) return byId.id;

  const escaped = value.replace(/[\\%_]/g, "\\$&");
  const pattern = `%${escaped}%`;
  const prefix = `${escaped}%`;
  const rows = await db.prepare(`
    SELECT p.id, p.canonical_name, p.place_type, p.aliases_json,
           COUNT(DISTINCT active_route.id) AS active_route_count
    FROM places AS p
    LEFT JOIN route_stops AS rs ON rs.stop_id = p.id
    LEFT JOIN routes AS active_route ON active_route.id = rs.route_id AND active_route.status = 'active'
    WHERE p.canonical_name LIKE ? ESCAPE '\\' COLLATE NOCASE
       OR p.aliases_json LIKE ? ESCAPE '\\' COLLATE NOCASE
    GROUP BY p.id
    ORDER BY
      active_route_count DESC,
      CASE WHEN p.canonical_name = ? COLLATE NOCASE THEN 0
           WHEN p.canonical_name LIKE ? ESCAPE '\\' COLLATE NOCASE THEN 1
           ELSE 2 END,
      CASE WHEN p.place_type IN ('BUS_STOP','BUS_TERMINAL','BUS_STATION','TRANSIT_HUB','bus_stop','bus_terminal','bus_station') THEN 0 ELSE 1 END,
      p.canonical_name
    LIMIT 20
  `).bind(pattern, pattern, value, prefix)
    .all<{ id: string; canonical_name: string; place_type: string; aliases_json?: string; active_route_count: number }>();

  const candidates = rows.results || [];
  const query = value.normalize("NFKC").trim().toLocaleLowerCase("en-IN");
  const exactAlias = candidates.find(row => {
    try {
      const aliases = JSON.parse(row.aliases_json || "[]");
      return Array.isArray(aliases) && aliases.some((alias: unknown) =>
        String(alias).normalize("NFKC").trim().toLocaleLowerCase("en-IN") === query
      );
    } catch {
      return false;
    }
  });
  return (exactAlias || candidates[0])?.id || null;
}


export async function onRequestGet({ request, env }: PagesContext): Promise<Response> {
  if (!env.DB) return unavailable();
  const url = new URL(request.url);
  const originQuery = (url.searchParams.get("origin") || url.searchParams.get("from") || "").trim();
  const destinationQuery = (url.searchParams.get("destination") || url.searchParams.get("to") || "").trim();
  const dateValue = url.searchParams.get("date");
  const serviceDate = dateValue ? parseServiceDate(dateValue) : null;
  if (dateValue && !serviceDate) return json({ success: false, error: "Date must be a valid YYYY-MM-DD value" }, 400);
  const dateParams = serviceDate ? serviceDateParams(serviceDate) : [];
  if (!originQuery || !destinationQuery) {
    return json({ success: false, error: "Origin and destination are required." }, 400);
  }

  try {
    // The passenger app submits readable place names. Resolve them to the exact
    // D1 place IDs used by route_stops; older clients may submit IDs directly.
    const [origin, destination] = await Promise.all([
      resolvePlaceId(env.DB, originQuery),
      resolvePlaceId(env.DB, destinationQuery),
    ]);
    if (!origin || !destination) {
      return json({
        success: true,
        directRoutes: [],
        transferRoutes: [],
        data: { directRoutes: [], transferRoutes: [] },
        meta: {
          directCount: 0,
          transferCount: 0,
          unresolved: { origin: !origin, destination: !destination },
          message: "Choose a place suggestion that matches a mapped YatraBus stop or directory entry.",
        },
      });
    }
    if (origin === destination) {
      return json({ success: true, directRoutes: [], transferRoutes: [], data: { directRoutes: [], transferRoutes: [] }, meta: { directCount: 0, transferCount: 0 } });
    }

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
      transferRoutes,
      data: { directRoutes, transferRoutes },
      meta: { directCount: directRoutes.length, transferCount: transferRoutes.length, serviceDate: serviceDate?.date || null }
    });
  } catch {
    return json({ success: false, error: "Route search is temporarily unavailable." }, 503);
  }
}
