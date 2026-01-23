import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

function parseDateOnly(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return null;
  const date = new Date(Date.UTC(year, month - 1, day));
  return Number.isNaN(date.getTime()) ? null : date;
}

export async function GET(request: Request) {
  const session = await auth();
  const email = session?.user?.email?.toLowerCase();
  if (!email) {
    return NextResponse.json({ message: "Chưa đăng nhập" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const dateParam = searchParams.get("date")?.trim();
  if (!dateParam) {
    return NextResponse.json({ message: "Thiếu ngày." }, { status: 400 });
  }
  const date = parseDateOnly(dateParam);
  if (!date) {
    return NextResponse.json({ message: "Ngày không hợp lệ." }, { status: 400 });
  }

  const account = await prisma.account.findUnique({
    where: { email },
    select: { employeeId: true },
  });
  if (!account?.employeeId) {
    return NextResponse.json({ message: "Không tìm thấy nhân viên." }, { status: 404 });
  }

  const [schedule, record] = await Promise.all([
    prisma.workSchedule.findFirst({
      where: { employeeId: account.employeeId, date },
      select: {
        plannedName: true,
        plannedStart: true,
        plannedEnd: true,
        plannedBreakMinutes: true,
      },
    }),
    prisma.attendanceRecord.findFirst({
      where: { employeeId: account.employeeId, date },
      select: {
        checkInAt: true,
        checkOutAt: true,
        status: true,
        checkInStatus: true,
        checkOutStatus: true,
      },
    }),
  ]);

  return NextResponse.json({
    schedule: schedule
      ? {
          name: schedule.plannedName,
          startTime: schedule.plannedStart,
          endTime: schedule.plannedEnd,
          breakMinutes: schedule.plannedBreakMinutes ?? 0,
        }
      : null,
    attendance: record
      ? {
          checkInAt: record.checkInAt?.toISOString() ?? null,
          checkOutAt: record.checkOutAt?.toISOString() ?? null,
          status: record.status ?? null,
          checkInStatus: record.checkInStatus ?? null,
          checkOutStatus: record.checkOutStatus ?? null,
        }
      : null,
  });
}
