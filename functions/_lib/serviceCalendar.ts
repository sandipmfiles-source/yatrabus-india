export type ServiceDate = {
  date: string;
  day: "Mon" | "Tue" | "Wed" | "Thu" | "Fri" | "Sat" | "Sun";
};

const DAY_LABELS: ServiceDate["day"][] = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function parseServiceDate(value: string): ServiceDate | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
  return { date: value, day: DAY_LABELS[date.getUTCDay()] };
}

export function todayInIndia(now = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(now);
  const part = (type: string) => parts.find(item => item.type === type)?.value || "00";
  return `${part("year")}-${part("month")}-${part("day")}`;
}

export function timetableServiceFilter(alias: string): string {
  return `(
    (
      EXISTS (SELECT 1 FROM json_each(${alias}.service_days_json) AS weekly WHERE weekly.value = ?)
      OR EXISTS (
        SELECT 1 FROM json_each(${alias}.service_exceptions_json) AS added
        WHERE json_extract(added.value, '$.date') = ?
          AND CAST(json_extract(added.value, '$.exceptionType') AS INTEGER) = 1
      )
    )
    AND (${alias}.service_start_date IS NULL OR ${alias}.service_start_date <= ?)
    AND (${alias}.service_end_date IS NULL OR ${alias}.service_end_date >= ?)
    AND NOT EXISTS (
      SELECT 1 FROM json_each(${alias}.service_exceptions_json) AS removed
      WHERE json_extract(removed.value, '$.date') = ?
        AND CAST(json_extract(removed.value, '$.exceptionType') AS INTEGER) = 2
    )
  )`;
}

export function routeHasServiceFilter(routeAlias: string): string {
  return `EXISTS (
    SELECT 1 FROM timetables AS service_tt
    WHERE service_tt.route_id = ${routeAlias}.id
      AND ${timetableServiceFilter("service_tt")}
  )`;
}

export function serviceDateParams(serviceDate: ServiceDate): [string, string, string, string, string] {
  return [serviceDate.day, serviceDate.date, serviceDate.date, serviceDate.date, serviceDate.date];
}
