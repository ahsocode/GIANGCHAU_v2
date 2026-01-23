import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import type { RequestType } from "@prisma/client";

type RequestItem = {
  id: string;
  type: "SHIFT_CHANGE" | "PROFILE_UPDATE" | "LEAVE" | "ATTENDANCE_ADJUSTMENT";
  status: string;
  submittedAt: string | null;
  summary: string;
  history: {
    status: string;
    note: string | null;
    handledByName: string | null;
    createdAt: string;
  }[];
};

function formatDate(value: Date) {
  return value.toISOString();
}

function mapProfileField(value: string) {
  if (value === "ACCOUNT_EMAIL") return "Email tài khoản";
  if (value === "PHONE") return "Số điện thoại";
  if (value === "CITIZEN_ID") return "CCCD/CMND";
  if (value === "SOCIAL_INSURANCE") return "BHXH";
  return value;
}

function mapAttendanceField(value: string) {
  if (value === "CHECK_IN_TIME") return "Giờ vào";
  if (value === "CHECK_OUT_TIME") return "Giờ ra";
  if (value === "CHECK_IN_STATUS") return "Trạng thái giờ vào";
  if (value === "CHECK_OUT_STATUS") return "Trạng thái giờ ra";
  return value;
}

function mapLeaveType(value: string) {
  if (value === "ANNUAL") return "Phép năm";
  if (value === "SICK") return "Ốm";
  if (value === "UNPAID") return "Không lương";
  return "Khác";
}

export async function GET() {
  const session = await auth();
  const email = session?.user?.email?.toLowerCase();
  if (!email) {
    return NextResponse.json({ message: "Chưa đăng nhập" }, { status: 401 });
  }

  const account = await prisma.account.findUnique({
    where: { email },
    select: { employeeId: true },
  });
  if (!account?.employeeId) {
    return NextResponse.json({ message: "Không tìm thấy nhân viên." }, { status: 404 });
  }

  const [shiftRequests, profileRequests, leaveRequests, attendanceRequests] = await Promise.all([
    prisma.shiftChangeRequest.findMany({
      where: { employeeId: account.employeeId },
      orderBy: { submittedAt: "desc" },
      take: 50,
      include: {
        currentShift: { select: { name: true, code: true } },
        desiredShift: { select: { name: true, code: true } },
      },
    }),
    prisma.profileUpdateRequest.findMany({
      where: { employeeId: account.employeeId },
      orderBy: { submittedAt: "desc" },
      take: 50,
    }),
    prisma.leaveRequest.findMany({
      where: { employeeId: account.employeeId },
      orderBy: { submittedAt: "desc" },
      take: 50,
    }),
    prisma.attendanceAdjustmentRequest.findMany({
      where: { employeeId: account.employeeId },
      orderBy: { submittedAt: "desc" },
      take: 50,
    }),
  ]);

  const items: RequestItem[] = [
    ...shiftRequests.map((req) => ({
      id: req.id,
      type: "SHIFT_CHANGE" as const,
      status: req.status,
      submittedAt: req.submittedAt ? formatDate(req.submittedAt) : null,
      summary: `${req.currentShift.name} (${req.currentShift.code}) → ${req.desiredShift.name} (${req.desiredShift.code})`,
      history: [],
    })),
    ...profileRequests.map((req) => {
      const previousValue = (req as { previousValue?: string | null }).previousValue ?? null;
      return {
      id: req.id,
      type: "PROFILE_UPDATE" as const,
      status: req.status,
      submittedAt: req.submittedAt ? formatDate(req.submittedAt) : null,
      summary: `${mapProfileField(req.field)}: ${previousValue ?? "—"} → ${req.newValue}`,
      history: [],
      };
    }),
    ...leaveRequests.map((req) => ({
      id: req.id,
      type: "LEAVE" as const,
      status: req.status,
      submittedAt: req.submittedAt ? formatDate(req.submittedAt) : null,
      summary: `${mapLeaveType(req.type)} · ${req.startDate.toISOString().slice(0, 10)} → ${req.endDate
        .toISOString()
        .slice(0, 10)}`,
      history: [],
    })),
    ...attendanceRequests.map((req) => ({
      id: req.id,
      type: "ATTENDANCE_ADJUSTMENT" as const,
      status: req.status,
      submittedAt: req.submittedAt ? formatDate(req.submittedAt) : null,
      summary: `${mapAttendanceField(req.field)} · ${req.date.toISOString().slice(0, 10)} → ${req.newValue}`,
      history: [],
    })),
  ];

  items.sort((a, b) => {
    const aTime = a.submittedAt ? new Date(a.submittedAt).getTime() : 0;
    const bTime = b.submittedAt ? new Date(b.submittedAt).getTime() : 0;
    return bTime - aTime;
  });

  const idsByType = items.reduce(
    (acc, item) => {
      acc[item.type].push(item.id);
      return acc;
    },
    {
      SHIFT_CHANGE: [] as string[],
      PROFILE_UPDATE: [] as string[],
      LEAVE: [] as string[],
      ATTENDANCE_ADJUSTMENT: [] as string[],
    }
  );

  const logFilters = [
    idsByType.SHIFT_CHANGE.length
      ? { requestType: "SHIFT_CHANGE", requestId: { in: idsByType.SHIFT_CHANGE } }
      : null,
    idsByType.PROFILE_UPDATE.length
      ? { requestType: "PROFILE_UPDATE", requestId: { in: idsByType.PROFILE_UPDATE } }
      : null,
    idsByType.LEAVE.length ? { requestType: "LEAVE", requestId: { in: idsByType.LEAVE } } : null,
    idsByType.ATTENDANCE_ADJUSTMENT.length
      ? { requestType: "ATTENDANCE_ADJUSTMENT", requestId: { in: idsByType.ATTENDANCE_ADJUSTMENT } }
      : null,
  ].filter(Boolean) as { requestType: RequestType; requestId: { in: string[] } }[];

  if (logFilters.length > 0) {
    const logs = await prisma.requestActionLog.findMany({
      where: { OR: logFilters },
      orderBy: { createdAt: "asc" },
      include: { handledBy: { select: { name: true, email: true } } },
    });

    const logMap = new Map<string, RequestItem["history"]>();
    logs.forEach((log) => {
      const handledBy = (log as { handledBy?: { name?: string | null; email?: string | null } | null }).handledBy;
      const key = `${log.requestType}:${log.requestId}`;
      const list = logMap.get(key) ?? [];
      list.push({
        status: log.status,
        note: log.note ?? null,
        handledByName: handledBy?.name ?? handledBy?.email ?? null,
        createdAt: formatDate(log.createdAt),
      });
      logMap.set(key, list);
    });

    items.forEach((item) => {
      item.history = logMap.get(`${item.type}:${item.id}`) ?? [];
    });
  }

  return NextResponse.json({ items });
}
