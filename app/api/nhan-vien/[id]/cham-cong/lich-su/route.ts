import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import type { RoleKey } from "@/lib/rbac";
import { combineDateTimeInTimeZone, getDateOnlyInTimeZone } from "@/lib/timezone";

const ALLOWED_ROLES = new Set<RoleKey>(["ADMIN", "DIRECTOR", "STAFF"]);

function parseDateOnly(value: string | null) {
  if (!value) return null;
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return null;
  const date = new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));
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

function getDefaultRange() {
  const now = new Date();
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0, 0));
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0, 23, 59, 59, 999));
  return { start, end };
}

async function requireStaffPermission() {
  const session = await auth();
  const email = session?.user?.email?.toLowerCase();
  if (!email) {
    return { ok: false as const, response: NextResponse.json({ message: "Chua dang nhap" }, { status: 401 }) };
  }

  const account = await prisma.account.findUnique({
    where: { email },
    select: { roleKey: true },
  });

  if (!account || !ALLOWED_ROLES.has(account.roleKey as RoleKey)) {
    return { ok: false as const, response: NextResponse.json({ message: "Khong co quyen truy cap" }, { status: 403 }) };
  }

  return { ok: true as const };
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const guard = await requireStaffPermission();
    if (!guard.ok) return guard.response;

    const { id } = await params;
    if (!id) {
      return NextResponse.json({ message: "Thieu id nhan vien" }, { status: 400 });
    }

    const employee = await prisma.employee.findUnique({
      where: { id },
      select: { id: true, code: true, fullName: true },
    });

    if (!employee) {
      return NextResponse.json({ message: "Khong tim thay nhan vien" }, { status: 404 });
    }

    const { searchParams } = new URL(request.url);
    const fromParam = searchParams.get("from");
    const toParam = searchParams.get("to");

    const from = parseDateOnly(fromParam);
    const to = parseDateOnly(toParam);

    let start: Date;
    let end: Date;
    if (from || to) {
      if (!from || !to || from.getTime() > to.getTime()) {
        return NextResponse.json({ message: "Khoang ngay khong hop le. Dung dinh dang YYYY-MM-DD." }, { status: 400 });
      }
      start = from;
      end = new Date(Date.UTC(to.getUTCFullYear(), to.getUTCMonth(), to.getUTCDate(), 23, 59, 59, 999));
    } else {
      const defaultRange = getDefaultRange();
      start = defaultRange.start;
      end = defaultRange.end;
    }

    const records = await prisma.attendanceRecord.findMany({
      where: {
        employeeId: id,
        date: {
          gte: start,
          lte: end,
        },
      },
      orderBy: { date: "desc" },
      select: {
        id: true,
        date: true,
        checkInAt: true,
        checkOutAt: true,
        status: true,
        lateMinutes: true,
        earlyLeaveMinutes: true,
        overtimeMinutes: true,
        workMinutes: true,
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

    const items = records.map((record) => {
      const currentStatus = autoAbsent.get(record.id)?.status ?? record.status ?? null;
      return {
        id: record.id,
        date: record.date.toISOString().slice(0, 10),
        checkInAt: record.checkInAt?.toISOString() ?? null,
        checkOutAt: record.checkOutAt?.toISOString() ?? null,
        status: currentStatus,
        lateMinutes: record.lateMinutes ?? 0,
        earlyLeaveMinutes: record.earlyLeaveMinutes ?? 0,
        overtimeMinutes: record.overtimeMinutes ?? 0,
        workMinutes: record.workMinutes ?? 0,
        checkInStatus: autoAbsent.get(record.id)?.checkInStatus ?? record.checkInStatus ?? null,
        checkOutStatus: autoAbsent.get(record.id)?.checkOutStatus ?? record.checkOutStatus ?? null,
        plannedName: record.schedule?.plannedName ?? null,
        plannedStart: record.schedule?.plannedStart ?? null,
        plannedEnd: record.schedule?.plannedEnd ?? null,
      };
    });

    const summary = items.reduce(
      (acc, item) => {
        const status = item.status ?? "UNKNOWN";
        acc.totalDays += 1;
        acc.statusCounts[status] = (acc.statusCounts[status] ?? 0) + 1;
        if (item.checkInAt) acc.checkedInDays += 1;
        if (item.checkOutAt) acc.checkedOutDays += 1;
        acc.totalLateMinutes += item.lateMinutes;
        acc.totalEarlyLeaveMinutes += item.earlyLeaveMinutes;
        acc.totalOvertimeMinutes += item.overtimeMinutes;
        acc.totalWorkMinutes += item.workMinutes;
        return acc;
      },
      {
        totalDays: 0,
        checkedInDays: 0,
        checkedOutDays: 0,
        totalLateMinutes: 0,
        totalEarlyLeaveMinutes: 0,
        totalOvertimeMinutes: 0,
        totalWorkMinutes: 0,
        statusCounts: {} as Record<string, number>,
      }
    );

    return NextResponse.json({
      employee,
      range: {
        from: start.toISOString().slice(0, 10),
        to: end.toISOString().slice(0, 10),
      },
      summary,
      items,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ message }, { status: 500 });
  }
}
