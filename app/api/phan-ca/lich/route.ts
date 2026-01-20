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
  const employeeIdsParam = searchParams.get("employeeIds")?.trim();
  const departmentId = searchParams.get("departmentId")?.trim();
  const positionId = searchParams.get("positionId")?.trim();
  const from = searchParams.get("from")?.trim();
  const to = searchParams.get("to")?.trim();

  if (!from || !to) {
    return NextResponse.json({ dates: [] });
  }
  if (!employeeId && !employeeIdsParam && !departmentId && !positionId) {
    return NextResponse.json({ dates: [] });
  }

  const start = parseDateOnly(from);
  const end = parseDateOnly(to);
  if (!start || !end) return NextResponse.json({ dates: [] });

  let employeeIds: string[] = [];
  if (employeeIdsParam) {
    employeeIds = employeeIdsParam
      .split(",")
      .map((id) => id.trim())
      .filter(Boolean);
  } else if (departmentId || positionId) {
    const employees = await prisma.employee.findMany({
      where: {
        ...(departmentId ? { departmentId } : {}),
        ...(positionId ? { positionId } : {}),
      },
      select: { id: true },
    });
    employeeIds = employees.map((emp) => emp.id);
  } else if (employeeId) {
    employeeIds = [employeeId];
  }

  if (employeeIds.length === 0) {
    return NextResponse.json({ items: [] });
  }

  const schedules = await prisma.workSchedule.findMany({
    where: {
      employeeId: { in: employeeIds },
      date: { gte: start, lte: end },
    },
    select: { date: true, plannedName: true, employeeId: true },
  });

  const totalEmployees = employeeIds.length;
  const map = new Map<string, { employees: Set<string>; names: Set<string> }>();

  schedules.forEach((item) => {
    const key = item.date.toISOString().slice(0, 10);
    if (!map.has(key)) {
      map.set(key, { employees: new Set<string>(), names: new Set<string>() });
    }
    const entry = map.get(key)!;
    entry.employees.add(item.employeeId);
    if (item.plannedName) entry.names.add(item.plannedName);
  });

  const items = [...map.entries()]
    .filter(([, entry]) => entry.employees.size === totalEmployees)
    .map(([date, entry]) => ({
      date,
      name: entry.names.size === 1 ? [...entry.names][0] : "Nhiều ca",
    }))
    .sort((a, b) => a.date.localeCompare(b.date));

  return NextResponse.json({ items });
}
