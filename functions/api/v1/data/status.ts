import { PagesContext, json, unavailable, onRequestOptions } from "../../../_lib/api";

export { onRequestOptions };

interface PlaceCoverageRow {
  source_dataset: string | null;
  place_type: string;
  records: number;
  latest_snapshot: string | null;
}

interface TransitCounts {
  buses: number;
  routes: number;
  timetables: number;
}

export async function onRequestGet({ env }: PagesContext): Promise<Response> {
  if (!env.DB) return unavailable();

  try {
    const [places, transit] = await Promise.all([
      env.DB.prepare(
        "SELECT source_dataset, place_type, COUNT(*) AS records, MAX(last_updated) AS latest_snapshot FROM places GROUP BY source_dataset, place_type ORDER BY source_dataset, place_type"
      ).all<PlaceCoverageRow>(),
      env.DB.prepare(
        "SELECT (SELECT COUNT(*) FROM buses WHERE status = 'active') AS buses, (SELECT COUNT(*) FROM routes WHERE status = 'active') AS routes, (SELECT COUNT(*) FROM timetables) AS timetables"
      ).first<TransitCounts>()
    ]);

    const coverage = places.results || [];
    const lgdRecords = coverage
      .filter((row) => row.source_dataset === "INDIA_LGD")
      .reduce((total, row) => total + Number(row.records || 0), 0);
    const busCount = Number(transit?.buses || 0);
    const routeCount = Number(transit?.routes || 0);
    const timetableCount = Number(transit?.timetables || 0);

    return json({
      success: true,
      data: {
        country: "India",
        administrativeDirectory: {
          loaded: lgdRecords > 0,
          records: lgdRecords,
          coverage
        },
        busServiceData: {
          buses: busCount,
          routes: routeCount,
          timetables: timetableCount,
          tripSearchReady: routeCount > 0 && timetableCount > 0
        },
        importantNotice: "LGD administrative places are location references only. They do not prove that a bus stop, bus route, or timetable exists."
      }
    });
  } catch {
    return json({ success: false, error: "India data coverage status is temporarily unavailable." }, 503);
  }
}
