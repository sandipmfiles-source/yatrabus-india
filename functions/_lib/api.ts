export interface D1Database {
  prepare(query: string): {
    bind(...values: unknown[]): {
      first<T = Record<string, unknown>>(): Promise<T | null>;
      all<T = Record<string, unknown>>(): Promise<{ results?: T[] }>;
    };
    first<T = Record<string, unknown>>(): Promise<T | null>;
    all<T = Record<string, unknown>>(): Promise<{ results?: T[] }>;
  };
}
export interface PagesEnv { DB?: D1Database }
export interface PagesContext { request: Request; env: PagesEnv; params?: Record<string, string> }
export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization"
  }});
}
export function unavailable(): Response {
  return json({ success: false, error: "Cloudflare D1 binding DB is not configured." }, 503);
}
export function parsePayload(row: { payload_json?: string } | null): any {
  if (!row?.payload_json) return null;
  try { return JSON.parse(row.payload_json); } catch { return null; }
}
export function boundedInt(value: string | null, fallback: number, min: number, max: number): number {
  const n = Number(value);
  return Number.isFinite(n) ? Math.max(min, Math.min(max, Math.floor(n))) : fallback;
}
export async function onRequestOptions(): Promise<Response> {
  return new Response(null, { status: 204, headers: {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Max-Age": "86400"
  }});
}
