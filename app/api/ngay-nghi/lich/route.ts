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
  const employeeIdsParam = searchParams.get("employeeIds")?.trim();
  const departmentId = searchParams.get("departmentId")?.trim();
  const positionId = searchParams.get("positionId")?.trim();

  if (!from || !to) {
    return NextResponse.json({ items: [] });
  }

  const start = parseDateOnly(from);
  const end = parseDateOnly(to);
  if (!start || !end || start > end) {
    return NextResponse.json({ items: [] });
  }

  const dateFilter = { date: { gte: start, lte: end } };

  if (employeeIdsParam || departmentId || positionId) {
    let employees = [] as Array<{ id: string; departmentId: string | null; positionId: string | null }>;
    if (employeeIdsParam) {
      const ids = employeeIdsParam
        .split(",")
        .map((id) => id.trim())
        .filter(Boolean);
      if (ids.length === 0) return NextResponse.json({ items: [] });
      employees = await prisma.employee.findMany({
        where: { id: { in: ids } },
        select: { id: true, departmentId: true, positionId: true },
      });
    } else {
      employees = await prisma.employee.findMany({
        where: {
          ...(departmentId ? { departmentId } : {}),
          ...(positionId ? { positionId } : {}),
        },
        select: { id: true, departmentId: true, positionId: true },
      });
    }

    if (employees.length === 0) return NextResponse.json({ items: [] });

    const allEmployeeIds = employees.map((emp) => emp.id);
    const employeesByDepartment = new Map<string, string[]>();
    const employeesByPosition = new Map<string, string[]>();

    employees.forEach((emp) => {
      if (emp.departmentId) {
        if (!employeesByDepartment.has(emp.departmentId)) employeesByDepartment.set(emp.departmentId, []);
        employeesByDepartment.get(emp.departmentId)!.push(emp.id);
      }
      if (emp.positionId) {
        if (!employeesByPosition.has(emp.positionId)) employeesByPosition.set(emp.positionId, []);
        employeesByPosition.get(emp.positionId)!.push(emp.id);
      }
    });

    const holidays = await prisma.holiday.findMany({
      where: dateFilter,
      select: {
        date: true,
        scope: true,
        departmentId: true,
        positionId: true,
        employeeId: true,
        holidayType: { select: { id: true, name: true, color: true, payPolicy: true } },
      },
    });

    const dateMap = new Map<string, { employees: Set<string>; typeIds: Set<string> }>();
    const typeMeta = new Map<string, { name: string; color: string; payPolicy: "PAID" | "UNPAID" | "LEAVE" }>();

    holidays.forEach((holiday) => {
      if (!typeMeta.has(holiday.holidayType.id)) {
        typeMeta.set(holiday.holidayType.id, {
          name: holiday.holidayType.name,
          color: holiday.holidayType.color,
          payPolicy: holiday.holidayType.payPolicy,
        });
      }
      let affected: string[] = [];
      if (holiday.scope === "ALL") {
        affected = allEmployeeIds;
      } else if (holiday.scope === "EMPLOYEE" && holiday.employeeId) {
        if (allEmployeeIds.includes(holiday.employeeId)) {
          affected = [holiday.employeeId];
        }
      } else if (holiday.scope === "DEPARTMENT" && holiday.departmentId) {
        affected = employeesByDepartment.get(holiday.departmentId) ?? [];
      } else if (holiday.scope === "POSITION" && holiday.positionId) {
        affected = employeesByPosition.get(holiday.positionId) ?? [];
      }

      if (affected.length === 0) return;
      const key = holiday.date.toISOString().slice(0, 10);
      if (!dateMap.has(key)) {
        dateMap.set(key, {
          employees: new Set<string>(),
          typeIds: new Set<string>(),
        });
      }
      const entry = dateMap.get(key)!;
      affected.forEach((id) => entry.employees.add(id));
      entry.typeIds.add(holiday.holidayType.id);
    });

    const items = [...dateMap.entries()]
      .filter(([, entry]) => entry.employees.size === allEmployeeIds.length)
      .map(([date, entry]) => {
        if (entry.typeIds.size === 1) {
          const typeId = [...entry.typeIds][0];
          const meta = typeMeta.get(typeId);
          return {
            date,
            name: meta?.name ?? "Ngày nghỉ",
            color: meta?.color ?? "#F59E0B",
            payPolicy: meta?.payPolicy ?? "PAID",
            scope: "ALL" as const,
          };
        }
        return {
          date,
          name: "Nhiều loại nghỉ",
          color: "#F59E0B",
          payPolicy: "PAID" as const,
          scope: "ALL" as const,
        };
      })
      .sort((a, b) => a.date.localeCompare(b.date));

    return NextResponse.json({ items });
  }

  const context = await resolveEmployeeContext(employeeId);
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
