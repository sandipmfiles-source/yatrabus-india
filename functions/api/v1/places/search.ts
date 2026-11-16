interface Env {
  DB?: D1Database;
}

interface D1Database {
  prepare(query: string): {
    bind(...values: unknown[]): {
      all<T = Record<string, unknown>>(): Promise<{ results?: T[]; success: boolean }>;
    };
  };
}

interface PlaceRow {
  id: string;
  canonical_name: string;
  place_type: string;
  state: string;
  district: string;
  subdivision: string | null;
  latitude: number | null;
  longitude: number | null;
  source_dataset: string | null;
  verification_status: string;
  last_updated: string | null;
  aliases_json: string;
  payload_json: string;
}

const json = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "public, max-age=30, s-maxage=60",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type"
    }
  });

function toPlace(row: PlaceRow) {
  let place: Record<string, unknown> = {};
  try {
    place = JSON.parse(row.payload_json) as Record<string, unknown>;
  } catch {
    // Keep the indexed columns usable even if an old payload is malformed.
  }

  let aliases: unknown[] = [];
  try {
    const parsed = JSON.parse(row.aliases_json);
    if (Array.isArray(parsed)) aliases = parsed;
  } catch {
    // Invalid aliases are treated as an empty list.
  }

  return {
    ...place,
    id: row.id,
    canonicalName: row.canonical_name,
    placeType: row.place_type,
    state: row.state,
    district: row.district,
    subdivision: row.subdivision,
    latitude: row.latitude,
    longitude: row.longitude,
    sourceDataset: row.source_dataset,
    verificationStatus: row.verification_status,
    lastUpdated: row.last_updated,
    aliases
  };
}

export const onRequestOptions: PagesFunction<Env> = async () =>
  new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type"
    }
  });

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  if (!env.DB) {
    return json({
      success: false,
      error: "Cloudflare D1 binding DB is not configured."
    }, 503);
  }

  const url = new URL(request.url);
  const query = (url.searchParams.get("q") || "").trim();
  const requestedLimit = Number.parseInt(url.searchParams.get("limit") || "8", 10);
  const limit = Number.isFinite(requestedLimit)
    ? Math.min(20, Math.max(1, requestedLimit))
    : 8;

  if (query.length < 1) {
    return json({
      success: true,
      data: [],
      meta: { totalResults: 0, query }
    });
  }

  if (query.length > 80) {
    return json({ success: false, error: "Search query must be 80 characters or fewer." }, 400);
  }

  try {
    const pattern = `%${query.toLocaleLowerCase().replace(/[%_\\\\]/g, "\\$&")}%`;
    const result = await env.DB.prepare(
      `SELECT id, canonical_name, place_type, state, district, subdivision,
              latitude, longitude, source_dataset, verification_status,
              last_updated, aliases_json, payload_json
         FROM places
        WHERE lower(canonical_name) LIKE ? ESCAPE '\\'
           OR lower(state) LIKE ? ESCAPE '\\'
           OR lower(district) LIKE ? ESCAPE '\\'
           OR lower(coalesce(subdivision, '')) LIKE ? ESCAPE '\\'
           OR lower(aliases_json) LIKE ? ESCAPE '\\'
        ORDER BY
          CASE WHEN lower(canonical_name) = ? THEN 0
               WHEN lower(canonical_name) LIKE ? ESCAPE '\\' THEN 1
               ELSE 2 END,
          canonical_name ASC
        LIMIT ?`
    ).bind(
      pattern, pattern, pattern, pattern, pattern,
      query.toLocaleLowerCase(),
      `${query.toLocaleLowerCase()}%`,
      limit
    ).all<PlaceRow>();

    const rows = result.results || [];
    return json({
      success: true,
      data: rows.map(toPlace),
      meta: { totalResults: rows.length, query }
    });
  } catch {
    return json({
      success: false,
      error: "Place search is temporarily unavailable. Check the D1 migration and DB binding."
    }, 503);
  }
};
