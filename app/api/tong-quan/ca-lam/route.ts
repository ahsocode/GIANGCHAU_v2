import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const now = new Date();
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0));
  const monthEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0, 23, 59, 59, 999));

  const [shifts, activeEmployees, schedules] = await Promise.all([
    prisma.workShift.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        code: true,
        name: true,
        startTime: true,
        endTime: true,
        status: true,
      },
    }),
    prisma.employee.findMany({
      where: { isActive: true },
      select: { id: true },
    }),
    prisma.workSchedule.findMany({
      where: { date: { gte: monthStart, lte: monthEnd } },
      select: { employeeId: true, workShiftId: true },
    }),
  ]);

  const shiftEmployeeMap = new Map<string, Set<string>>();
  const assignedEmployees = new Set<string>();
  schedules.forEach((item) => {
    if (!item.workShiftId) return;
    if (!shiftEmployeeMap.has(item.workShiftId)) {
      shiftEmployeeMap.set(item.workShiftId, new Set<string>());
    }
    shiftEmployeeMap.get(item.workShiftId)?.add(item.employeeId);
    assignedEmployees.add(item.employeeId);
  });

  const activeEmployeeCount = activeEmployees.length;
  const unassignedCount = activeEmployees.filter((emp) => !assignedEmployees.has(emp.id)).length;

  const shiftStats = shifts.map((shift) => {
    const count = shiftEmployeeMap.get(shift.id)?.size ?? 0;
    return {
      ...shift,
      employeeCount: count,
    };
  });

  const totalAssigned = shiftStats.reduce((sum, shift) => sum + shift.employeeCount, 0);
  const ratio = [
    ...shiftStats.map((shift) => ({
      key: shift.id,
      label: `${shift.code} - ${shift.name}`,
      count: shift.employeeCount,
    })),
    {
      key: "unassigned",
      label: "Chưa có ca",
      count: unassignedCount,
    },
  ];

  return NextResponse.json({
    totalShifts: shifts.length,
    totalActiveEmployees: activeEmployeeCount,
    totalAssigned,
    totalUnassigned: unassignedCount,
    shifts: shiftStats,
    ratio,
    monthRange: {
      from: monthStart.toISOString().slice(0, 10),
      to: monthEnd.toISOString().slice(0, 10),
    },
  });
}
