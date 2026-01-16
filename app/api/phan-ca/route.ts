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
