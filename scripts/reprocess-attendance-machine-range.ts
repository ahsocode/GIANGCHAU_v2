import "dotenv/config";
import { prisma } from "../lib/prisma";
import type { AttendanceMachineEvent } from "@prisma/client";
import { AttendanceCheckInStatus, AttendanceCheckOutStatus } from "@prisma/client";

const TIME_ZONE = "Asia/Ho_Chi_Minh";
const BATCH_SIZE = 5000;

/**
 * Parse CLI:
 *   node scripts/reprocess-attendance-machine-range.ts 2026-01-01 2026-01-31
 * or:
 *   node scripts/reprocess-attendance-machine-range.ts --days 30
 */
function parseArgs() {
  const argv = process.argv.slice(2);

  const idxDays = argv.indexOf("--days");
  if (idxDays >= 0) {
    const days = Number(argv[idxDays + 1] || "0");
    if (!Number.isFinite(days) || days <= 0) throw new Error("Invalid --days");
    const to = new Date();
    const from = new Date(to.getTime() - days * 24 * 60 * 60 * 1000);
    return { from, to };
  }

  if (argv.length >= 2) {
    const from = new Date(argv[0] + "T00:00:00.000Z");
    const to = new Date(argv[1] + "T23:59:59.999Z");
    if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) throw new Error("Invalid date args");
    return { from, to };
  }

  throw new Error(
    "Usage: node scripts/reprocess-attendance-machine-range.ts <fromYYYY-MM-DD> <toYYYY-MM-DD>  OR  --days N"
  );
}

function getDateOnlyInTimeZone(value: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(value);

  const year = Number(parts.find((p) => p.type === "year")?.value ?? "0");
  const month = Number(parts.find((p) => p.type === "month")?.value ?? "0");
  const day = Number(parts.find((p) => p.type === "day")?.value ?? "0");

  // "ngay VN" duoi dang UTC midnight (stable key)
  return new Date(Date.UTC(year, month - 1, day));
}

function getLocalDateFromUtcDate(value: Date) {
  return new Date(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate());
}

function combineDateTime(date: Date, time: string) {
  const [hours, minutes] = time.split(":").map(Number);
  const next = getLocalDateFromUtcDate(date);
  next.setHours(hours || 0, minutes || 0, 0, 0);
  return next;
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
    actualMinutes,
    lateMinutes,
    earlyLeaveMinutes,
    overtimeMinutes,
    checkInStatusValue,
    checkOutStatusValue,
  };
}

function resolveStatus(params: {
  lateMinutes: number;
  earlyLeaveMinutes: number;
  overtimeMinutes: number;
  checkOutStatus: AttendanceCheckOutStatus | null;
}) {
  const { lateMinutes, earlyLeaveMinutes, overtimeMinutes, checkOutStatus } = params;
  let status: "PRESENT" | "LATE" | "EARLY_LEAVE" | "LATE_AND_EARLY" | "OVERTIME" | "NON_COMPLIANT" = "PRESENT";
  if (lateMinutes > 0 && earlyLeaveMinutes > 0) status = "LATE_AND_EARLY";
  else if (lateMinutes > 0) status = "LATE";
  else if (earlyLeaveMinutes > 0) status = "EARLY_LEAVE";
  if (checkOutStatus === "OVERTIME" && lateMinutes === 0) status = "OVERTIME";
  if (lateMinutes > 0 && overtimeMinutes >= lateMinutes && earlyLeaveMinutes === 0) status = "PRESENT";
  return status;
}

