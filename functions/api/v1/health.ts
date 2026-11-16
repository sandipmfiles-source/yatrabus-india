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
    const adminTables = await env.DB.prepare(
      "SELECT COUNT(DISTINCT name) AS count FROM sqlite_master WHERE type = 'table' AND name IN ('admin_sessions','admin_login_attempts','operator_claims','service_alerts','public_rate_limits')"
    ).first<{ count: number }>();

    const coreTablesPresent = Number(coreTables?.count || 0);
    const adminSecurityTablesPresent = Number(adminTables?.count || 0);
    const schemaReady = coreTablesPresent === 12;
    const adminSecurityReady = adminSecurityTablesPresent === 5;
    const ready = schemaReady && adminSecurityReady;
    const error = !schemaReady
      ? 'Core D1 schema is incomplete. Apply all pending migrations.'
      : (!adminSecurityReady ? 'Admin security migration is not applied.' : undefined);
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
        adminSecurityTablesPresent
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
