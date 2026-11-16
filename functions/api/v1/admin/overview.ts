import { PagesContext, json, unavailable, onRequestOptions } from "../../../_lib/api";
import { readAdminSession } from "../../../_lib/adminAuth";

export { onRequestOptions };

interface OverviewRow {
  totalPlaces: number;
  totalBuses: number;
  totalRoutes: number;
  totalStops: number;
  activeLiveSessions: number;
  recentObservationsCount: number;
  pendingSubmissionsCount: number;
  disputedRoutesCount: number;
  lastImportTimestamp: string | null;
}

export async function onRequestGet({ request, env }: PagesContext): Promise<Response> {
  if (!env.DB) return unavailable();
  const admin = await readAdminSession(request, env, env.DB);
  if (!admin) return json({ success: false, error: "Administrator authorization required." }, 401);
  try {
    const row = await env.DB.prepare(
      "SELECT " +
      "(SELECT COUNT(*) FROM places) AS totalPlaces, " +
      "(SELECT COUNT(*) FROM buses WHERE status = 'active') AS totalBuses, " +
      "(SELECT COUNT(*) FROM routes WHERE status = 'active') AS totalRoutes, " +
      "(SELECT COALESCE(SUM(json_array_length(stops_json)), 0) FROM routes WHERE status = 'active') AS totalStops, " +
      "(SELECT COUNT(*) FROM journey_sessions WHERE status = 'active') AS activeLiveSessions, " +
      "(SELECT COUNT(*) FROM location_observations WHERE observed_at >= ?) AS recentObservationsCount, " +
      "(SELECT COUNT(*) FROM community_submissions WHERE status = 'pending_review') AS pendingSubmissionsCount, " +
      "(SELECT COUNT(*) FROM routes WHERE json_extract(payload_json, '$.verificationStatus') = 'disputed') AS disputedRoutesCount, " +
      "(SELECT MAX(created_at) FROM places) AS lastImportTimestamp"
    ).bind(new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()).first<OverviewRow>();

    const data = {
      status: "healthy",
      uptimeSeconds: 0,
      totalPlaces: Number(row?.totalPlaces || 0),
      totalBuses: Number(row?.totalBuses || 0),
      totalRoutes: Number(row?.totalRoutes || 0),
      totalStops: Number(row?.totalStops || 0),
      activeLiveSessions: Number(row?.activeLiveSessions || 0),
      recentObservationsCount: Number(row?.recentObservationsCount || 0),
      pendingSubmissionsCount: Number(row?.pendingSubmissionsCount || 0),
      disputedRoutesCount: Number(row?.disputedRoutesCount || 0),
      databaseStatus: "connected",
      lastImportTimestamp: row?.lastImportTimestamp || "No imported location records yet"
    };
    return json({ success: true, data });
  } catch {
    return json({ success: false, error: "Admin overview is temporarily unavailable." }, 503);
  }
}
