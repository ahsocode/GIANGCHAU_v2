import { NextResponse } from "next/server";

const APP_TIMEZONE = "Asia/Ho_Chi_Minh";

function formatDateOnly(value: Date) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: APP_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(value);
}

export async function GET() {
  const now = new Date();
  const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);

  return NextResponse.json({
    now: now.toISOString(),
    today: formatDateOnly(now),
    tomorrow: formatDateOnly(tomorrow),
  });
}
