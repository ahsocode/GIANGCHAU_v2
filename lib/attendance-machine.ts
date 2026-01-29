import { AttendanceCheckInStatus, AttendanceCheckOutStatus } from "@prisma/client";
import { prisma } from "./prisma";
import { APP_TIME_ZONE, combineDateTimeInTimeZone, getDateOnlyInTimeZone } from "./timezone";

const STATE_KEY = "attendanceMachine:lastProcessedEpochMs";
const DEFAULT_BATCH_SIZE = 5000;
const CHECKIN_BUFFER_MINUTES = 60;
const AUTO_CHECKOUT_AFTER_HOURS = 8;
const NEXT_SHIFT_BUFFER_HOURS = 2;

function resolveShiftWindow(date: Date, startTime: string, endTime: string) {
  const start = combineDateTimeInTimeZone(date, startTime);
  let end = combineDateTimeInTimeZone(date, endTime);
  if (end.getTime() <= start.getTime()) {
    end = new Date(end.getTime() + 24 * 60 * 60 * 1000);
  }
  return { start, end };
}

function resolveCheckInWindow(date: Date, startTime: string, endTime: string) {
  const base = resolveShiftWindow(date, startTime, endTime);
  return {
    start: new Date(base.start.getTime() - CHECKIN_BUFFER_MINUTES * 60000),
    end: base.end,
  };
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

function isWithinWindow(occurredAt: Date, window: { start: Date; end: Date }) {
  const ts = occurredAt.getTime();
  return ts >= window.start.getTime() && ts <= window.end.getTime();
}

async function loadScheduleMap(
  events: Array<{
    deviceCode: string;
    deviceUserCode: string;
    occurredAt: Date;
  }>,
  mappingMap: Map<string, string>
) {
  const employeeIds = new Set<string>();
  const dateSet = new Set<string>();

  for (const event of events) {
    const employeeId = mappingMap.get(`${event.deviceCode}||${event.deviceUserCode}`);
    if (!employeeId) continue;
    employeeIds.add(employeeId);
    const dateOnly = getDateOnlyInTimeZone(event.occurredAt, APP_TIME_ZONE);
    const prevDateOnly = new Date(dateOnly.getTime() - 24 * 60 * 60 * 1000);
    const nextDateOnly = new Date(dateOnly.getTime() + 24 * 60 * 60 * 1000);
    dateSet.add(dateOnly.toISOString());
    dateSet.add(prevDateOnly.toISOString());
    dateSet.add(nextDateOnly.toISOString());
  }

  if (employeeIds.size === 0 || dateSet.size === 0) {
    return new Map<
      string,
      {
        id: string;
        employeeId: string;
        date: Date;
        plannedStart: string;
        plannedEnd: string;
        plannedBreakMinutes: number | null;
        plannedLateGraceMinutes: number | null;
        plannedEarlyGraceMinutes: number | null;
      }
    >();
  }

  const dateList = Array.from(dateSet).map((value) => new Date(value));
  const schedules = await prisma.workSchedule.findMany({
    where: {
      employeeId: { in: Array.from(employeeIds) },
      date: { in: dateList },
    },
    select: {
      id: true,
      employeeId: true,
      date: true,
      plannedStart: true,
      plannedEnd: true,
      plannedBreakMinutes: true,
      plannedLateGraceMinutes: true,
      plannedEarlyGraceMinutes: true,
    },
  });

  const scheduleMap = new Map<
    string,
    {
      id: string;
      employeeId: string;
      date: Date;
      plannedStart: string;
      plannedEnd: string;
      plannedBreakMinutes: number | null;
      plannedLateGraceMinutes: number | null;
      plannedEarlyGraceMinutes: number | null;
    }
  >();

  for (const schedule of schedules) {
    scheduleMap.set(`${schedule.employeeId}||${schedule.date.toISOString()}`, schedule);
  }

  return scheduleMap;
}

function buildGroups(
  events: Array<{
    deviceCode: string;
    deviceUserCode: string;
    occurredAt: Date;
    epochMs: bigint;
  }>,
  mappingMap: Map<string, string>,
  scheduleMap: Map<
    string,
    {
      id: string;
      employeeId: string;
      date: Date;
      plannedStart: string;
      plannedEnd: string;
      plannedBreakMinutes: number | null;
      plannedLateGraceMinutes: number | null;
      plannedEarlyGraceMinutes: number | null;
    }
  >
) {
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

    const dateOnly = getDateOnlyInTimeZone(event.occurredAt, APP_TIME_ZONE);
    const prevDateOnly = new Date(dateOnly.getTime() - 24 * 60 * 60 * 1000);
    let assignedDate = dateOnly;

    const todaySchedule = scheduleMap.get(`${employeeId}||${dateOnly.toISOString()}`);
    if (todaySchedule) {
      const window = resolveCheckInWindow(
        todaySchedule.date,
        todaySchedule.plannedStart,
        todaySchedule.plannedEnd
      );
      if (isWithinWindow(event.occurredAt, window)) {
        assignedDate = todaySchedule.date;
      }
    }

    if (assignedDate === dateOnly) {
      const prevSchedule = scheduleMap.get(`${employeeId}||${prevDateOnly.toISOString()}`);
      if (prevSchedule) {
        const window = resolveCheckInWindow(
          prevSchedule.date,
          prevSchedule.plannedStart,
          prevSchedule.plannedEnd
        );
        if (isWithinWindow(event.occurredAt, window)) {
          assignedDate = prevSchedule.date;
        }
      }
    }

    const key = `${employeeId}||${assignedDate.toISOString()}`;
    const existing = groups.get(key);
    const payload = {
      occurredAt: event.occurredAt,
      epochMs: event.epochMs,
      deviceCode: event.deviceCode,
      deviceUserCode: event.deviceUserCode,
    };
    if (!existing) {
      groups.set(key, { employeeId, dateOnly: assignedDate, events: [payload] });
    } else {
      existing.events.push(payload);
    }
  }

  return { groups, skippedNoMapping };
}

