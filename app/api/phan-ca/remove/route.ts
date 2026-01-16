import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

type RemovePayload = {
  employeeId?: string;
  workShiftId?: string;
  startDate?: string;
  endDate?: string;
  weekdays?: number[];
};

function parseDateOnly(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return null;
  const date = new Date(Date.UTC(year, month - 1, day));
  return Number.isNaN(date.getTime()) ? null : date;
}

export async function POST(request: Request) {
  const body = (await request.json()) as RemovePayload;
  const employeeId = body.employeeId?.trim();
  const workShiftId = body.workShiftId?.trim();
  const startDate = body.startDate?.trim();
  const endDate = body.endDate?.trim();
  const weekdays = Array.isArray(body.weekdays) ? body.weekdays : [];

  if (!employeeId || !startDate || !endDate) {
    return NextResponse.json(
      { message: "Thiếu thông tin nhân viên hoặc thời gian." },
      { status: 400 }
    );
  }

  const start = parseDateOnly(startDate);
  const end = parseDateOnly(endDate);
  if (!start || !end || start > end) {
    return NextResponse.json({ message: "Khoảng ngày không hợp lệ." }, { status: 400 });
  }

  const schedules = await prisma.workSchedule.findMany({
    where: {
      employeeId,
      ...(workShiftId ? { workShiftId } : {}),
      date: { gte: start, lte: end },
    },
    select: { id: true, date: true },
  });

  const idsToDelete = schedules
    .filter((item) => (weekdays.length > 0 ? weekdays.includes(item.date.getUTCDay()) : true))
    .map((item) => item.id);

  if (idsToDelete.length === 0) {
    return NextResponse.json({ deleted: 0 });
  }

  const result = await prisma.workSchedule.deleteMany({
    where: { id: { in: idsToDelete } },
  });

  return NextResponse.json({ deleted: result.count });
}
