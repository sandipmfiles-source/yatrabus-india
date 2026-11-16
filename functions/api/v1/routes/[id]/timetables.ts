import { PagesContext, json, unavailable, parsePayload } from "../../../../_lib/api";
import { parseServiceDate, serviceDateParams, timetableServiceFilter } from "../../../../_lib/serviceCalendar";

export async function onRequestGet({ request, env, params }: PagesContext): Promise<Response> {
  if (!env.DB) return unavailable();
  const dateValue = new URL(request.url).searchParams.get("date");
  const serviceDate = dateValue ? parseServiceDate(dateValue) : null;
  if (dateValue && !serviceDate) {
    return json({ success: false, error: "Date must be a valid YYYY-MM-DD value" }, 400);
  }

  try {
    const dateFilter = serviceDate ? `AND ${timetableServiceFilter("t")}` : "";
    const rows = await env.DB.prepare(`
      SELECT t.payload_json
      FROM timetables AS t
      WHERE t.route_id = ?
        ${dateFilter}
      ORDER BY t.departure_time
    `).bind(params?.id || "", ...(serviceDate ? serviceDateParams(serviceDate) : [])).all<{ payload_json: string }>();
    const data = (rows.results || []).map(parsePayload).filter(Boolean);
    return json({
      success: true,
      data,
      meta: { count: data.length, serviceDate: serviceDate?.date || null }
    });
  } catch {
    return json({ success: false, error: "Timetable lookup is temporarily unavailable." }, 503);
  }
}
