import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

function parseDateOnly(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return null;
  const date = new Date(Date.UTC(year, month - 1, day, 0, 0, 0));
  return Number.isNaN(date.getTime()) ? null : date;
}

function getDefaultMonthRange() {
  const now = new Date();
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0));
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0, 23, 59, 59, 999));
  return { start, end };
}

function getRecentDays(count: number) {
  const now = new Date();
  const days: Date[] = [];
  for (let i = count - 1; i >= 0; i -= 1) {
    const day = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - i));
    days.push(day);
  }
  return days;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const fromParam = searchParams.get("from")?.trim();
  const toParam = searchParams.get("to")?.trim();
  const dateParam = searchParams.get("date")?.trim();
  let start: Date;
  let end: Date;

  if (dateParam) {
    const selected = parseDateOnly(dateParam);
    if (!selected) {
      return NextResponse.json({ message: "Ngày không hợp lệ." }, { status: 400 });
    }
    start = selected;
    end = new Date(Date.UTC(selected.getUTCFullYear(), selected.getUTCMonth(), selected.getUTCDate(), 23, 59, 59, 999));
  } else if (fromParam && toParam) {
    const from = parseDateOnly(fromParam);
    const to = parseDateOnly(toParam);
    if (!from || !to || from > to) {
      return NextResponse.json({ message: "Khoảng ngày không hợp lệ." }, { status: 400 });
    }
    start = from;
    end = new Date(Date.UTC(to.getUTCFullYear(), to.getUTCMonth(), to.getUTCDate(), 23, 59, 59, 999));
  } else {
    const range = getDefaultMonthRange();
    start = range.start;
    end = range.end;
  }
  const recentDays = getRecentDays(7);
  const recentStart = recentDays[0];
  const recentEnd = new Date(Date.UTC(
    recentDays[recentDays.length - 1].getUTCFullYear(),
    recentDays[recentDays.length - 1].getUTCMonth(),
    recentDays[recentDays.length - 1].getUTCDate(),
    23,
    59,
    59,
    999
  ));

  const [statusGroups, recentRecords, totalRecords] = await Promise.all([
    prisma.attendanceRecord.groupBy({
      by: ["status"],
      where: { date: { gte: start, lte: end } },
      _count: { status: true },
    }),
    prisma.attendanceRecord.findMany({
      where: { date: { gte: recentStart, lte: recentEnd } },
      select: { date: true, status: true },
    }),
    prisma.attendanceRecord.count({ where: { date: { gte: start, lte: end } } }),
  ]);

  const statusBuckets = statusGroups.map((item) => ({
    status: item.status ?? "UNKNOWN",
    count: item._count.status ?? 0,
  }));

  const dailyMap: Record<
    string,
    {
      present: number;
      absent: number;
      late: number;
      nonCompliant: number;
      overtime: number;
      incomplete: number;
    }
  > = {};

  recentDays.forEach((day) => {
    const key = day.toISOString().slice(0, 10);
    dailyMap[key] = {
      present: 0,
      absent: 0,
      late: 0,
      nonCompliant: 0,
      overtime: 0,
      incomplete: 0,
    };
  });

  recentRecords.forEach((record) => {
    const key = record.date.toISOString().slice(0, 10);
    if (!dailyMap[key]) return;
    switch (record.status) {
      case "ABSENT":
        dailyMap[key].absent += 1;
        break;
      case "LATE":
        dailyMap[key].late += 1;
        break;
      case "NON_COMPLIANT":
        dailyMap[key].nonCompliant += 1;
        break;
      case "OVERTIME":
        dailyMap[key].overtime += 1;
        break;
      case "INCOMPLETE":
        dailyMap[key].incomplete += 1;
        break;
      case "PRESENT":
      case "EARLY_LEAVE":
      case "LATE_AND_EARLY":
      default:
        dailyMap[key].present += 1;
        break;
    }
  });

  const dailyBuckets = recentDays.map((day) => {
    const key = day.toISOString().slice(0, 10);
    return { date: key, ...dailyMap[key] };
  });

  return NextResponse.json({
    monthRange: {
      from: start.toISOString().slice(0, 10),
      to: end.toISOString().slice(0, 10),
    },
    totalRecords,
    statusBuckets,
    dailyBuckets,
  });
}