async function main() {
  const { from, to } = parseArgs();
  console.log(`[reprocess] range UTC: from=${from.toISOString()} to=${to.toISOString()}`);

  let cursorId: string | null = null;
  let total = 0;
  let skippedNoMapping = 0;

  while (true) {
    const events: AttendanceMachineEvent[] = await prisma.attendanceMachineEvent.findMany({
      where: {
        occurredAt: { gte: from, lte: to },
      },
      orderBy: [{ occurredAt: "asc" }, { id: "asc" }],
      take: BATCH_SIZE,
      ...(cursorId
        ? {
            skip: 1,
            cursor: { id: cursorId },
          }
        : {}),
    });

    if (events.length === 0) break;

    const pairs = Array.from(new Set<string>(events.map((e) => `${e.deviceCode}||${e.deviceUserCode}`))).map((key) => {
      const [deviceCode, deviceUserCode] = key.split("||");
      return { deviceCode, deviceUserCode };
    });

    const mappings = await prisma.attendanceDeviceUserMapping.findMany({
      where: {
        isActive: true,
        OR: pairs.map((p) => ({ deviceCode: p.deviceCode, deviceUserCode: p.deviceUserCode })),
      },
      select: { deviceCode: true, deviceUserCode: true, employeeId: true },
    });

    const map = new Map<string, string>();
    for (const m of mappings) map.set(`${m.deviceCode}||${m.deviceUserCode}`, m.employeeId);

    const groups = new Map<
      string,
      {
        employeeId: string;
        dateOnly: Date;
        list: Array<{ occurredAt: Date; epochMs: bigint; deviceCode: string; deviceUserCode: string }>;
      }
    >();

    for (const e of events) {
      const employeeId = map.get(`${e.deviceCode}||${e.deviceUserCode}`);
      if (!employeeId) {
        skippedNoMapping += 1;
        continue;
      }
      const dateOnly = getDateOnlyInTimeZone(e.occurredAt, TIME_ZONE);
      const key = `${employeeId}||${dateOnly.toISOString()}`;
      const g = groups.get(key);
      const payload = {
        occurredAt: e.occurredAt,
        epochMs: e.epochMs,
        deviceCode: e.deviceCode,
        deviceUserCode: e.deviceUserCode,
      };
      if (!g) groups.set(key, { employeeId, dateOnly, list: [payload] });
      else g.list.push(payload);
    }

    for (const g of groups.values()) {
      const { employeeId, dateOnly, list } = g;

      const minEvent = list.reduce((min, x) => (x.occurredAt < min.occurredAt ? x : min), list[0]);
      const maxEvent = list.reduce((max, x) => (x.occurredAt > max.occurredAt ? x : max), list[0]);

      const checkInAt = minEvent.occurredAt;
      let checkOutAt =
        maxEvent.occurredAt.getTime() === minEvent.occurredAt.getTime() ? null : maxEvent.occurredAt;
      if (checkOutAt && checkOutAt.getTime() === checkInAt.getTime()) {
        checkOutAt = null;
      }

      const schedule = await prisma.workSchedule.findUnique({
        where: { employeeId_date: { employeeId, date: dateOnly } },
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

      const record = await prisma.attendanceRecord.findUnique({
        where: { employeeId_date: { employeeId, date: dateOnly } },
        select: { id: true, isAdjusted: true },
      });

      if (record?.isAdjusted) continue;

      if (!schedule) {
        const updated = await prisma.attendanceRecord.upsert({
          where: { employeeId_date: { employeeId, date: dateOnly } },
          create: { employeeId, date: dateOnly, checkInAt, checkOutAt, status: "NO_SHIFT", source: "DEVICE" },
          update: { checkInAt, checkOutAt, status: "NO_SHIFT", source: "DEVICE" },
          select: { id: true },
        });

        await prisma.attendanceEvent.upsert({
          where: { employeeId_date_type: { employeeId, date: dateOnly, type: "CHECK_IN" } },
          create: {
            employeeId,
            date: dateOnly,
            recordId: updated.id,
            type: "CHECK_IN",
            occurredAt: checkInAt,
            source: "DEVICE",
            meta: {
              deviceCode: minEvent.deviceCode,
              deviceUserCode: minEvent.deviceUserCode,
              epochMs: minEvent.epochMs.toString(),
              occurredAt: checkInAt.toISOString(),
            },
          },
          update: {
            recordId: updated.id,
            occurredAt: checkInAt,
            source: "DEVICE",
            meta: {
              deviceCode: minEvent.deviceCode,
              deviceUserCode: minEvent.deviceUserCode,
              epochMs: minEvent.epochMs.toString(),
              occurredAt: checkInAt.toISOString(),
            },
          },
        });

        if (checkOutAt) {
          await prisma.attendanceEvent.upsert({
            where: { employeeId_date_type: { employeeId, date: dateOnly, type: "CHECK_OUT" } },
            create: {
              employeeId,
              date: dateOnly,
              recordId: updated.id,
              type: "CHECK_OUT",
              occurredAt: checkOutAt,
              source: "DEVICE",
              meta: {
                deviceCode: maxEvent.deviceCode,
                deviceUserCode: maxEvent.deviceUserCode,
                epochMs: maxEvent.epochMs.toString(),
                occurredAt: checkOutAt.toISOString(),
              },
            },
            update: {
              recordId: updated.id,
              occurredAt: checkOutAt,
              source: "DEVICE",
              meta: {
                deviceCode: maxEvent.deviceCode,
                deviceUserCode: maxEvent.deviceUserCode,
                epochMs: maxEvent.epochMs.toString(),
                occurredAt: checkOutAt.toISOString(),
              },
            },
          });
        }
        continue;
      }

      const summary = computeSummary({
        schedule: {
          date: schedule.date,
          plannedStart: schedule.plannedStart,
          plannedEnd: schedule.plannedEnd,
          plannedBreakMinutes: schedule.plannedBreakMinutes,
          plannedLateGraceMinutes: schedule.plannedLateGraceMinutes,
          plannedEarlyGraceMinutes: schedule.plannedEarlyGraceMinutes,
        },
        record: { checkInAt, checkOutAt },
      });

      const lateMinutes = summary.lateMinutes ?? 0;
      const earlyLeaveMinutes = summary.earlyLeaveMinutes ?? 0;
      const overtimeMinutes = summary.overtimeMinutes ?? 0;

      const checkInStatus = summary.checkInStatusValue ?? null;
      const checkOutStatus = checkOutAt ? summary.checkOutStatusValue ?? null : "PENDING";

      const status = checkOutAt
        ? resolveStatus({
            lateMinutes,
            earlyLeaveMinutes,
            overtimeMinutes,
            checkOutStatus: summary.checkOutStatusValue ?? null,
          })
        : "INCOMPLETE";

      const updated = await prisma.attendanceRecord.upsert({
        where: { employeeId_date: { employeeId, date: dateOnly } },
        create: {
          employeeId,
          date: dateOnly,
          scheduleId: schedule.id,
          checkInAt,
          checkOutAt,
          status,
          workMinutes: summary.actualMinutes ?? 0,
          breakMinutes: schedule.plannedBreakMinutes ?? 0,
          lateMinutes,
          earlyLeaveMinutes,
          overtimeMinutes,
          checkInStatus,
          checkOutStatus,
          source: "DEVICE",
        },
        update: {
          scheduleId: schedule.id,
          checkInAt,
          checkOutAt,
          status,
          workMinutes: summary.actualMinutes ?? 0,
          breakMinutes: schedule.plannedBreakMinutes ?? 0,
          lateMinutes,
          earlyLeaveMinutes,
          overtimeMinutes,
          checkInStatus,
          checkOutStatus,
          source: "DEVICE",
        },
        select: { id: true },
      });

      await prisma.attendanceEvent.upsert({
        where: { employeeId_date_type: { employeeId, date: dateOnly, type: "CHECK_IN" } },
        create: {
          employeeId,
          date: dateOnly,
          recordId: updated.id,
          type: "CHECK_IN",
          occurredAt: checkInAt,
          source: "DEVICE",
          meta: {
            deviceCode: minEvent.deviceCode,
            deviceUserCode: minEvent.deviceUserCode,
            epochMs: minEvent.epochMs.toString(),
            occurredAt: checkInAt.toISOString(),
          },
        },
        update: {
          recordId: updated.id,
          occurredAt: checkInAt,
          source: "DEVICE",
          meta: {
            deviceCode: minEvent.deviceCode,
            deviceUserCode: minEvent.deviceUserCode,
            epochMs: minEvent.epochMs.toString(),
            occurredAt: checkInAt.toISOString(),
          },
        },
      });

      if (checkOutAt) {
        await prisma.attendanceEvent.upsert({
          where: { employeeId_date_type: { employeeId, date: dateOnly, type: "CHECK_OUT" } },
          create: {
            employeeId,
            date: dateOnly,
            recordId: updated.id,
            type: "CHECK_OUT",
            occurredAt: checkOutAt,
            source: "DEVICE",
            meta: {
              deviceCode: maxEvent.deviceCode,
              deviceUserCode: maxEvent.deviceUserCode,
              epochMs: maxEvent.epochMs.toString(),
              occurredAt: checkOutAt.toISOString(),
            },
          },
          update: {
            recordId: updated.id,
            occurredAt: checkOutAt,
            source: "DEVICE",
            meta: {
              deviceCode: maxEvent.deviceCode,
              deviceUserCode: maxEvent.deviceUserCode,
              epochMs: maxEvent.epochMs.toString(),
              occurredAt: checkOutAt.toISOString(),
            },
          },
        });
      }
    }

    total += events.length;
    cursorId = events[events.length - 1].id;

    console.log(`[reprocess] scanned=${total}, groups=${groups.size}, skippedNoMapping=${skippedNoMapping}`);
  }

  console.log(`[reprocess] done. scanned=${total}, skippedNoMapping=${skippedNoMapping}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
