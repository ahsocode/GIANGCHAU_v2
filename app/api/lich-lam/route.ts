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
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const account = await prisma.account.findUnique({
    where: { email },
    select: {
      employee: {
        select: { id: true },
      },
    },
  });

  if (!account?.employee?.id) {
    return NextResponse.json({ items: [] });
  }

  const { searchParams } = new URL(request.url);
  const from = searchParams.get("from")?.trim();
  const to = searchParams.get("to")?.trim();
  if (!from || !to) {
    return NextResponse.json({ message: "Thiếu khoảng thời gian." }, { status: 400 });
  }

  const start = parseDateOnly(from);
  const end = parseDateOnly(to);
  if (!start || !end || start > end) {
    return NextResponse.json({ message: "Khoảng ngày không hợp lệ." }, { status: 400 });
  }

  const schedules = await prisma.workSchedule.findMany({
    where: {
      employeeId: account.employee.id,
      date: { gte: start, lte: end },
    },
    select: {
      date: true,
      plannedName: true,
      plannedStart: true,
      plannedEnd: true,
    },
    orderBy: { date: "asc" },
  });

  const items = schedules.map((item) => ({
    date: item.date.toISOString().slice(0, 10),
    name: item.plannedName,
    startTime: item.plannedStart,
    endTime: item.plannedEnd,
  }));

  return NextResponse.json({ items });
}
