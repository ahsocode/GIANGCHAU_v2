import { NextResponse } from "next/server";
import { AttendanceCheckInStatus, AttendanceCheckOutStatus } from "@prisma/client";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

function getDateRangeForToday() {
  const now = new Date();
  const start = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
  const end = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate() + 1));
  return { start, end, dateOnly: start };
}

function getLocalDateFromUtcDate(value: Date) {
  return new Date(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate());
}

function combineDateTime(date: Date, time: string) {
  const [hours, minutes] = time.split(":").map(Number);
  const next = getLocalDateFromUtcDate(date);
  next.setHours(hours || 0, minutes || 0, 0, 0);
  return next;
}

function resolveShiftWindow(date: Date, startTime: string, endTime: string) {
  const start = combineDateTime(date, startTime);
  let end = combineDateTime(date, endTime);
  if (end.getTime() <= start.getTime()) {
    end = new Date(end.getTime() + 24 * 60 * 60 * 1000);
  }
  return { start, end };
}

function diffMinutes(start: Date, end: Date) {
  return Math.max(0, Math.round((end.getTime() - start.getTime()) / 60000));
}

function computeSummary(params: {
  schedule: {
    date: Date;
    plannedStart: string;
    plannedEnd: string;
    plannedBreakMinutes?: number | null;
    plannedLateGraceMinutes?: number | null;
    plannedEarlyGraceMinutes?: number | null;
  };
  record: {
    checkInAt: Date | null;
    checkOutAt: Date | null;
  };
}) {
  const { schedule, record } = params;
  const window = resolveShiftWindow(schedule.date, schedule.plannedStart, schedule.plannedEnd);
  const plannedBreak = schedule.plannedBreakMinutes ?? 0;
  const lateGrace = schedule.plannedLateGraceMinutes ?? 0;
  const earlyGrace = schedule.plannedEarlyGraceMinutes ?? 0;
  const lateBoundary = new Date(window.start.getTime() + lateGrace * 60000);
  const earlyBoundary = new Date(window.end.getTime() - earlyGrace * 60000);

  const checkInAt = record.checkInAt;
  const checkOutAt = record.checkOutAt;

  const plannedMinutes = Math.max(0, diffMinutes(window.start, window.end) - plannedBreak);
  const actualMinutes =
    checkInAt && checkOutAt ? Math.max(0, diffMinutes(checkInAt, checkOutAt) - plannedBreak) : 0;

  const lateMinutes = checkInAt && checkInAt > lateBoundary ? diffMinutes(lateBoundary, checkInAt) : 0;
  const earlyLeaveMinutes =
    checkOutAt && checkOutAt < earlyBoundary ? diffMinutes(checkOutAt, earlyBoundary) : 0;
  const overtimeMinutes = checkOutAt && checkOutAt > window.end ? diffMinutes(window.end, checkOutAt) : 0;

  const checkInStatusValue: AttendanceCheckInStatus | null = checkInAt
    ? lateMinutes > 0
      ? "LATE"
      : "ON_TIME"
    : null;
  const checkOutStatusValue: AttendanceCheckOutStatus | null = checkOutAt
    ? overtimeMinutes > 0
      ? "OVERTIME"
      : earlyLeaveMinutes > 0
        ? "EARLY"
        : "ON_TIME"
    : null;

  const checkInStatus = checkInStatusValue === "LATE" ? "Trễ giờ" : checkInStatusValue ? "Đúng giờ" : null;
  const checkOutStatus =
    checkOutStatusValue === "OVERTIME"
      ? "Tăng ca"
      : checkOutStatusValue === "EARLY"
        ? "Về sớm"
        : checkOutStatusValue
          ? "Đúng giờ"
          : null;

  return {
    plannedMinutes,
    actualMinutes,
    lateMinutes,
    earlyLeaveMinutes,
    overtimeMinutes,
    checkInStatusValue,
    checkOutStatusValue,
    checkInStatus,
    checkOutStatus,
  };
}

