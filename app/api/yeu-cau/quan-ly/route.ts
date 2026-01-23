import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import type { AttendanceCheckInStatus, AttendanceCheckOutStatus, RequestType } from "@prisma/client";

function getLocalDateFromUtcDate(value: Date) {
  return new Date(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate());
}

function combineDateTime(date: Date, time: string) {
  const [hours, minutes] = time.split(":").map(Number);
  const next = getLocalDateFromUtcDate(date);
  next.setHours(hours || 0, minutes || 0, 0, 0);
  return next;
}

function normalizeAttendanceTime(params: {
  date: Date;
  time: string;
  plannedStart: string;
  plannedEnd: string;
  kind: "CHECK_IN_TIME" | "CHECK_OUT_TIME";
}) {
  const { date, time, plannedStart, plannedEnd, kind } = params;
  const [timeHours, timeMinutes] = time.split(":").map(Number);
  const [startHours, startMinutes] = plannedStart.split(":").map(Number);
  const [endHours, endMinutes] = plannedEnd.split(":").map(Number);
  const base = combineDateTime(date, time);
  const start = combineDateTime(date, plannedStart);
  const endSameDay = combineDateTime(date, plannedEnd);
  if (endSameDay.getTime() > start.getTime()) return base;

  const minutesValue = (timeHours || 0) * 60 + (timeMinutes || 0);
  const startValue = (startHours || 0) * 60 + (startMinutes || 0);
  const endValue = (endHours || 0) * 60 + (endMinutes || 0);

  if (kind === "CHECK_IN_TIME") {
    if (minutesValue <= endValue) return new Date(base.getTime() + 24 * 60 * 60 * 1000);
    return base;
  }

  if (minutesValue < startValue) return new Date(base.getTime() + 24 * 60 * 60 * 1000);
  return base;
}

function resolveShiftWindow(date: Date, startTime: string, endTime: string) {
  const start = combineDateTime(date, startTime);
  let end = combineDateTime(date, endTime);
  if (end.getTime() <= start.getTime()) {
    end = new Date(end.getTime() + 24 * 60 * 60 * 1000);
  }
  return { start, end };
}

function diffMinutes(start: Date, end: Date) {
  return Math.max(0, Math.round((end.getTime() - start.getTime()) / 60000));
}

function computeSummary(params: {
  schedule: {
    date: Date;
    plannedStart: string;
    plannedEnd: string;
    plannedBreakMinutes?: number | null;
    plannedLateGraceMinutes?: number | null;
    plannedEarlyGraceMinutes?: number | null;
  };
  record: {
    checkInAt: Date | null;
    checkOutAt: Date | null;
  };
}) {
  const { schedule, record } = params;
  const window = resolveShiftWindow(schedule.date, schedule.plannedStart, schedule.plannedEnd);
  const plannedBreak = schedule.plannedBreakMinutes ?? 0;
  const lateGrace = schedule.plannedLateGraceMinutes ?? 0;
  const earlyGrace = schedule.plannedEarlyGraceMinutes ?? 0;
  const lateBoundary = new Date(window.start.getTime() + lateGrace * 60000);
  const earlyBoundary = new Date(window.end.getTime() - earlyGrace * 60000);

  const checkInAt = record.checkInAt;
  const checkOutAt = record.checkOutAt;

  const plannedMinutes = Math.max(0, diffMinutes(window.start, window.end) - plannedBreak);
  const actualMinutes =
    checkInAt && checkOutAt ? Math.max(0, diffMinutes(checkInAt, checkOutAt) - plannedBreak) : 0;

  const lateMinutes = checkInAt && checkInAt > lateBoundary ? diffMinutes(lateBoundary, checkInAt) : 0;
  const earlyLeaveMinutes =
    checkOutAt && checkOutAt < earlyBoundary ? diffMinutes(checkOutAt, earlyBoundary) : 0;
  const overtimeMinutes = checkOutAt && checkOutAt > window.end ? diffMinutes(window.end, checkOutAt) : 0;

  const checkInStatusValue: AttendanceCheckInStatus | null = checkInAt
    ? lateMinutes > 0
      ? "LATE"
      : "ON_TIME"
    : null;
  const checkOutStatusValue: AttendanceCheckOutStatus | null = checkOutAt
    ? overtimeMinutes > 0
      ? "OVERTIME"
      : earlyLeaveMinutes > 0
        ? "EARLY"
        : "ON_TIME"
    : null;

  return {
    plannedMinutes,
    actualMinutes,
    lateMinutes,
    earlyLeaveMinutes,
    overtimeMinutes,
    checkInStatusValue,
    checkOutStatusValue,
  };
}

