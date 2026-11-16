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

/**
 * Cloudflare Pages health endpoint.
 *
 * The DB binding is intentionally optional at deploy time so the site can
 * still be published before the D1 database is created and bound. The endpoint
 * reports an explicit unavailable status instead of pretending that an
 * in-memory or missing database is persistent.
 */
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
    const table = await env.DB.prepare(
      "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'places' LIMIT 1"
    ).first<{ name: string }>();

    const schemaReady = Boolean(table);
    return json({
      success: schemaReady,
      data: {
        service: 'yatrabus-api',
        runtime: 'cloudflare-pages-functions',
        database: 'd1',
        persistentStorage: true,
        schemaReady
      },
      ...(schemaReady ? {} : { error: 'D1 is connected, but migrations have not been applied.' })
    }, schemaReady ? 200 : 503);
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