async function resolveEmployeeId(email: string) {
  const account = await prisma.account.findUnique({
    where: { email },
    select: { employeeId: true },
  });
  return account?.employeeId ?? null;
}

export async function GET() {
  const session = await auth();
  const email = session?.user?.email?.toLowerCase();
  if (!email) {
    return NextResponse.json({ message: "Chưa đăng nhập" }, { status: 401 });
  }

  const employeeId = await resolveEmployeeId(email);
  if (!employeeId) {
    return NextResponse.json({ message: "Không tìm thấy nhân viên" }, { status: 404 });
  }

  const { start, end, dateOnly } = getDateRangeForToday();

  const [schedule, record, nextSchedule] = await Promise.all([
    prisma.workSchedule.findFirst({
      where: { employeeId, date: { gte: start, lt: end } },
      select: {
        id: true,
        date: true,
        plannedName: true,
        plannedStart: true,
        plannedEnd: true,
        plannedBreakMinutes: true,
        plannedLateGraceMinutes: true,
        plannedEarlyGraceMinutes: true,
      },
    }),
    prisma.attendanceRecord.findFirst({
      where: { employeeId, date: { gte: start, lt: end } },
      select: {
        id: true,
        checkInAt: true,
        checkOutAt: true,
        workMinutes: true,
        lateMinutes: true,
        earlyLeaveMinutes: true,
        overtimeMinutes: true,
        status: true,
        checkInStatus: true,
        checkOutStatus: true,
      },
    }),
    prisma.workSchedule.findFirst({
      where: { employeeId, date: { gt: dateOnly } },
      orderBy: { date: "asc" },
      select: { date: true, plannedStart: true },
    }),
  ]);

  let attendanceRecord = record;
  let nextAllowedCheckInAt: Date | null = null;
  const shiftWindow = schedule
    ? resolveShiftWindow(schedule.date, schedule.plannedStart, schedule.plannedEnd)
    : null;
  const shiftStart = shiftWindow?.start ?? null;
  const shiftEnd = shiftWindow?.end ?? null;
  const checkInWindowStart = shiftStart ? new Date(shiftStart.getTime() - 60 * 60 * 1000) : null;
  if (record?.checkOutAt && nextSchedule) {
    const nextShiftStart = combineDateTime(nextSchedule.date, nextSchedule.plannedStart);
    nextAllowedCheckInAt = new Date(nextShiftStart.getTime() - 60 * 60 * 1000);
  }

  const now = new Date();
  if (schedule && shiftEnd && !attendanceRecord?.checkInAt && now.getTime() > shiftEnd.getTime()) {
    attendanceRecord = attendanceRecord
      ? await prisma.attendanceRecord.update({
          where: { id: attendanceRecord.id },
          data: { status: "ABSENT" },
          select: {
            id: true,
            checkInAt: true,
            checkOutAt: true,
            workMinutes: true,
            lateMinutes: true,
            earlyLeaveMinutes: true,
            overtimeMinutes: true,
            status: true,
            checkInStatus: true,
            checkOutStatus: true,
          },
        })
      : await prisma.attendanceRecord.create({
          data: {
            employeeId,
            date: dateOnly,
            scheduleId: schedule.id,
            status: "ABSENT",
            source: "WEB",
          },
          select: {
            id: true,
            checkInAt: true,
            checkOutAt: true,
            workMinutes: true,
            lateMinutes: true,
            earlyLeaveMinutes: true,
            overtimeMinutes: true,
            status: true,
            checkInStatus: true,
            checkOutStatus: true,
          },
        });
  }
  const allowCheckIn =
    !!schedule &&
    !attendanceRecord?.checkInAt &&
    (!checkInWindowStart || now.getTime() >= checkInWindowStart.getTime()) &&
    (!shiftEnd || now.getTime() <= shiftEnd.getTime()) &&
    (!nextAllowedCheckInAt || now.getTime() >= nextAllowedCheckInAt.getTime());
  const allowCheckOut = !!attendanceRecord?.checkInAt && !attendanceRecord?.checkOutAt;
  const summary =
    schedule && (attendanceRecord?.checkInAt || attendanceRecord?.checkOutAt)
      ? computeSummary({
          schedule: {
            date: schedule.date,
            plannedStart: schedule.plannedStart,
            plannedEnd: schedule.plannedEnd,
            plannedBreakMinutes: schedule.plannedBreakMinutes,
            plannedLateGraceMinutes: schedule.plannedLateGraceMinutes,
            plannedEarlyGraceMinutes: schedule.plannedEarlyGraceMinutes,
          },
          record: {
            checkInAt: attendanceRecord.checkInAt,
            checkOutAt: attendanceRecord.checkOutAt,
          },
        })
      : null;

  return NextResponse.json({
    schedule: schedule
      ? {
          id: schedule.id,
          date: schedule.date.toISOString().slice(0, 10),
          name: schedule.plannedName,
          startTime: schedule.plannedStart,
          endTime: schedule.plannedEnd,
          breakMinutes: schedule.plannedBreakMinutes ?? 0,
          lateGraceMinutes: schedule.plannedLateGraceMinutes ?? 0,
          earlyGraceMinutes: schedule.plannedEarlyGraceMinutes ?? 0,
        }
      : null,
    record: attendanceRecord
      ? {
          id: attendanceRecord.id,
          checkInAt: attendanceRecord.checkInAt?.toISOString() ?? null,
          checkOutAt: attendanceRecord.checkOutAt?.toISOString() ?? null,
          status: attendanceRecord.status ?? null,
          workMinutes: attendanceRecord.workMinutes ?? 0,
          lateMinutes: attendanceRecord.lateMinutes ?? 0,
          earlyLeaveMinutes: attendanceRecord.earlyLeaveMinutes ?? 0,
          overtimeMinutes: attendanceRecord.overtimeMinutes ?? 0,
          checkInStatus: attendanceRecord.checkInStatus ?? null,
          checkOutStatus: attendanceRecord.checkOutStatus ?? null,
        }
      : null,
    summary,
    allowCheckIn,
    allowCheckOut,
    nextAllowedCheckInAt:
      (!attendanceRecord?.checkInAt && checkInWindowStart && now.getTime() < checkInWindowStart.getTime())
        ? checkInWindowStart.toISOString()
        : nextAllowedCheckInAt?.toISOString() ?? null,
  });
}

