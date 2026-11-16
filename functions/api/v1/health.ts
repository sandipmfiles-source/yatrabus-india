interface D1Result {
  results?: Array<Record<string, unknown>>;
}

interface D1Database {
  prepare(query: string): {
    first<T = Record<string, unknown>>(): Promise<T | null>;
    all<T = Record<string, unknown>>(): Promise<D1Result & { results?: T[] }>;
  };
}

interface PagesEnv {
  DB?: D1Database;
}

interface PagesContext {
  request: Request;
  env: PagesEnv;
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization'
    }
  });
}

/** Reports readiness only when the production schema required by APIs exists. */
export async function onRequestGet({ env }: PagesContext): Promise<Response> {
  if (!env.DB) {
    return json({
      success: false,
      data: {
        service: 'yatrabus-api',
        runtime: 'cloudflare-pages-functions',
        database: 'not_configured',
        persistentStorage: false
      },
      error: 'Cloudflare D1 binding DB is not configured.'
    }, 503);
  }

  try {
    await env.DB.prepare('SELECT 1 AS ok').first<{ ok: number }>();
    const coreTables = await env.DB.prepare(
      "SELECT COUNT(DISTINCT name) AS count FROM sqlite_master WHERE type = 'table' AND name IN ('places','operators','buses','routes','route_stops','timetables','journey_sessions','location_observations','community_submissions','audit_logs','automation_rules','schema_migrations')"
    ).first<{ count: number }>();
    const timetableColumns = await env.DB.prepare(
      "SELECT COUNT(*) AS count FROM pragma_table_info('timetables') WHERE name IN ('service_start_date','service_end_date','service_exceptions_json')"
    ).first<{ count: number }>();
    const observationIndexes = await env.DB.prepare(
      "SELECT COUNT(*) AS count FROM pragma_index_list('location_observations') WHERE name IN ('idx_location_session_observed','idx_location_route_observed')"
    ).first<{ count: number }>();
    const journeyIndexes = await env.DB.prepare(
      "SELECT COUNT(*) AS count FROM pragma_index_list('journey_sessions') WHERE name IN ('idx_journey_route_status','idx_journey_status_started')"
    ).first<{ count: number }>();
    const adminTables = await env.DB.prepare(
      "SELECT COUNT(DISTINCT name) AS count FROM sqlite_master WHERE type = 'table' AND name IN ('admin_sessions','admin_login_attempts','operator_claims','service_alerts','public_rate_limits')"
    ).first<{ count: number }>();

    const coreTablesPresent = Number(coreTables?.count || 0);
    const adminSecurityTablesPresent = Number(adminTables?.count || 0);
    const timetableCalendarColumnsPresent = Number(timetableColumns?.count || 0);
    const gpsIndexesPresent = Number(observationIndexes?.count || 0) + Number(journeyIndexes?.count || 0);
    const schemaReady = coreTablesPresent === 12;
    const timetableCalendarReady = timetableCalendarColumnsPresent === 3;
    const gpsTrackingReady = gpsIndexesPresent === 4;
    const adminSecurityReady = adminSecurityTablesPresent === 5;
    const ready = schemaReady && timetableCalendarReady && gpsTrackingReady && adminSecurityReady;
    const error = !schemaReady
      ? 'Core D1 schema is incomplete. Apply all pending migrations.'
      : (!timetableCalendarReady
        ? 'Date-accurate timetable calendar migration is not applied.'
        : (!gpsTrackingReady
          ? 'Consented GPS tracking indexes are not applied.'
          : (!adminSecurityReady ? 'Admin security migration is not applied.' : undefined)));
    return json({
      success: ready,
      data: {
        service: 'yatrabus-api',
        runtime: 'cloudflare-pages-functions',
        database: 'd1',
        persistentStorage: true,
        schemaReady,
        coreTablesPresent,
        adminSecurityReady,
        adminSecurityTablesPresent,
        timetableCalendarReady,
        timetableCalendarColumnsPresent,
        gpsTrackingReady,
        gpsIndexesPresent
      },
      ...(error ? { error } : {})
    }, ready ? 200 : 503);
  } catch {
    return json({
      success: false,
      data: {
        service: 'yatrabus-api',
        runtime: 'cloudflare-pages-functions',
        database: 'connection_error',
        persistentStorage: false
      },
      error: 'Cloudflare D1 health check failed.'
    }, 503);
  }
}

export async function onRequestOptions(): Promise<Response> {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Max-Age': '86400'
    }
  });
}
