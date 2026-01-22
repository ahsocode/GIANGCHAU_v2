import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

function formatDate(value: Date) {
  return value.toISOString().slice(0, 10);
}

export async function GET() {
  const session = await auth();
  const email = session?.user?.email?.toLowerCase();
  if (!email) {
    return NextResponse.json({ message: "Chưa đăng nhập" }, { status: 401 });
  }

  const account = await prisma.account.findUnique({
    where: { email },
    include: {
      employee: {
        include: {
          department: { select: { name: true } },
          position: { select: { name: true } },
        },
      },
    },
  });

  if (!account?.employee) {
    return NextResponse.json({ message: "Chưa có hồ sơ nhân viên." }, { status: 404 });
  }

  const emp = account.employee;
  const now = new Date();
  const todayUtc = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
  const monthStart = new Date(Date.UTC(now.getFullYear(), now.getMonth(), 1));
  const monthEnd = new Date(Date.UTC(now.getFullYear(), now.getMonth() + 1, 1));

  const [scheduleCount, statusGroups, upcomingSchedules, recentAttendance, upcomingLeaves] =
    await Promise.all([
      prisma.workSchedule.count({
        where: { employeeId: emp.id, date: { gte: monthStart, lt: monthEnd } },
      }),
      prisma.attendanceRecord.groupBy({
        by: ["status"],
        where: { employeeId: emp.id, date: { gte: monthStart, lt: monthEnd } },
        _count: { status: true },
      }),
      prisma.workSchedule.findMany({
        where: { employeeId: emp.id, date: { gte: todayUtc } },
        orderBy: { date: "asc" },
        take: 3,
        select: { date: true, plannedName: true, plannedStart: true, plannedEnd: true },
      }),
      prisma.attendanceRecord.findMany({
        where: { employeeId: emp.id },
        orderBy: { date: "desc" },
        take: 5,
        select: {
          date: true,
          status: true,
          checkInAt: true,
          checkOutAt: true,
          schedule: { select: { plannedName: true, plannedStart: true, plannedEnd: true } },
        },
      }),
      prisma.leaveRequest.findMany({
        where: { employeeId: emp.id, startDate: { gte: todayUtc } },
        orderBy: { startDate: "asc" },
        take: 3,
        select: { id: true, type: true, status: true, startDate: true, endDate: true },
      }),
    ]);

  const statusMap = statusGroups.reduce<Record<string, number>>((acc, item) => {
    acc[item.status ?? "UNKNOWN"] = item._count.status ?? 0;
    return acc;
  }, {});

  return NextResponse.json({
    profile: {
      name: emp.fullName || account.name || account.email,
      positionName: emp.position?.name ?? null,
      departmentName: emp.department?.name ?? null,
      code: emp.code ?? null,
      personalEmail: emp.personalEmail ?? null,
      phone: emp.phone ?? null,
      joinedAt: emp.joinedAt ? formatDate(emp.joinedAt) : null,
      employmentType: emp.employmentType,
      accountEmail: account.email,
    },
    summary: {
      scheduleCount,
      statusMap,
      now: formatDate(now),
    },
    upcomingSchedules: upcomingSchedules.map((item) => ({
      date: formatDate(item.date),
      plannedName: item.plannedName ?? null,
      plannedStart: item.plannedStart ?? null,
      plannedEnd: item.plannedEnd ?? null,
    })),
    recentAttendance: recentAttendance.map((record) => ({
      date: formatDate(record.date),
      status: record.status ?? null,
      checkInAt: record.checkInAt?.toISOString() ?? null,
      checkOutAt: record.checkOutAt?.toISOString() ?? null,
      plannedName: record.schedule?.plannedName ?? null,
      plannedStart: record.schedule?.plannedStart ?? null,
      plannedEnd: record.schedule?.plannedEnd ?? null,
    })),
    upcomingLeaves: upcomingLeaves.map((leave) => ({
      id: leave.id,
      type: leave.type,
      status: leave.status,
      startDate: formatDate(leave.startDate),
      endDate: formatDate(leave.endDate),
    })),
  });
}
