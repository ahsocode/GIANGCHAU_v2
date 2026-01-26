import "dotenv/config";
import { AttendanceCheckInStatus, AttendanceCheckOutStatus } from "@prisma/client";
import { prisma } from "../lib/prisma";

const STATE_KEY = "attendanceMachine:lastProcessedEpochMs";
const TIME_ZONE = "Asia/Ho_Chi_Minh";
const BATCH_SIZE = 5000;

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

async function getLastProcessedEpochMs() {
  const state = await prisma.systemState.findUnique({ where: { key: STATE_KEY } });
  if (!state?.value) return BigInt(0);
  try {
    return BigInt(state.value);
  } catch {
    return BigInt(0);
  }
}

async function updateLastProcessedEpochMs(value: bigint) {
  await prisma.systemState.upsert({
    where: { key: STATE_KEY },
    create: { key: STATE_KEY, value: value.toString() },
    update: { value: value.toString() },
  });
}

async function processBatch(lastEpochMs: bigint) {
  const events = await prisma.attendanceMachineEvent.findMany({
    where: { epochMs: { gt: lastEpochMs } },
    orderBy: { epochMs: "asc" },
    take: BATCH_SIZE,
  });

  if (events.length === 0) return { done: true, lastEpochMs };

  const devicePairs = Array.from(
    new Set(events.map((e) => `${e.deviceCode}||${e.deviceUserCode}`))
  ).map((key) => {
    const [deviceCode, deviceUserCode] = key.split("||");
    return { deviceCode, deviceUserCode };
  });

  const mappings = await prisma.attendanceDeviceUserMapping.findMany({
    where: {
      isActive: true,
      OR: devicePairs.map((pair) => ({
        deviceCode: pair.deviceCode,
        deviceUserCode: pair.deviceUserCode,
      })),
    },
    select: { deviceCode: true, deviceUserCode: true, employeeId: true },
  });

  const mappingMap = new Map<string, string>();
  for (const mapping of mappings) {
    mappingMap.set(`${mapping.deviceCode}||${mapping.deviceUserCode}`, mapping.employeeId);
  }

  const groups = new Map<
    string,
    {
      employeeId: string;
      dateOnly: Date;
      events: Array<{
        occurredAt: Date;
        epochMs: bigint;
        deviceCode: string;
        deviceUserCode: string;
      }>;
    }
  >();

  let skippedNoMapping = 0;

  for (const event of events) {
    const employeeId = mappingMap.get(`${event.deviceCode}||${event.deviceUserCode}`);
    if (!employeeId) {
      skippedNoMapping += 1;
      continue;
    }

    const dateOnly = getDateOnlyInTimeZone(event.occurredAt, TIME_ZONE);
    const key = `${employeeId}||${dateOnly.toISOString()}`;
    const existing = groups.get(key);
    const payload = {
      occurredAt: event.occurredAt,
      epochMs: event.epochMs,
      deviceCode: event.deviceCode,
      deviceUserCode: event.deviceUserCode,
    };
    if (!existing) {
      groups.set(key, { employeeId, dateOnly, events: [payload] });
    } else {
      existing.events.push(payload);
    }
  }

  for (const group of groups.values()) {
    const { employeeId, dateOnly, events: occurredEvents } = group;
    const minEvent = occurredEvents.reduce((min, value) => (value.occurredAt < min.occurredAt ? value : min), occurredEvents[0]);
    const maxEvent = occurredEvents.reduce((max, value) => (value.occurredAt > max.occurredAt ? value : max), occurredEvents[0]);
    const checkInAt = minEvent.occurredAt;
    const checkOutAt = maxEvent.occurredAt.getTime() === minEvent.occurredAt.getTime() ? null : maxEvent.occurredAt;

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
        create: {
          employeeId,
          date: dateOnly,
          checkInAt,
          checkOutAt,
          status: "NO_SHIFT",
          source: "DEVICE",
        },
        update: {
          checkInAt,
          checkOutAt,
          status: "NO_SHIFT",
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
      record: {
        checkInAt,
        checkOutAt,
      },
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

  const maxEpochMs = events[events.length - 1].epochMs;
  await updateLastProcessedEpochMs(maxEpochMs);

  return { done: false, lastEpochMs: maxEpochMs, skippedNoMapping };
}

async function main() {
  let lastEpochMs = await getLastProcessedEpochMs();
  let totalSkipped = 0;
  let batches = 0;

  while (true) {
    const result = await processBatch(lastEpochMs);
    if (result.skippedNoMapping) totalSkipped += result.skippedNoMapping;
    batches += 1;
    if (result.done) break;
    lastEpochMs = result.lastEpochMs;
  }

  console.log(
    `Process attendance events done. batches=${batches}, lastEpochMs=${lastEpochMs.toString()}, skippedNoMapping=${totalSkipped}`
  );
  if (totalSkipped > 0) {
    console.warn(`Skipped ${totalSkipped} machine events due to missing mapping.`);
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
