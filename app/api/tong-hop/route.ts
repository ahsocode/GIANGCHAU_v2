import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { combineDateTimeInTimeZone, getDateOnlyInTimeZone } from "@/lib/timezone";

function formatDate(value: Date) {
  return value.toISOString().slice(0, 10);
}

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

function diffMinutes(start: Date, end: Date) {
  return Math.max(0, Math.round((end.getTime() - start.getTime()) / 60000));
}

export async function GET(request: Request) {
  const session = await auth();
  const email = session?.user?.email?.toLowerCase();
  if (!email) {
    return NextResponse.json({ message: "Chưa đăng nhập" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const from = searchParams.get("from")?.trim();
  const to = searchParams.get("to")?.trim();

  const account = await prisma.account.findUnique({
    where: { email },
    include: {
      employee: {
        include: {
          department: { select: { name: true } },
          position: { select: { name: true } },
        },
      },
    },
  });

  if (!account?.employee) {
    return NextResponse.json({ message: "Chưa có hồ sơ nhân viên." }, { status: 404 });
  }

  const emp = account.employee;
  const now = new Date();
  const todayUtc = getDateOnlyInTimeZone(now);
  const monthStart = new Date(Date.UTC(todayUtc.getUTCFullYear(), todayUtc.getUTCMonth(), 1));
  const monthEnd = new Date(Date.UTC(todayUtc.getUTCFullYear(), todayUtc.getUTCMonth() + 1, 1));

  let rangeStart = monthStart;
  let rangeEnd = todayUtc;

  if (from || to) {
    if (!from || !to) {
      return NextResponse.json({ message: "Thiếu khoảng thời gian." }, { status: 400 });
    }
    const parsedFrom = parseDateOnly(from);
    const parsedTo = parseDateOnly(to);
    if (!parsedFrom || !parsedTo || parsedFrom > parsedTo) {
      return NextResponse.json({ message: "Khoảng ngày không hợp lệ." }, { status: 400 });
    }
    rangeStart = parsedFrom;
    rangeEnd = parsedTo;
  } else {
    const firstSchedule = await prisma.workSchedule.findFirst({
      where: { employeeId: emp.id, date: { gte: monthStart, lt: monthEnd } },
      orderBy: { date: "asc" },
      select: { date: true },
    });
    rangeStart = firstSchedule?.date ?? monthStart;
  }

  const [
    scheduleCount,
    statusGroups,
    upcomingSchedules,
    recentAttendance,
    upcomingLeaves,
    schedulesInRange,
    workMinutesAgg,
  ] = await Promise.all([
    prisma.workSchedule.count({
      where: { employeeId: emp.id, date: { gte: rangeStart, lte: rangeEnd } },
    }),
    prisma.attendanceRecord.groupBy({
      by: ["status"],
      where: { employeeId: emp.id, date: { gte: rangeStart, lte: rangeEnd } },
      _count: { status: true },
    }),
    prisma.workSchedule.findMany({
      where: { employeeId: emp.id, date: { gte: todayUtc } },
      orderBy: { date: "asc" },
      take: 3,
      select: { date: true, plannedName: true, plannedStart: true, plannedEnd: true },
    }),
    prisma.attendanceRecord.findMany({
      where: { employeeId: emp.id },
      orderBy: { date: "desc" },
      take: 5,
      select: {
        date: true,
        status: true,
        checkInAt: true,
        checkOutAt: true,
        schedule: { select: { plannedName: true, plannedStart: true, plannedEnd: true } },
      },
    }),
    prisma.leaveRequest.findMany({
      where: { employeeId: emp.id, startDate: { gte: todayUtc } },
      orderBy: { startDate: "asc" },
      take: 3,
      select: { id: true, type: true, status: true, startDate: true, endDate: true },
    }),
    prisma.workSchedule.findMany({
      where: { employeeId: emp.id, date: { gte: rangeStart, lte: rangeEnd } },
      select: { date: true, plannedStart: true, plannedEnd: true, plannedBreakMinutes: true },
    }),
    prisma.attendanceRecord.aggregate({
      where: { employeeId: emp.id, date: { gte: rangeStart, lte: rangeEnd } },
      _sum: { workMinutes: true },
    }),
  ]);

  const plannedMinutes = schedulesInRange.reduce((sum, schedule) => {
    const window = resolveShiftWindow(schedule.date, schedule.plannedStart, schedule.plannedEnd);
    const shiftMinutes = diffMinutes(window.start, window.end);
    const finalMinutes = Math.max(0, shiftMinutes - (schedule.plannedBreakMinutes ?? 0));
    return sum + finalMinutes;
  }, 0);

  const statusMap = statusGroups.reduce<Record<string, number>>((acc, item) => {
    acc[item.status ?? "UNKNOWN"] = item._count.status ?? 0;
    return acc;
  }, {});

  return NextResponse.json({
    profile: {
      name: emp.fullName || account.name || account.email,
      positionName: emp.position?.name ?? null,
      departmentName: emp.department?.name ?? null,
      code: emp.code ?? null,
      personalEmail: emp.personalEmail ?? null,
      phone: emp.phone ?? null,
      joinedAt: emp.joinedAt ? formatDate(emp.joinedAt) : null,
      employmentType: emp.employmentType,
      accountEmail: account.email,
    },
    summary: {
      scheduleCount,
      statusMap,
      now: formatDate(now),
      range: {
        from: formatDate(rangeStart),
        to: formatDate(rangeEnd),
      },
      totalPlannedMinutes: plannedMinutes,
      totalWorkMinutes: workMinutesAgg._sum.workMinutes ?? 0,
    },
    upcomingSchedules: upcomingSchedules.map((item) => ({
      date: formatDate(item.date),
      plannedName: item.plannedName ?? null,
      plannedStart: item.plannedStart ?? null,
      plannedEnd: item.plannedEnd ?? null,
    })),
    recentAttendance: recentAttendance.map((record) => ({
      date: formatDate(record.date),
      status: record.status ?? null,
      checkInAt: record.checkInAt?.toISOString() ?? null,
      checkOutAt: record.checkOutAt?.toISOString() ?? null,
      plannedName: record.schedule?.plannedName ?? null,
      plannedStart: record.schedule?.plannedStart ?? null,
      plannedEnd: record.schedule?.plannedEnd ?? null,
    })),
    upcomingLeaves: upcomingLeaves.map((leave) => ({
      id: leave.id,
      type: leave.type,
      status: leave.status,
      startDate: formatDate(leave.startDate),
      endDate: formatDate(leave.endDate),
    })),
  });
}