type RequestItem = {
  id: string;
  type: "SHIFT_CHANGE" | "PROFILE_UPDATE" | "LEAVE" | "ATTENDANCE_ADJUSTMENT";
  status: string;
  submittedAt: string | null;
  employee: {
    name: string;
    code: string;
    positionName: string | null;
    departmentName: string | null;
  };
  summary: string;
  leaveType?: "ANNUAL" | "SICK" | "UNPAID" | "OTHER" | null;
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

export async function GET(request: Request) {
  const session = await auth();
  const email = session?.user?.email?.toLowerCase();
  if (!email) {
    return NextResponse.json({ message: "Chưa đăng nhập" }, { status: 401 });
  }

  const account = await prisma.account.findUnique({
    where: { email },
    select: { roleKey: true },
  });
  if (!account || account.roleKey === "EMPLOYEE") {
    return NextResponse.json({ message: "Không có quyền truy cập." }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const type = searchParams.get("type")?.trim() as
    | "SHIFT_CHANGE"
    | "PROFILE_UPDATE"
    | "LEAVE"
    | "ATTENDANCE_ADJUSTMENT"
    | undefined;
  const statusFilter = searchParams.get("status")?.trim() as
    | "DRAFT"
    | "SUBMITTED"
    | "APPROVED"
    | "REJECTED"
    | "CANCELLED"
    | undefined;
  const page = Math.max(1, Number(searchParams.get("page") ?? "1") || 1);
  const take = 10;
  const skip = (page - 1) * take;

  const fetchAll = !type;

  const [shiftRequests, profileRequests, leaveRequests, attendanceRequests] = await Promise.all([
    fetchAll || type === "SHIFT_CHANGE"
      ? prisma.shiftChangeRequest.findMany({
          orderBy: { submittedAt: "desc" },
          ...(statusFilter ? { where: { status: statusFilter } } : {}),
          include: {
            employee: {
              select: {
                fullName: true,
                code: true,
                position: { select: { name: true } },
                department: { select: { name: true } },
              },
            },
            currentShift: { select: { name: true, code: true } },
            desiredShift: { select: { name: true, code: true } },
          },
        })
      : Promise.resolve([]),
    fetchAll || type === "PROFILE_UPDATE"
      ? prisma.profileUpdateRequest.findMany({
          orderBy: { submittedAt: "desc" },
          ...(statusFilter ? { where: { status: statusFilter } } : {}),
          include: {
            employee: {
              select: {
                fullName: true,
                code: true,
                position: { select: { name: true } },
                department: { select: { name: true } },
              },
            },
          },
        })
      : Promise.resolve([]),
    fetchAll || type === "LEAVE"
      ? prisma.leaveRequest.findMany({
          orderBy: { submittedAt: "desc" },
          ...(statusFilter ? { where: { status: statusFilter } } : {}),
          include: {
            employee: {
              select: {
                fullName: true,
                code: true,
                position: { select: { name: true } },
                department: { select: { name: true } },
              },
            },
          },
        })
      : Promise.resolve([]),
    fetchAll || type === "ATTENDANCE_ADJUSTMENT"
      ? prisma.attendanceAdjustmentRequest.findMany({
          orderBy: { submittedAt: "desc" },
          ...(statusFilter ? { where: { status: statusFilter } } : {}),
          include: {
            employee: {
              select: {
                fullName: true,
                code: true,
                position: { select: { name: true } },
                department: { select: { name: true } },
              },
            },
          },
        })
      : Promise.resolve([]),
  ]);

  const items: RequestItem[] = [
    ...shiftRequests.map((req) => ({
      id: req.id,
      type: "SHIFT_CHANGE" as const,
      status: req.status,
      submittedAt: req.submittedAt ? formatDate(req.submittedAt) : null,
      employee: {
        name: req.employee.fullName,
        code: req.employee.code,
        positionName: req.employee.position?.name ?? null,
        departmentName: req.employee.department?.name ?? null,
      },
      summary: `${req.date.toISOString().slice(0, 10)} · ${req.currentShift.name} (${req.currentShift.code}) → ${req.desiredShift.name} (${req.desiredShift.code})`,
      history: [],
    })),
    ...profileRequests.map((req) => {
      const previousValue = (req as { previousValue?: string | null }).previousValue ?? null;
      return {
      id: req.id,
      type: "PROFILE_UPDATE" as const,
      status: req.status,
      submittedAt: req.submittedAt ? formatDate(req.submittedAt) : null,
      employee: {
        name: req.employee.fullName,
        code: req.employee.code,
        positionName: req.employee.position?.name ?? null,
        departmentName: req.employee.department?.name ?? null,
      },
      summary: `${mapProfileField(req.field)}: ${previousValue ?? "—"} → ${req.newValue}`,
      history: [],
      };
    }),
    ...leaveRequests.map((req) => ({
      id: req.id,
      type: "LEAVE" as const,
      status: req.status,
      submittedAt: req.submittedAt ? formatDate(req.submittedAt) : null,
      employee: {
        name: req.employee.fullName,
        code: req.employee.code,
        positionName: req.employee.position?.name ?? null,
        departmentName: req.employee.department?.name ?? null,
      },
      summary: `${mapLeaveType(req.type)} · ${req.startDate.toISOString().slice(0, 10)} → ${req.endDate
        .toISOString()
        .slice(0, 10)}`,
      leaveType: req.type,
      history: [],
    })),
    ...attendanceRequests.map((req) => ({
      id: req.id,
      type: "ATTENDANCE_ADJUSTMENT" as const,
      status: req.status,
      submittedAt: req.submittedAt ? formatDate(req.submittedAt) : null,
      employee: {
        name: req.employee.fullName,
        code: req.employee.code,
        positionName: req.employee.position?.name ?? null,
        departmentName: req.employee.department?.name ?? null,
      },
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

  const totalCounts = await Promise.all([
    fetchAll || type === "SHIFT_CHANGE"
      ? prisma.shiftChangeRequest.count({
          ...(statusFilter ? { where: { status: statusFilter } } : {}),
        })
      : Promise.resolve(0),
    fetchAll || type === "PROFILE_UPDATE"
      ? prisma.profileUpdateRequest.count({
          ...(statusFilter ? { where: { status: statusFilter } } : {}),
        })
      : Promise.resolve(0),
    fetchAll || type === "LEAVE"
      ? prisma.leaveRequest.count({
          ...(statusFilter ? { where: { status: statusFilter } } : {}),
        })
      : Promise.resolve(0),
    fetchAll || type === "ATTENDANCE_ADJUSTMENT"
      ? prisma.attendanceAdjustmentRequest.count({
          ...(statusFilter ? { where: { status: statusFilter } } : {}),
        })
      : Promise.resolve(0),
  ]);

  const total = totalCounts.reduce((sum, value) => sum + value, 0);
  const totalPages = Math.max(1, Math.ceil(total / take));
  const pageItems = items.slice(skip, skip + take);

  return NextResponse.json({ items: pageItems, page, totalPages, total });
}

type ActionPayload = {
  type?: "SHIFT_CHANGE" | "PROFILE_UPDATE" | "LEAVE" | "ATTENDANCE_ADJUSTMENT";
  id?: string;
  status?: "APPROVED" | "REJECTED" | "CANCELLED";
  note?: string;
  holidayTypeId?: string;
};

export async function PATCH(request: Request) {
  const session = await auth();
  const email = session?.user?.email?.toLowerCase();
  if (!email) {
    return NextResponse.json({ message: "Chưa đăng nhập" }, { status: 401 });
  }

  const body = (await request.json()) as ActionPayload;
  const type = body.type;
  const id = body.id?.trim();
  const status = body.status;
  const note = body.note?.trim();
  const holidayTypeId = body.holidayTypeId?.trim();

  if (!type || !id || !status) {
    return NextResponse.json({ message: "Thiếu thông tin xử lý." }, { status: 400 });
  }

  const account = await prisma.account.findUnique({
    where: { email },
    select: { id: true, roleKey: true },
  });
  if (!account || account.roleKey === "EMPLOYEE") {
    return NextResponse.json({ message: "Không có quyền truy cập." }, { status: 403 });
  }

  const allowed = ["APPROVED", "REJECTED", "CANCELLED"];
  if (!allowed.includes(status)) {
    return NextResponse.json({ message: "Trạng thái không hợp lệ." }, { status: 400 });
  }

  try {
    await prisma.$transaction(async (tx) => {
      if (type === "SHIFT_CHANGE") {
        const req = await tx.shiftChangeRequest.findUnique({
          where: { id },
          select: { status: true, employeeId: true, date: true, desiredShiftId: true },
        });
        if (!req) throw new Error("Không tìm thấy yêu cầu.");

        await tx.shiftChangeRequest.update({
          where: { id },
          data: { status },
        });

        if (status === "APPROVED" && req.status !== "APPROVED") {
          const desiredShift = await tx.workShift.findUnique({
            where: { id: req.desiredShiftId },
            select: {
              id: true,
              name: true,
              startTime: true,
              endTime: true,
              breakMinutes: true,
              lateGraceMinutes: true,
              earlyGraceMinutes: true,
            },
          });
          if (!desiredShift) throw new Error("Không tìm thấy ca mong muốn.");

          const schedule = await tx.workSchedule.findUnique({
            where: { employeeId_date: { employeeId: req.employeeId, date: req.date } },
            select: { id: true },
          });
          if (!schedule) throw new Error("Không tìm thấy lịch làm trong ngày.");

          await tx.workSchedule.update({
            where: { id: schedule.id },
            data: {
              workShiftId: desiredShift.id,
              plannedName: desiredShift.name,
              plannedStart: desiredShift.startTime,
              plannedEnd: desiredShift.endTime,
              plannedBreakMinutes: desiredShift.breakMinutes,
              plannedLateGraceMinutes: desiredShift.lateGraceMinutes,
              plannedEarlyGraceMinutes: desiredShift.earlyGraceMinutes,
            },
          });

          await tx.employeeBenefit.upsert({
            where: { employeeId: req.employeeId },
            create: {
              employeeId: req.employeeId,
              usedShiftChangeCount: 1,
            },
            update: {
              usedShiftChangeCount: { increment: 1 },
            },
          });
        }
      } else if (type === "PROFILE_UPDATE") {
        const req = await tx.profileUpdateRequest.findUnique({
          where: { id },
          select: { id: true, field: true, newValue: true, employeeId: true },
        });
        if (!req) throw new Error("Không tìm thấy yêu cầu.");
        await tx.profileUpdateRequest.update({
          where: { id },
          data: { status },
        });

        if (status === "APPROVED") {
          if (req.field === "ACCOUNT_EMAIL") {
            await tx.account.update({
              where: { employeeId: req.employeeId },
              data: { email: req.newValue },
            });
          } else if (req.field === "PHONE") {
            await tx.employee.update({
              where: { id: req.employeeId },
              data: { phone: req.newValue },
            });
          } else if (req.field === "CITIZEN_ID") {
            await tx.employee.update({
              where: { id: req.employeeId },
              data: { citizenIdNumber: req.newValue },
            });
          } else if (req.field === "SOCIAL_INSURANCE") {
            await tx.employee.update({
              where: { id: req.employeeId },
              data: { socialInsuranceNumber: req.newValue },
            });
          }
        }
      } else if (type === "LEAVE") {
        const req = await tx.leaveRequest.findUnique({
          where: { id },
          select: { id: true, employeeId: true, startDate: true, endDate: true },
        });
        if (!req) throw new Error("Không tìm thấy yêu cầu.");
        if (status === "APPROVED" && !holidayTypeId) {
          throw new Error("Vui lòng chọn loại ngày nghỉ.");
        }
        await tx.leaveRequest.update({
          where: { id },
          data: {
            status,
            ...(status === "APPROVED" && holidayTypeId ? { holidayTypeId } : {}),
          },
        });

        if (status === "APPROVED" && holidayTypeId) {
          const start = new Date(
            Date.UTC(
              req.startDate.getUTCFullYear(),
              req.startDate.getUTCMonth(),
              req.startDate.getUTCDate()
            )
          );
          const end = new Date(
            Date.UTC(
              req.endDate.getUTCFullYear(),
              req.endDate.getUTCMonth(),
              req.endDate.getUTCDate()
            )
          );

          const existing = await tx.holiday.findMany({
            where: {
              employeeId: req.employeeId,
              date: { gte: start, lte: end },
            },
            select: { date: true },
          });
          const existingKeys = new Set(existing.map((item) => item.date.toISOString().slice(0, 10)));

          const days: { date: Date; employeeId: string; holidayTypeId: string; scope: "EMPLOYEE" }[] = [];
          const cursor = new Date(start);
          while (cursor <= end) {
            const key = cursor.toISOString().slice(0, 10);
            if (!existingKeys.has(key)) {
              days.push({
                date: new Date(cursor),
                employeeId: req.employeeId,
                holidayTypeId,
                scope: "EMPLOYEE",
              });
            }
            cursor.setUTCDate(cursor.getUTCDate() + 1);
          }

          if (days.length > 0) {
            await tx.holiday.createMany({ data: days });
          }

          await tx.workSchedule.deleteMany({
            where: {
              employeeId: req.employeeId,
              date: { gte: start, lte: end },
            },
          });
        }
      } else if (type === "ATTENDANCE_ADJUSTMENT") {
        const req = await tx.attendanceAdjustmentRequest.findUnique({
          where: { id },
          select: { id: true, employeeId: true, date: true, field: true, newValue: true },
        });
        if (!req) throw new Error("Không tìm thấy yêu cầu.");
        await tx.attendanceAdjustmentRequest.update({
          where: { id },
          data: { status },
        });

        if (status === "APPROVED") {
          const schedule = await tx.workSchedule.findUnique({
            where: { employeeId_date: { employeeId: req.employeeId, date: req.date } },
            select: {
              id: true,
              date: true,
              plannedStart: true,
              plannedEnd: true,
              plannedBreakMinutes: true,
              plannedLateGraceMinutes: true,
              plannedEarlyGraceMinutes: true,
            },
          });
          if (!schedule) throw new Error("Không tìm thấy ca làm trong ngày.");

          const record = await tx.attendanceRecord.upsert({
            where: { employeeId_date: { employeeId: req.employeeId, date: req.date } },
            create: {
              employeeId: req.employeeId,
              date: req.date,
              scheduleId: schedule.id,
              status: "INCOMPLETE",
              checkInStatus: "PENDING",
              checkOutStatus: "PENDING",
              source: "MANUAL",
            },
            update: { scheduleId: schedule.id },
            select: { id: true, checkInAt: true, checkOutAt: true },
          });

          const updatedCheckInAt =
            req.field === "CHECK_IN_TIME"
              ? normalizeAttendanceTime({
                  date: req.date,
                  time: req.newValue,
                  plannedStart: schedule.plannedStart,
                  plannedEnd: schedule.plannedEnd,
                  kind: "CHECK_IN_TIME",
                })
              : record.checkInAt;
          const updatedCheckOutAt =
            req.field === "CHECK_OUT_TIME"
              ? normalizeAttendanceTime({
                  date: req.date,
                  time: req.newValue,
                  plannedStart: schedule.plannedStart,
                  plannedEnd: schedule.plannedEnd,
                  kind: "CHECK_OUT_TIME",
                })
              : record.checkOutAt;

          const summary = computeSummary({
            schedule: {
              date: schedule.date,
              plannedStart: schedule.plannedStart,
              plannedEnd: schedule.plannedEnd,
              plannedBreakMinutes: schedule.plannedBreakMinutes,
              plannedLateGraceMinutes: schedule.plannedLateGraceMinutes,
              plannedEarlyGraceMinutes: schedule.plannedEarlyGraceMinutes,
            },
            record: {
              checkInAt: updatedCheckInAt ?? null,
              checkOutAt: updatedCheckOutAt ?? null,
            },
          });

          const lateMinutes = summary?.lateMinutes ?? 0;
          const earlyLeaveMinutes = summary?.earlyLeaveMinutes ?? 0;
          const overtimeMinutes = summary?.overtimeMinutes ?? 0;
          const checkInStatus: AttendanceCheckInStatus | null =
            summary?.checkInStatusValue ?? (updatedCheckInAt ? "ON_TIME" : null);
          const checkOutStatus: AttendanceCheckOutStatus | null =
            summary?.checkOutStatusValue ?? (updatedCheckOutAt ? "ON_TIME" : null);

          let statusValue: "PRESENT" | "LATE" | "EARLY_LEAVE" | "LATE_AND_EARLY" | "OVERTIME" | "NON_COMPLIANT" | "INCOMPLETE" =
            updatedCheckInAt && updatedCheckOutAt ? "PRESENT" : "INCOMPLETE";
          if (updatedCheckInAt && updatedCheckOutAt) {
            if (lateMinutes > 0 && earlyLeaveMinutes > 0) statusValue = "LATE_AND_EARLY";
            else if (lateMinutes > 0) statusValue = "LATE";
            else if (earlyLeaveMinutes > 0) statusValue = "EARLY_LEAVE";
            if (checkOutStatus === "OVERTIME" && lateMinutes === 0) statusValue = "OVERTIME";
          }

          await tx.attendanceRecord.update({
            where: { id: record.id },
            data: {
              checkInAt: updatedCheckInAt ?? null,
              checkOutAt: updatedCheckOutAt ?? null,
              status: statusValue,
              workMinutes: summary?.actualMinutes ?? 0,
              breakMinutes: schedule.plannedBreakMinutes ?? 0,
              lateMinutes,
              earlyLeaveMinutes,
              overtimeMinutes,
              checkInStatus,
              checkOutStatus,
              isAdjusted: true,
              adjustedAt: new Date(),
              adjustedById: account.id,
              adjustNote: note || null,
            },
          });
        }
      }

      await tx.requestActionLog.create({
        data: {
          requestType: type,
          requestId: id,
          status,
          note: note || null,
          handledById: account.id,
        },
      });
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Không thể xử lý yêu cầu.";
    return NextResponse.json({ message }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
