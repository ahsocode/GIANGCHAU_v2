import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { combineDateTimeInTimeZone, getDateOnlyInTimeZone } from "@/lib/timezone";

function parseDateOnly(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return null;
  const date = new Date(Date.UTC(year, month - 1, day));
  return Number.isNaN(date.getTime()) ? null : date;
}

function resolveShiftWindow(date: Date, startTime: string, endTime: string) {
  const start = combineDateTimeInTimeZone(date, startTime);
  let end = combineDateTimeInTimeZone(date, endTime);
  if (end.getTime() <= start.getTime()) {
    end = new Date(end.getTime() + 24 * 60 * 60 * 1000);
  }
  return { start, end };
}

async function resolveEmployeeId(email: string) {
  const account = await prisma.account.findUnique({
    where: { email },
    select: { employeeId: true },
  });
  return account?.employeeId ?? null;
}

export async function GET(request: Request) {
  const session = await auth();
  const email = session?.user?.email?.toLowerCase();
  if (!email) {
    return NextResponse.json({ message: "Chưa đăng nhập" }, { status: 401 });
  }

  const employeeId = await resolveEmployeeId(email);
  if (!employeeId) {
    return NextResponse.json({ message: "Không tìm thấy nhân viên" }, { status: 404 });
  }

  const { searchParams } = new URL(request.url);
  const from = searchParams.get("from")?.trim();
  const to = searchParams.get("to")?.trim();

  let dateFilter: { gte: Date; lte: Date } | undefined;
  if (from && to) {
    const start = parseDateOnly(from);
    const end = parseDateOnly(to);
    if (!start || !end || start > end) {
      return NextResponse.json({ message: "Khoảng ngày không hợp lệ." }, { status: 400 });
    }
    dateFilter = { gte: start, lte: end };
  }

  const records = await prisma.attendanceRecord.findMany({
    where: { employeeId, ...(dateFilter ? { date: dateFilter } : {}) },
    orderBy: { date: "desc" },
    take: dateFilter ? undefined : 30,
    select: {
      id: true,
      date: true,
      checkInAt: true,
      checkOutAt: true,
      status: true,
      lateMinutes: true,
      earlyLeaveMinutes: true,
      overtimeMinutes: true,
      checkInStatus: true,
      checkOutStatus: true,
      schedule: {
        select: {
          plannedName: true,
          plannedStart: true,
          plannedEnd: true,
        },
      },
    },
  });

  const now = new Date();
  const todayUtc = getDateOnlyInTimeZone(now);
  const autoAbsent = new Map<string, { status: string; checkInStatus: string | null; checkOutStatus: string | null }>();
  const updates = records.map((record) => {
    if (record.checkInAt) return null;
    if (record.status && record.status !== "INCOMPLETE") return null;
    if (record.date.getTime() > todayUtc.getTime()) return null;
    if (!record.schedule?.plannedStart || !record.schedule?.plannedEnd) return null;
    const window = resolveShiftWindow(record.date, record.schedule.plannedStart, record.schedule.plannedEnd);
    if (now.getTime() <= window.end.getTime()) return null;
    return prisma.attendanceRecord
      .update({
        where: { id: record.id },
        data: {
          status: "ABSENT",
          checkInStatus: "MISSED",
          checkOutStatus: "MISSED",
        },
        select: {
          status: true,
          checkInStatus: true,
          checkOutStatus: true,
        },
      })
      .then((updated) => {
        autoAbsent.set(record.id, updated);
      });
  });
  const pendingUpdates = updates.filter(Boolean);
  if (pendingUpdates.length) {
    await Promise.all(pendingUpdates);
  }

  const items = records.map((record) => ({
    id: record.id,
    date: record.date.toISOString().slice(0, 10),
    checkInAt: record.checkInAt?.toISOString() ?? null,
    checkOutAt: record.checkOutAt?.toISOString() ?? null,
    status: autoAbsent.get(record.id)?.status ?? record.status,
    lateMinutes: record.lateMinutes ?? 0,
    earlyLeaveMinutes: record.earlyLeaveMinutes ?? 0,
    overtimeMinutes: record.overtimeMinutes ?? 0,
    checkInStatus: autoAbsent.get(record.id)?.checkInStatus ?? record.checkInStatus ?? null,
    checkOutStatus: autoAbsent.get(record.id)?.checkOutStatus ?? record.checkOutStatus ?? null,
    plannedName: record.schedule?.plannedName ?? null,
    plannedStart: record.schedule?.plannedStart ?? null,
    plannedEnd: record.schedule?.plannedEnd ?? null,
  }));

  return NextResponse.json({ items });
}
