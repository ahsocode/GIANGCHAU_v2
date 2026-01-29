const APP_TIME_ZONE = "Asia/Ho_Chi_Minh";
const APP_TIME_ZONE_OFFSET_MINUTES = 7 * 60;

function getDatePartsInTimeZone(value: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(value);

  const year = Number(parts.find((p) => p.type === "year")?.value ?? "0");
  const month = Number(parts.find((p) => p.type === "month")?.value ?? "0");
  const day = Number(parts.find((p) => p.type === "day")?.value ?? "0");

  return { year, month, day };
}

export function getDateOnlyInTimeZone(value: Date, timeZone = APP_TIME_ZONE) {
  const { year, month, day } = getDatePartsInTimeZone(value, timeZone);
  return new Date(Date.UTC(year, month - 1, day));
}

export function getDateRangeForTodayInTimeZone(now = new Date(), timeZone = APP_TIME_ZONE) {
  const dateOnly = getDateOnlyInTimeZone(now, timeZone);
  const start = dateOnly;
  const end = new Date(dateOnly.getTime() + 24 * 60 * 60 * 1000);
  return { start, end, dateOnly };
}

export function combineDateTimeInTimeZone(
  dateOnlyUtc: Date,
  time: string,
  offsetMinutes = APP_TIME_ZONE_OFFSET_MINUTES
) {
  const [hours, minutes] = time.split(":").map(Number);
  const year = dateOnlyUtc.getUTCFullYear();
  const month = dateOnlyUtc.getUTCMonth();
  const day = dateOnlyUtc.getUTCDate();
  const baseUtcMs = Date.UTC(year, month, day, hours || 0, minutes || 0, 0, 0);
  return new Date(baseUtcMs - offsetMinutes * 60 * 1000);
}

export { APP_TIME_ZONE, APP_TIME_ZONE_OFFSET_MINUTES };
