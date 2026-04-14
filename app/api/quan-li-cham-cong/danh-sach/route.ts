import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import type { RoleKey } from "@/lib/rbac";
import type { Prisma } from "@prisma/client";
import { combineDateTimeInTimeZone, getDateOnlyInTimeZone } from "@/lib/timezone";

const ALLOWED_ROLES = new Set<RoleKey>(["ADMIN", "DIRECTOR"]);

type DerivedStatus = "MISSING_CHECKIN" | "MISSING_CHECKOUT" | "OVERTIME";
type AttendanceFilterStatus =
  | "ALL"
  | DerivedStatus
  | "PRESENT"
  | "ABSENT"
  | "LATE"
  | "EARLY_LEAVE"
  | "LATE_AND_EARLY"
  | "NON_COMPLIANT"
  | "INCOMPLETE"
  | "NO_SHIFT";

function parseDateOnly(value: string | null) {
  if (!value) return null;
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return null;
  const date = new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));
  return Number.isNaN(date.getTime()) ? null : date;
}

function resolveShiftWindow(date: Date, startTime: string, endTime: string) {
  const start = combineDateTimeInTimeZone(date, startTime);
  let end = combineDateTimeInTimeZone(date, endTime);
  if (end.getTime() <= start.getTime()) {
    end = new Date(end.getTime() + 24 * 60 * 60 * 1000);
  }
  return { start, end };
}

function getDefaultRange() {
  const now = new Date();
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0, 0));
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 23, 59, 59, 999));
  return { start, end };
}

async function requireAdminDirector() {
  const session = await auth();
  const email = session?.user?.email?.toLowerCase();
  if (!email) {
    return { ok: false as const, response: NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 }) };
  }

  const account = await prisma.account.findUnique({
    where: { email },
    select: { roleKey: true },
  });

  if (!account || !ALLOWED_ROLES.has(account.roleKey as RoleKey)) {
    return { ok: false as const, response: NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 }) };
  }

  return { ok: true as const };
}

function computeDerivedStatuses(params: {
  date: Date;
  plannedStart: string;
  plannedEnd: string;
  checkInAt: Date | null;
  checkOutAt: Date | null;
  overtimeMinutes: number;
  checkOutStatus: string | null;
  now: Date;
}): DerivedStatus[] {
  const { date, plannedStart, plannedEnd, checkInAt, checkOutAt, overtimeMinutes, checkOutStatus, now } = params;
  const derived: DerivedStatus[] = [];
  const window = resolveShiftWindow(date, plannedStart, plannedEnd);

  if (!checkInAt && now.getTime() >= window.start.getTime()) {
    derived.push("MISSING_CHECKIN");
  }
  if (checkInAt && !checkOutAt && now.getTime() > window.end.getTime()) {
    derived.push("MISSING_CHECKOUT");
  }
  if (overtimeMinutes > 0 || checkOutStatus === "OVERTIME") {
    derived.push("OVERTIME");
  }
  return derived;
}

function matchesStatusFilter(filterStatus: AttendanceFilterStatus, status: string, derivedStatuses: DerivedStatus[]) {
  if (filterStatus === "ALL") return true;
  if (filterStatus === "MISSING_CHECKIN" || filterStatus === "MISSING_CHECKOUT" || filterStatus === "OVERTIME") {
    return derivedStatuses.includes(filterStatus);
  }
  return status === filterStatus;
}