async function applyGroups(
  groups: Map<
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
  >,
  scheduleMap: Map<
    string,
    {
      id: string;
      employeeId: string;
      date: Date;
      plannedStart: string;
      plannedEnd: string;
      plannedBreakMinutes: number | null;
      plannedLateGraceMinutes: number | null;
      plannedEarlyGraceMinutes: number | null;
    }
  >
) {
  for (const group of groups.values()) {
    const { employeeId, dateOnly, events: occurredEvents } = group;
    const minEvent = occurredEvents.reduce(
      (min, value) => (value.occurredAt < min.occurredAt ? value : min),
      occurredEvents[0]
    );
    const maxEvent = occurredEvents.reduce(
      (max, value) => (value.occurredAt > max.occurredAt ? value : max),
      occurredEvents[0]
    );

    const schedule =
      scheduleMap.get(`${employeeId}||${dateOnly.toISOString()}`) ??
      (await prisma.workSchedule.findUnique({
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
      }));

    const record = await prisma.attendanceRecord.findUnique({
      where: { employeeId_date: { employeeId, date: dateOnly } },
      select: { id: true, isAdjusted: true },
    });

    if (record?.isAdjusted) continue;

    if (!schedule) {
      const checkInAt = minEvent.occurredAt;
      const checkOutAt =
        maxEvent.occurredAt.getTime() === minEvent.occurredAt.getTime() ? null : maxEvent.occurredAt;
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

    const checkInWindow = resolveCheckInWindow(schedule.date, schedule.plannedStart, schedule.plannedEnd);
    const candidatesInWindow = occurredEvents.filter((event) => isWithinWindow(event.occurredAt, checkInWindow));
    if (candidatesInWindow.length === 0) {
      if (maxEvent.occurredAt.getTime() >= checkInWindow.end.getTime()) {
        await prisma.attendanceRecord.upsert({
          where: { employeeId_date: { employeeId, date: dateOnly } },
          create: {
            employeeId,
            date: dateOnly,
            scheduleId: schedule.id,
            status: "ABSENT",
            checkInStatus: "MISSED",
            checkOutStatus: "MISSED",
            source: "DEVICE",
          },
          update: {
            status: "ABSENT",
            checkInStatus: "MISSED",
            checkOutStatus: "MISSED",
            source: "DEVICE",
          },
        });
      }
      continue;
    }

    const firstInWindow = candidatesInWindow.reduce(
      (min, value) => (value.occurredAt < min.occurredAt ? value : min),
      candidatesInWindow[0]
    );
    const checkInAt = firstInWindow.occurredAt;

    const shiftWindow = resolveShiftWindow(schedule.date, schedule.plannedStart, schedule.plannedEnd);
    const cutoffAfterShift = new Date(shiftWindow.end.getTime() + AUTO_CHECKOUT_AFTER_HOURS * 60 * 60 * 1000);
    const nextDateOnly = new Date(schedule.date.getTime() + 24 * 60 * 60 * 1000);
    const nextSchedule = scheduleMap.get(`${employeeId}||${nextDateOnly.toISOString()}`);
    const nextShiftStart = nextSchedule
      ? combineDateTimeInTimeZone(nextSchedule.date, nextSchedule.plannedStart)
      : null;
    const cutoffByNextShift = nextShiftStart
      ? new Date(nextShiftStart.getTime() - NEXT_SHIFT_BUFFER_HOURS * 60 * 60 * 1000)
      : null;
    const cutoff =
      cutoffByNextShift && cutoffByNextShift.getTime() < cutoffAfterShift.getTime()
        ? cutoffByNextShift
        : cutoffAfterShift;

    const checkoutCandidates = occurredEvents.filter(
      (event) => event.occurredAt.getTime() >= checkInAt.getTime() && event.occurredAt.getTime() <= cutoff.getTime()
    );
    const lastCheckoutCandidate =
      checkoutCandidates.length > 0
        ? checkoutCandidates.reduce(
            (max, value) => (value.occurredAt > max.occurredAt ? value : max),
            checkoutCandidates[0]
          )
        : null;

    let checkOutAt = lastCheckoutCandidate?.occurredAt ?? null;
    if (checkOutAt && checkOutAt.getTime() === checkInAt.getTime()) {
      checkOutAt = null;
    }
    let forceAutoCheckout = false;
    if (!checkOutAt && maxEvent.occurredAt.getTime() >= cutoff.getTime()) {
      checkOutAt = cutoff;
      forceAutoCheckout = true;
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
    const checkOutStatus = forceAutoCheckout
      ? "MISSED"
      : checkOutAt
        ? summary.checkOutStatusValue ?? null
        : "PENDING";

    const status = checkOutAt
      ? forceAutoCheckout
        ? "NON_COMPLIANT"
        : resolveStatus({
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
          deviceCode: firstInWindow.deviceCode,
          deviceUserCode: firstInWindow.deviceUserCode,
          epochMs: firstInWindow.epochMs.toString(),
          occurredAt: checkInAt.toISOString(),
        },
      },
      update: {
        recordId: updated.id,
        occurredAt: checkInAt,
        source: "DEVICE",
        meta: {
          deviceCode: firstInWindow.deviceCode,
          deviceUserCode: firstInWindow.deviceUserCode,
          epochMs: firstInWindow.epochMs.toString(),
          occurredAt: checkInAt.toISOString(),
        },
      },
    });

    if (checkOutAt) {
      const source = forceAutoCheckout ? "MANUAL" : "DEVICE";
      const checkoutMetaSource = lastCheckoutCandidate ?? maxEvent;
      await prisma.attendanceEvent.upsert({
        where: { employeeId_date_type: { employeeId, date: dateOnly, type: "CHECK_OUT" } },
        create: {
          employeeId,
          date: dateOnly,
          recordId: updated.id,
          type: "CHECK_OUT",
          occurredAt: checkOutAt,
          source,
          meta: {
            deviceCode: checkoutMetaSource.deviceCode,
            deviceUserCode: checkoutMetaSource.deviceUserCode,
            epochMs: checkoutMetaSource.epochMs.toString(),
            occurredAt: checkOutAt.toISOString(),
          },
        },
        update: {
          recordId: updated.id,
          occurredAt: checkOutAt,
          source,
          meta: {
            deviceCode: checkoutMetaSource.deviceCode,
            deviceUserCode: checkoutMetaSource.deviceUserCode,
            epochMs: checkoutMetaSource.epochMs.toString(),
            occurredAt: checkOutAt.toISOString(),
          },
        },
      });
    }
  }
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

async function processBatch(lastEpochMs: bigint, batchSize: number) {
  const events = await prisma.attendanceMachineEvent.findMany({
    where: { epochMs: { gt: lastEpochMs } },
    orderBy: { epochMs: "asc" },
    take: batchSize,
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

  const scheduleMap = await loadScheduleMap(events, mappingMap);
  const { groups, skippedNoMapping } = buildGroups(events, mappingMap, scheduleMap);
  await applyGroups(groups, scheduleMap);

  const maxEpochMs = events[events.length - 1].epochMs;
  await updateLastProcessedEpochMs(maxEpochMs);

  return { done: false, lastEpochMs: maxEpochMs, skippedNoMapping };
}

export async function processAttendanceMachineEventsForPairs(params: {
  pairs: Array<{ deviceCode: string; deviceUserCode: string }>;
  from?: Date | null;
  to?: Date | null;
}) {
  const { pairs, from, to } = params;
  if (pairs.length === 0) return { processed: 0, skippedNoMapping: 0 };

  const mappings = await prisma.attendanceDeviceUserMapping.findMany({
    where: {
      isActive: true,
      OR: pairs.map((pair) => ({ deviceCode: pair.deviceCode, deviceUserCode: pair.deviceUserCode })),
    },
    select: { deviceCode: true, deviceUserCode: true, employeeId: true },
  });

  const mappingMap = new Map<string, string>();
  for (const mapping of mappings) {
    mappingMap.set(`${mapping.deviceCode}||${mapping.deviceUserCode}`, mapping.employeeId);
  }

  const events = await prisma.attendanceMachineEvent.findMany({
    where: {
      OR: pairs.map((pair) => ({
        deviceCode: pair.deviceCode,
        deviceUserCode: pair.deviceUserCode,
        occurredAt: {
          ...(from ? { gte: from } : null),
          ...(to ? { lte: to } : null),
        },
      })),
    },
    orderBy: { occurredAt: "asc" },
  });

  const scheduleMap = await loadScheduleMap(events, mappingMap);
  const { groups, skippedNoMapping } = buildGroups(events, mappingMap, scheduleMap);
  await applyGroups(groups, scheduleMap);

  return { processed: groups.size, skippedNoMapping };
}

export async function processAttendanceMachineEvents(options?: { batchSize?: number }) {
  const batchSize = options?.batchSize ?? DEFAULT_BATCH_SIZE;
  let lastEpochMs = await getLastProcessedEpochMs();
  let totalSkipped = 0;
  let batches = 0;

  while (true) {
    const result = await processBatch(lastEpochMs, batchSize);
    if (result.skippedNoMapping) totalSkipped += result.skippedNoMapping;
    batches += 1;
    if (result.done) break;
    lastEpochMs = result.lastEpochMs;
  }

  return {
    batches,
    lastEpochMs: lastEpochMs.toString(),
    skippedNoMapping: totalSkipped,
  };
}
