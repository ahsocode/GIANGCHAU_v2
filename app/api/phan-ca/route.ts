import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

type RangePayload = {
  employeeId?: string;
  workShiftId?: string;
  startDate?: string;
  endDate?: string;
  weekdays?: number[];
  overwrite?: boolean;
};

function parseDateOnly(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return null;
  const date = new Date(Date.UTC(year, month - 1, day));
  return Number.isNaN(date.getTime()) ? null : date;
}

function getDatesInRange(start: Date, end: Date) {
  const days: Date[] = [];
  const current = new Date(start);
  while (current <= end) {
    days.push(new Date(current));
    current.setUTCDate(current.getUTCDate() + 1);
  }
  return days;
}

function toLocalDateFromUtc(value: Date) {
  return new Date(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate());
}

function combineDateTime(date: Date, time: string) {
  const [hours, minutes] = time.split(":").map(Number);
  const next = toLocalDateFromUtc(date);
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

export async function POST(request: Request) {
  const body = (await request.json()) as RangePayload;
  const employeeId = body.employeeId?.trim();
  const workShiftId = body.workShiftId?.trim();
  const startDate = body.startDate?.trim();
  const endDate = body.endDate?.trim();
  const weekdays = Array.isArray(body.weekdays) ? body.weekdays : [];
  const overwrite = body.overwrite === true;

  if (!employeeId || !workShiftId || !startDate || !endDate) {
    return NextResponse.json(
      { message: "Thiếu thông tin nhân viên, ca làm hoặc thời gian." },
      { status: 400 }
    );
  }

  const start = parseDateOnly(startDate);
  const end = parseDateOnly(endDate);
  if (!start || !end || start > end) {
    return NextResponse.json({ message: "Khoảng ngày không hợp lệ." }, { status: 400 });
  }

  const [employee, shift] = await Promise.all([
    prisma.employee.findUnique({ where: { id: employeeId } }),
    prisma.workShift.findUnique({ where: { id: workShiftId } }),
  ]);

  if (!employee) {
    return NextResponse.json({ message: "Không tìm thấy nhân viên." }, { status: 404 });
  }
  if (!shift) {
    return NextResponse.json({ message: "Không tìm thấy ca làm." }, { status: 404 });
  }

  const days = getDatesInRange(start, end);
  const filteredDays =
    weekdays.length > 0 ? days.filter((d) => weekdays.includes(d.getUTCDay())) : days;

  const now = new Date();
  const todayUtc = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));

  if (filteredDays.some((day) => day.getTime() < todayUtc.getTime())) {
    return NextResponse.json(
      { message: "Không thể phân ca cho ngày trước hôm nay." },
      { status: 400 }
    );
  }

  if (filteredDays.some((day) => day.getTime() === todayUtc.getTime())) {
    const window = resolveShiftWindow(todayUtc, shift.startTime, shift.endTime);
    if (now.getTime() > window.end.getTime()) {
      return NextResponse.json(
        { message: "Đã quá thời gian check-in cho ca hôm nay." },
        { status: 400 }
      );
    }
  }

  let created = 0;
  let updated = 0;
  let skipped = 0;

  await prisma.$transaction(async (tx) => {
    for (const day of filteredDays) {
      if (!overwrite) {
        const existed = await tx.workSchedule.findUnique({
          where: { employeeId_date: { employeeId, date: day } },
          select: { id: true },
        });
        if (existed) {
          skipped += 1;
          continue;
        }
      }

      const result = await tx.workSchedule.upsert({
        where: { employeeId_date: { employeeId, date: day } },
        create: {
          employeeId,
          date: day,
          workShiftId: shift.id,
          plannedName: shift.name,
          plannedStart: shift.startTime,
          plannedEnd: shift.endTime,
          plannedBreakMinutes: shift.breakMinutes,
          plannedLateGraceMinutes: shift.lateGraceMinutes,
          plannedEarlyGraceMinutes: shift.earlyGraceMinutes,
        },
        update: {
          workShiftId: shift.id,
          plannedName: shift.name,
          plannedStart: shift.startTime,
          plannedEnd: shift.endTime,
          plannedBreakMinutes: shift.breakMinutes,
          plannedLateGraceMinutes: shift.lateGraceMinutes,
          plannedEarlyGraceMinutes: shift.earlyGraceMinutes,
        },
        select: { id: true, createdAt: true, updatedAt: true },
      });

      await tx.attendanceRecord.upsert({
        where: { employeeId_date: { employeeId, date: day } },
        create: {
          employeeId,
          date: day,
          scheduleId: result.id,
          status: "INCOMPLETE",
          checkInStatus: "PENDING",
          checkOutStatus: "PENDING",
          source: "MANUAL",
        },
        update: {
          scheduleId: result.id,
        },
      });

      if (result.createdAt.getTime() === result.updatedAt.getTime()) created += 1;
      else updated += 1;
    }
  });

  return NextResponse.json({
    employeeId,
    workShiftId,
    total: filteredDays.length,
    created,
    updated,
    skipped,
  });
}
