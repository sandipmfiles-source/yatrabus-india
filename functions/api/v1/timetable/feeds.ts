import { PagesContext, json, unavailable } from "../../../_lib/api";
import { buildPublicGtfsCatalogue } from "../../../../backend/src/engine/gtfsCatalogue.js";
import registry from "../../../../data/gtfs/sources.json";

export async function onRequestGet({ env }: PagesContext): Promise<Response> {
  if (!env.DB) return unavailable();
  try {
    const catalogue = buildPublicGtfsCatalogue(registry as { feeds?: Array<Record<string, unknown>> });
    const rows = await env.DB.prepare(`
      SELECT json_extract(payload_json, '$.sourceDataset') AS source_dataset,
             MAX(json_extract(payload_json, '$.sourceSnapshotDate')) AS imported_at,
             COUNT(*) AS trip_count
      FROM timetables GROUP BY source_dataset
    `).all<{source_dataset:string|null;imported_at:string|null;trip_count:number}>();
    const installed = (rows.results || []).filter(row => Number(row.trip_count) > 0);
    const installedText = installed.map(row => String(row.source_dataset || "").toLowerCase()).join(" ");
    const feeds = catalogue.feeds.map(feed => {
      const id = String(feed.id || "").toLowerCase();
      const name = String(feed.name || "").toLowerCase();
      const isRrl = id.includes("rajkot") || name.includes("rajkot");
      const match = installed.find(row => {
        const source = String(row.source_dataset || "").toLowerCase();
        return source && (source.includes(id) || id.includes(source) || (isRrl && source.includes("rrl")));
      });
      return {
        ...feed,
        snapshotInstalled: Boolean(match || (isRrl && installedText.includes("rrl"))),
        snapshotImportedAt: match?.imported_at || (isRrl ? installed.find(row => String(row.source_dataset || "").toLowerCase().includes("rrl"))?.imported_at || null : null)
      };
    });
    return json({
      ...catalogue,
      feeds,
      snapshot: { ...catalogue.snapshot, status: installed.length ? "SNAPSHOT_AVAILABLE" : "SNAPSHOT_NOT_INSTALLED" },
      counts: { ...catalogue.counts, installedFeeds: feeds.filter(feed => feed.snapshotInstalled).length }
    });
  } catch {
    return json({ error: "The public timetable source catalogue is temporarily unavailable.", timetableStatus: "UNAVAILABLE", liveVehiclePositionsAvailable: false }, 503);
  }
}