export async function POST(request: Request) {
  const session = await auth();
  const email = session?.user?.email?.toLowerCase();
  if (!email) {
    return NextResponse.json({ message: "Chưa đăng nhập" }, { status: 401 });
  }

  const employeeId = await resolveEmployeeId(email);
  if (!employeeId) {
    return NextResponse.json({ message: "Không tìm thấy nhân viên" }, { status: 404 });
  }

  const body = (await request.json()) as { action?: "checkin" | "checkout" };
  if (body.action !== "checkin" && body.action !== "checkout") {
    return NextResponse.json({ message: "Hành động không hợp lệ." }, { status: 400 });
  }

  const { start, end, dateOnly } = getDateRangeForToday();
  const now = new Date();

  const schedule = await prisma.workSchedule.findFirst({
    where: { employeeId, date: { gte: start, lt: end } },
    select: {
      id: true,
      date: true,
      plannedName: true,
      plannedStart: true,
      plannedEnd: true,
      plannedBreakMinutes: true,
      plannedLateGraceMinutes: true,
      plannedEarlyGraceMinutes: true,
    },
  });

  if (!schedule) {
    return NextResponse.json({ message: "Hôm nay bạn chưa được phân ca." }, { status: 400 });
  }

  const shiftWindow = resolveShiftWindow(schedule.date, schedule.plannedStart, schedule.plannedEnd);
  const shiftStart = shiftWindow.start;
  const shiftEnd = shiftWindow.end;
  const checkInWindowStart = new Date(shiftStart.getTime() - 60 * 60 * 1000);

  const record = await prisma.attendanceRecord.findFirst({
    where: { employeeId, date: { gte: start, lt: end } },
  });

  if (body.action === "checkin") {
    if (now.getTime() < checkInWindowStart.getTime()) {
      return NextResponse.json({ message: "Chưa đến thời gian check-in." }, { status: 400 });
    }
    if (now.getTime() > shiftEnd.getTime()) {
      return NextResponse.json({ message: "Đã quá thời gian check-in." }, { status: 400 });
    }
    if (record?.checkInAt) {
      return NextResponse.json({ message: "Bạn đã check-in rồi." }, { status: 400 });
    }
    const summary = computeSummary({
      schedule: {
        date: schedule.date,
        plannedStart: schedule.plannedStart,
        plannedEnd: schedule.plannedEnd,
        plannedBreakMinutes: schedule.plannedBreakMinutes,
        plannedLateGraceMinutes: schedule.plannedLateGraceMinutes,
        plannedEarlyGraceMinutes: schedule.plannedEarlyGraceMinutes,
      },
      record: {
        checkInAt: now,
        checkOutAt: null,
      },
    });
    const checkInStatus: AttendanceCheckInStatus | null = summary?.checkInStatusValue ?? null;

    const updated = record
      ? await prisma.attendanceRecord.update({
          where: { id: record.id },
          data: {
            scheduleId: schedule.id,
            checkInAt: now,
            checkInStatus,
          },
        })
      : await prisma.attendanceRecord.create({
          data: {
            employeeId,
            date: dateOnly,
            scheduleId: schedule.id,
            checkInAt: now,
            checkInStatus,
            status: "INCOMPLETE",
            source: "WEB",
          },
        });

    await prisma.attendanceEvent.create({
      data: {
        employeeId,
        date: dateOnly,
        recordId: updated.id,
        type: "CHECK_IN",
        occurredAt: now,
        source: "WEB",
      },
    });

    return NextResponse.json({ ok: true, checkInAt: updated.checkInAt?.toISOString() ?? null });
  }

  if (!record?.checkInAt) {
    return NextResponse.json({ message: "Bạn chưa check-in." }, { status: 400 });
  }
  if (record.checkOutAt) {
    return NextResponse.json({ message: "Bạn đã check-out rồi." }, { status: 400 });
  }

  const summary = computeSummary({
    schedule: {
      date: schedule.date,
      plannedStart: schedule.plannedStart,
      plannedEnd: schedule.plannedEnd,
      plannedBreakMinutes: schedule.plannedBreakMinutes,
      plannedLateGraceMinutes: schedule.plannedLateGraceMinutes,
      plannedEarlyGraceMinutes: schedule.plannedEarlyGraceMinutes,
    },
    record: {
      checkInAt: record.checkInAt,
      checkOutAt: now,
    },
  });
  const lateMinutes = summary?.lateMinutes ?? 0;
  const earlyLeaveMinutes = summary?.earlyLeaveMinutes ?? 0;
  const overtimeMinutes = summary?.overtimeMinutes ?? 0;
  const checkOutStatus: AttendanceCheckOutStatus | null = summary?.checkOutStatusValue ?? null;
  let status: "PRESENT" | "LATE" | "EARLY_LEAVE" | "LATE_AND_EARLY" = "PRESENT";
  if (lateMinutes > 0 && earlyLeaveMinutes > 0) status = "LATE_AND_EARLY";
  else if (lateMinutes > 0) status = "LATE";
  else if (earlyLeaveMinutes > 0) status = "EARLY_LEAVE";

  const updated = await prisma.attendanceRecord.update({
    where: { id: record.id },
    data: {
      checkOutAt: now,
      status,
      workMinutes: summary?.actualMinutes ?? 0,
      breakMinutes: schedule.plannedBreakMinutes ?? 0,
      lateMinutes,
      earlyLeaveMinutes,
      overtimeMinutes,
      checkOutStatus,
    },
  });

  await prisma.attendanceEvent.create({
    data: {
      employeeId,
      date: dateOnly,
      recordId: updated.id,
      type: "CHECK_OUT",
      occurredAt: now,
      source: "WEB",
    },
  });

  return NextResponse.json({
    ok: true,
    checkOutAt: updated.checkOutAt?.toISOString() ?? null,
    summary,
  });
}
