import { PagesContext, json, unavailable, boundedInt, parsePayload } from "../../../_lib/api";

type PlacePayload = Record<string, any>;

function normalise(value: unknown): string {
  return String(value || "").normalize("NFKC").trim().toLocaleLowerCase("en-IN");
}

export async function onRequestGet({ request, env }: PagesContext): Promise<Response> {
  if (!env.DB) return unavailable();
  const url = new URL(request.url);
  const q = (url.searchParams.get("q") || "").trim().slice(0, 100);
  const limit = boundedInt(url.searchParams.get("limit"), 8, 1, 20);
  if (q.length < 2) {
    return json({ success: true, data: [], results: [], meta: { totalResults: 0, query: q } });
  }

  try {
    const escaped = q.replace(/[\\%_]/g, "\\$&");
    const pattern = `%${escaped}%`;
    const prefix = `${escaped}%`;
    const result = await env.DB.prepare(`SELECT id, place_type, payload_json, canonical_name, state, district, aliases_json
      FROM places
      WHERE canonical_name LIKE ? ESCAPE '\\' COLLATE NOCASE
         OR state LIKE ? ESCAPE '\\' COLLATE NOCASE
         OR district LIKE ? ESCAPE '\\' COLLATE NOCASE
         OR aliases_json LIKE ? ESCAPE '\\' COLLATE NOCASE
      ORDER BY
        CASE
          WHEN canonical_name = ? COLLATE NOCASE THEN 0
          WHEN canonical_name LIKE ? ESCAPE '\\' COLLATE NOCASE THEN 1
          WHEN aliases_json LIKE ? ESCAPE '\\' COLLATE NOCASE THEN 2
          ELSE 3
        END,
        CASE WHEN place_type IN ('BUS_STOP','BUS_TERMINAL','BUS_STATION','TRANSIT_HUB','bus_stop','bus_terminal','bus_station') THEN 0 ELSE 1 END,
        canonical_name
      LIMIT ?`)
      .bind(pattern, pattern, pattern, pattern, q, prefix, pattern, limit)
      .all<{ id: string; place_type: string; payload_json: string; canonical_name: string; state?: string; district?: string; aliases_json?: string }>();

    const results = (result.results || []).flatMap(row => {
      const parsed = parsePayload(row) as PlacePayload | null;
      if (!parsed) return [];
      const place: PlacePayload = {
        ...parsed,
        id: parsed.id || row.id,
        canonicalName: parsed.canonicalName || row.canonical_name,
        placeType: parsed.placeType || String(row.place_type || "").toLowerCase(),
        state: parsed.state || row.state || undefined,
        district: parsed.district || row.district || undefined,
      };
      const query = normalise(q);
      const name = normalise(place.canonicalName);
      const aliases = Array.isArray(place.aliases) ? place.aliases.map(normalise) : [];
      const aliasMatch = aliases.some((alias: string) => alias === query || alias.startsWith(query));
      const contextMatch = normalise(place.district) === query || normalise(place.state) === query;
      const matchType = name === query ? "EXACT" : name.startsWith(query) ? "PREFIX" : aliasMatch ? "ALIAS" : contextMatch ? "CONTEXT" : "CONTEXT";
      const matchScore = name === query ? 100 : name.startsWith(query) ? 90 : aliasMatch ? 85 : contextMatch ? 65 : 60;
      const subtitle = [place.placeType, place.district, place.state]
        .filter((value: unknown, index: number, values: unknown[]) => Boolean(value) && values.indexOf(value) === index && normalise(value) !== name)
        .join(" · ");
      return [{
        place,
        matchScore,
        matchType,
        displayLabel: String(place.canonicalName),
        subtitle,
      }];
    });

    return json({ success: true, data: results, results, meta: { totalResults: results.length, query: q } });
  } catch {
    return json({ success: false, error: "Place search is temporarily unavailable." }, 503);
  }
}
