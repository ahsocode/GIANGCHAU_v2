import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

function parseDateOnly(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return null;
  const date = new Date(Date.UTC(year, month - 1, day));
  return Number.isNaN(date.getTime()) ? null : date;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const employeeId = searchParams.get("employeeId")?.trim();
  const from = searchParams.get("from")?.trim();
  const to = searchParams.get("to")?.trim();

  if (!employeeId || !from || !to) {
    return NextResponse.json({ dates: [] });
  }

  const start = parseDateOnly(from);
  const end = parseDateOnly(to);
  if (!start || !end) return NextResponse.json({ dates: [] });

  const schedules = await prisma.workSchedule.findMany({
    where: {
      employeeId,
      date: { gte: start, lte: end },
    },
    select: { date: true, plannedName: true },
  });

  const items = schedules.map((item) => ({
    date: item.date.toISOString().slice(0, 10),
    name: item.plannedName,
  }));
  return NextResponse.json({ items });
}
