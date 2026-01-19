import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

type Payload = {
  holidayTypeId?: string;
  scope?: "ALL" | "DEPARTMENT" | "POSITION" | "EMPLOYEE";
  startDate?: string;
  endDate?: string;
  dates?: string[];
  departmentId?: string;
  positionId?: string;
  employeeId?: string;
};

function parseDateOnly(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return null;
  const date = new Date(Date.UTC(year, month - 1, day));
  return Number.isNaN(date.getTime()) ? null : date;
}

function getDatesBetween(start: Date, end: Date) {
  const dates: Date[] = [];
  const current = new Date(start);
  while (current <= end) {
    dates.push(new Date(current));
    current.setUTCDate(current.getUTCDate() + 1);
  }
  return dates;
}

export async function POST(request: Request) {
  const body = (await request.json()) as Payload;
  const holidayTypeId = body.holidayTypeId?.trim();
  const scope = body.scope ?? "ALL";

  if (!holidayTypeId) {
    return NextResponse.json({ message: "Thiếu loại ngày nghỉ." }, { status: 400 });
  }

  const holidayType = await prisma.holidayType.findUnique({
    where: { id: holidayTypeId },
    select: { id: true },
  });
  if (!holidayType) {
    return NextResponse.json({ message: "Loại ngày nghỉ không tồn tại." }, { status: 400 });
  }

  if (scope === "DEPARTMENT" && !body.departmentId) {
    return NextResponse.json({ message: "Thiếu bộ phận áp dụng." }, { status: 400 });
  }
  if (scope === "POSITION" && !body.positionId) {
    return NextResponse.json({ message: "Thiếu chức vụ áp dụng." }, { status: 400 });
  }
  if (scope === "EMPLOYEE" && !body.employeeId) {
    return NextResponse.json({ message: "Thiếu nhân viên áp dụng." }, { status: 400 });
  }

  const dateValues: Date[] = [];
  if (Array.isArray(body.dates) && body.dates.length > 0) {
    body.dates.forEach((value) => {
      const parsed = parseDateOnly(value);
      if (parsed) dateValues.push(parsed);
    });
  } else {
    const start = body.startDate ? parseDateOnly(body.startDate) : null;
    const end = body.endDate ? parseDateOnly(body.endDate) : null;
    if (!start || !end || start > end) {
      return NextResponse.json({ message: "Khoảng ngày không hợp lệ." }, { status: 400 });
    }
    dateValues.push(...getDatesBetween(start, end));
  }

  if (dateValues.length === 0) {
    return NextResponse.json({ message: "Không có ngày hợp lệ." }, { status: 400 });
  }

  let created = 0;
  let skipped = 0;

  for (const date of dateValues) {
    const existing = await prisma.holiday.findFirst({
      where: {
        date,
        scope,
        holidayTypeId,
        departmentId: scope === "DEPARTMENT" ? body.departmentId ?? null : null,
        positionId: scope === "POSITION" ? body.positionId ?? null : null,
        employeeId: scope === "EMPLOYEE" ? body.employeeId ?? null : null,
      },
      select: { id: true },
    });
    if (existing) {
      skipped += 1;
      continue;
    }

    await prisma.holiday.create({
      data: {
        date,
        scope,
        holidayTypeId,
        departmentId: scope === "DEPARTMENT" ? body.departmentId ?? null : null,
        positionId: scope === "POSITION" ? body.positionId ?? null : null,
        employeeId: scope === "EMPLOYEE" ? body.employeeId ?? null : null,
      },
    });
    created += 1;
  }

  return NextResponse.json({ created, skipped });
}
