import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";

function parseDateOnly(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return null;
  const date = new Date(Date.UTC(year, month - 1, day));
  return Number.isNaN(date.getTime()) ? null : date;
}

type EmployeeContext = {
  employeeId: string;
  departmentId: string | null;
  positionId: string | null;
};

async function resolveEmployeeContext(employeeId?: string | null): Promise<EmployeeContext | null> {
  if (employeeId) {
    const employee = await prisma.employee.findUnique({
      where: { id: employeeId },
      select: { id: true, departmentId: true, positionId: true },
    });
    if (!employee) return null;
    return {
      employeeId: employee.id,
      departmentId: employee.departmentId ?? null,
      positionId: employee.positionId ?? null,
    };
  }

  const session = await auth();
  const email = session?.user?.email?.toLowerCase();
  if (!email) return null;

  const account = await prisma.account.findUnique({
    where: { email },
    select: {
      employee: { select: { id: true, departmentId: true, positionId: true } },
    },
  });
  if (!account?.employee) return null;
  return {
    employeeId: account.employee.id,
    departmentId: account.employee.departmentId ?? null,
    positionId: account.employee.positionId ?? null,
  };
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const from = searchParams.get("from")?.trim();
  const to = searchParams.get("to")?.trim();
  const employeeId = searchParams.get("employeeId")?.trim();

  if (!from || !to) {
    return NextResponse.json({ items: [] });
  }

  const start = parseDateOnly(from);
  const end = parseDateOnly(to);
  if (!start || !end || start > end) {
    return NextResponse.json({ items: [] });
  }

  const context = await resolveEmployeeContext(employeeId);
  const dateFilter = { date: { gte: start, lte: end } };

  const where = context
    ? {
        ...dateFilter,
        OR: [
          { scope: "ALL" as const },
          { scope: "EMPLOYEE" as const, employeeId: context.employeeId },
          ...(context.departmentId ? [{ scope: "DEPARTMENT" as const, departmentId: context.departmentId }] : []),
          ...(context.positionId ? [{ scope: "POSITION" as const, positionId: context.positionId }] : []),
        ],
      }
    : dateFilter;

  const holidays = await prisma.holiday.findMany({
    where,
    select: {
      date: true,
      scope: true,
      holidayType: { select: { name: true, color: true, payPolicy: true } },
    },
    orderBy: { date: "asc" },
  });

  const items = holidays.map((holiday) => ({
    date: holiday.date.toISOString().slice(0, 10),
    name: holiday.holidayType.name,
    color: holiday.holidayType.color,
    payPolicy: holiday.holidayType.payPolicy,
    scope: holiday.scope,
  }));

  return NextResponse.json({ items });
}
