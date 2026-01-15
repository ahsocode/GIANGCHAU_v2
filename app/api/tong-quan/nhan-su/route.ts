import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

function getMonthRange(date: Date) {
  const start = new Date(Date.UTC(date.getFullYear(), date.getMonth(), 1, 0, 0, 0));
  const end = new Date(Date.UTC(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999));
  return { start, end };
}

export async function GET() {
  const now = new Date();
  const { start: monthStart, end: monthEnd } = getMonthRange(now);
  const sixMonthsAgo = new Date(Date.UTC(now.getFullYear(), now.getMonth() - 5, 1, 0, 0, 0));

  const [
    totalEmployees,
    newEmployees,
    resignedEmployees,
    activeEmployees,
    departmentCount,
    positionCount,
    employmentGroups,
    recentEmployees,
    activeByDepartmentRaw,
    topDepartments,
  ] = await Promise.all([
    prisma.employee.count(),
    prisma.employee.count({ where: { createdAt: { gte: monthStart, lte: monthEnd } } }),
    prisma.employee.count({
      where: { OR: [{ isActive: false }, { resignedAt: { not: null } }] },
    }),
    prisma.employee.count({ where: { isActive: true } }),
    prisma.department.count(),
    prisma.position.count(),
    prisma.employee.groupBy({
      by: ["employmentType"],
      _count: { _all: true },
    }),
    prisma.employee.findMany({
      where: { createdAt: { gte: sixMonthsAgo } },
      select: { createdAt: true },
    }),
    prisma.employee.groupBy({
      by: ["departmentId"],
      where: { isActive: true },
      _count: { _all: true },
    }),
    prisma.department.findMany({
      select: { id: true, name: true, _count: { select: { employees: true } } },
      orderBy: { employees: { _count: "desc" } },
      take: 5,
    }),
  ]);

  const ctCount = employmentGroups.find((g) => g.employmentType === "CT")?._count._all ?? 0;
  const tvCount = employmentGroups.find((g) => g.employmentType === "TV")?._count._all ?? 0;

  const monthBuckets = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(Date.UTC(now.getFullYear(), now.getMonth() - (5 - i), 1, 0, 0, 0));
    const label = `${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
    return { key: `${d.getFullYear()}-${d.getMonth() + 1}`, label, value: 0 };
  });
  const bucketMap = new Map(monthBuckets.map((b) => [b.key, b]));
  recentEmployees.forEach((item) => {
    const d = item.createdAt;
    const key = `${d.getUTCFullYear()}-${d.getUTCMonth() + 1}`;
    const bucket = bucketMap.get(key);
    if (bucket) bucket.value += 1;
  });

  const departmentIds = activeByDepartmentRaw
    .map((item) => item.departmentId)
    .filter((id): id is string => Boolean(id));
  const departments = await prisma.department.findMany({
    where: { id: { in: departmentIds } },
    select: { id: true, name: true },
  });
  const departmentMap = new Map(departments.map((dept) => [dept.id, dept.name]));
  const activeByDepartment = activeByDepartmentRaw.map((item) => ({
    id: item.departmentId ?? "none",
    name: item.departmentId ? departmentMap.get(item.departmentId) ?? "Không xác định" : "Chưa phân bộ phận",
    count: item._count._all,
  }));

  return NextResponse.json({
    totalEmployees,
    newEmployees,
    resignedEmployees,
    activeEmployees,
    departmentCount,
    positionCount,
    employmentCounts: { ct: ctCount, tv: tvCount },
    newEmployeesByMonth: monthBuckets,
    activeByDepartment,
    topDepartments: topDepartments.map((d) => ({
      id: d.id,
      name: d.name,
      count: d._count.employees,
    })),
  });
}