export async function GET(request: Request) {
  try {
    const guard = await requireAdminDirector();
    if (!guard.ok) return guard.response;

    const { searchParams } = new URL(request.url);
    const fromParam = searchParams.get("from");
    const toParam = searchParams.get("to");
    const employeeId = searchParams.get("employeeId")?.trim() || undefined;
    const departmentId = searchParams.get("departmentId")?.trim() || undefined;
    const positionId = searchParams.get("positionId")?.trim() || undefined;
    const query = searchParams.get("q")?.trim();
    const rawStatus = searchParams.get("status")?.trim().toUpperCase();
    const filterStatus: AttendanceFilterStatus =
      rawStatus &&
      [
        "ALL",
        "MISSING_CHECKIN",
        "MISSING_CHECKOUT",
        "OVERTIME",
        "PRESENT",
        "ABSENT",
        "LATE",
        "EARLY_LEAVE",
        "LATE_AND_EARLY",
        "NON_COMPLIANT",
        "INCOMPLETE",
        "NO_SHIFT",
      ].includes(rawStatus)
        ? (rawStatus as AttendanceFilterStatus)
        : "ALL";

    const from = parseDateOnly(fromParam);
    const to = parseDateOnly(toParam);
    let start: Date;
    let end: Date;

    if (from || to) {
      if (!from || !to || from.getTime() > to.getTime()) {
        return NextResponse.json(
          { ok: false, error: "Khoảng ngày không hợp lệ. Định dạng đúng là YYYY-MM-DD." },
          { status: 400 }
        );
      }
      start = from;
      end = new Date(Date.UTC(to.getUTCFullYear(), to.getUTCMonth(), to.getUTCDate(), 23, 59, 59, 999));
    } else {
      const range = getDefaultRange();
      start = range.start;
      end = range.end;
    }

    const takeParam = Number(searchParams.get("take") ?? "2000");
    const take = Number.isFinite(takeParam) ? Math.min(Math.max(takeParam, 1), 5000) : 2000;

    const employeeWhere: Prisma.EmployeeWhereInput = {};
    if (departmentId) {
      employeeWhere.departmentId = departmentId;
    }
    if (positionId) {
      employeeWhere.positionId = positionId;
    }
    if (query) {
      employeeWhere.OR = [
        { fullName: { contains: query, mode: "insensitive" } },
        { code: { contains: query, mode: "insensitive" } },
      ];
    }

    const [schedules, employees, departments, positions] = await Promise.all([
      prisma.workSchedule.findMany({
        where: {
          date: { gte: start, lte: end },
          ...(employeeId ? { employeeId } : {}),
          ...(Object.keys(employeeWhere).length > 0 ? { employee: employeeWhere } : {}),
        },
        include: {
          employee: {
            select: {
              id: true,
              code: true,
              fullName: true,
              isActive: true,
              departmentId: true,
              positionId: true,
              department: {
                select: { id: true, name: true },
              },
              position: {
                select: { id: true, name: true },
              },
            },
          },
          attendance: {
            select: {
              id: true,
              checkInAt: true,
              checkOutAt: true,
              status: true,
              checkInStatus: true,
              checkOutStatus: true,
              lateMinutes: true,
              earlyLeaveMinutes: true,
              overtimeMinutes: true,
              workMinutes: true,
            },
          },
        },
        orderBy: [{ date: "desc" }, { employee: { fullName: "asc" } }],
        take,
      }),
      prisma.employee.findMany({
        where: {
          ...(departmentId ? { departmentId } : {}),
          ...(positionId ? { positionId } : {}),
        },
        select: {
          id: true,
          code: true,
          fullName: true,
          isActive: true,
          departmentId: true,
          positionId: true,
          department: {
            select: { name: true },
          },
          position: {
            select: { name: true },
          },
        },
        orderBy: [{ isActive: "desc" }, { fullName: "asc" }],
      }),
      prisma.department.findMany({
        select: { id: true, code: true, name: true },
        orderBy: { name: "asc" },
      }),
      prisma.position.findMany({
        select: { id: true, code: true, name: true },
        orderBy: { name: "asc" },
      }),
    ]);

    const now = new Date();
    const today = getDateOnlyInTimeZone(now);

    const mapped = schedules.map((schedule) => {
      const attendance = schedule.attendance;
      const status = attendance?.status ?? "INCOMPLETE";
      const checkInAt = attendance?.checkInAt ?? null;
      const checkOutAt = attendance?.checkOutAt ?? null;
      const overtimeMinutes = attendance?.overtimeMinutes ?? 0;
      const checkOutStatus = attendance?.checkOutStatus ?? null;
      const isFuture = schedule.date.getTime() > today.getTime();
      const derivedStatuses: DerivedStatus[] = isFuture
        ? overtimeMinutes > 0 || checkOutStatus === "OVERTIME"
          ? ["OVERTIME"]
          : []
        : computeDerivedStatuses({
            date: schedule.date,
            plannedStart: schedule.plannedStart,
            plannedEnd: schedule.plannedEnd,
            checkInAt,
            checkOutAt,
            overtimeMinutes,
            checkOutStatus,
            now,
          });

      return {
        id: schedule.id,
        date: schedule.date.toISOString().slice(0, 10),
        employee: {
          id: schedule.employee.id,
          code: schedule.employee.code,
          fullName: schedule.employee.fullName,
          isActive: schedule.employee.isActive,
          departmentId: schedule.employee.departmentId,
          departmentName: schedule.employee.department?.name ?? null,
          positionId: schedule.employee.positionId,
          positionName: schedule.employee.position?.name ?? null,
        },
        shift: {
          name: schedule.plannedName,
          start: schedule.plannedStart,
          end: schedule.plannedEnd,
        },
        attendance: {
          id: attendance?.id ?? null,
          checkInAt: checkInAt?.toISOString() ?? null,
          checkOutAt: checkOutAt?.toISOString() ?? null,
          status,
          checkInStatus: attendance?.checkInStatus ?? null,
          checkOutStatus: checkOutStatus,
          lateMinutes: attendance?.lateMinutes ?? 0,
          earlyLeaveMinutes: attendance?.earlyLeaveMinutes ?? 0,
          overtimeMinutes,
          workMinutes: attendance?.workMinutes ?? 0,
        },
        derivedStatuses,
      };
    });

    const items = mapped.filter((item) =>
      matchesStatusFilter(filterStatus, item.attendance.status, item.derivedStatuses)
    );

    return NextResponse.json({
      ok: true,
      items,
      employees: employees.map((employee) => ({
        id: employee.id,
        code: employee.code,
        fullName: employee.fullName,
        isActive: employee.isActive,
        departmentId: employee.departmentId,
        departmentName: employee.department?.name ?? null,
        positionId: employee.positionId,
        positionName: employee.position?.name ?? null,
      })),
      departments,
      positions,
      filters: {
        from: start.toISOString().slice(0, 10),
        to: end.toISOString().slice(0, 10),
        employeeId: employeeId ?? "ALL",
        departmentId: departmentId ?? "ALL",
        positionId: positionId ?? "ALL",
        status: filterStatus,
      },
      total: items.length,
      limited: schedules.length >= take,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
