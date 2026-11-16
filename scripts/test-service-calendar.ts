import assert from "node:assert/strict";
import { parseServiceDate, serviceDateParams, timetableServiceFilter, routeHasServiceFilter } from "../functions/_lib/serviceCalendar";

assert.deepEqual(parseServiceDate("2026-11-16"), { date: "2026-11-16", day: "Mon" });
assert.deepEqual(parseServiceDate("2026-11-22"), { date: "2026-11-22", day: "Sun" });
assert.equal(parseServiceDate("2026-02-30"), null);
assert.equal(parseServiceDate("16-11-2026"), null);
assert.deepEqual(serviceDateParams({ date: "2026-11-16", day: "Mon" }), [
  "Mon", "2026-11-16", "2026-11-16", "2026-11-16", "2026-11-16"
]);
assert.match(timetableServiceFilter("t"), /service_start_date/);
assert.match(timetableServiceFilter("t"), /service_exceptions_json/);
assert.match(routeHasServiceFilter("r"), /service_tt\.route_id = r\.id/);
console.log("Service calendar helper tests passed.");
