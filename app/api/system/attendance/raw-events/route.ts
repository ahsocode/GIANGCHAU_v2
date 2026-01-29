import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import type { RoleKey } from "@/lib/rbac";

const ALLOWED_ROLES = new Set<RoleKey>(["ADMIN", "DIRECTOR"]);

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

  return { ok: true as const, roleKey: account.roleKey as RoleKey };
}

function parseDateParam(value: string | null, endOfDay = false) {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const isDateOnly = /^\d{4}-\d{2}-\d{2}$/.test(trimmed);
  if (isDateOnly) {
    return new Date(trimmed + (endOfDay ? "T23:59:59.999Z" : "T00:00:00.000Z"));
  }
  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
}

export async function GET(request: Request) {
  try {
    const guard = await requireAdminDirector();
    if (!guard.ok) return guard.response;

    const { searchParams } = new URL(request.url);
    const deviceCode = searchParams.get("deviceCode")?.trim();
    const deviceUserCode = searchParams.get("deviceUserCode")?.trim();
    const from = parseDateParam(searchParams.get("from"));
    const to = parseDateParam(searchParams.get("to"), true);
    const cursor = searchParams.get("cursor")?.trim();
    const takeParam = Number(searchParams.get("take") ?? "50");
    const take = Number.isFinite(takeParam) ? Math.min(Math.max(takeParam, 1), 200) : 50;

    const where: {
      deviceCode?: string;
      deviceUserCode?: string;
      occurredAt?: { gte?: Date; lte?: Date };
    } = {};

    if (deviceCode) where.deviceCode = deviceCode;
    if (deviceUserCode) where.deviceUserCode = deviceUserCode;
    if (from || to) {
      where.occurredAt = {
        ...(from ? { gte: from } : null),
        ...(to ? { lte: to } : null),
      } as { gte?: Date; lte?: Date };
    }

    const rows = await prisma.attendanceMachineEvent.findMany({
      where,
      orderBy: [{ occurredAt: "desc" }, { id: "desc" }],
      take: take + 1,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      select: {
        id: true,
        deviceCode: true,
        machineId: true,
        deviceIp: true,
        deviceUserCode: true,
        userSn: true,
        epochMs: true,
        occurredAt: true,
        verifyType: true,
        inOut: true,
        dedupeKey: true,
        raw: true,
        createdAt: true,
      },
    });

    const baseRows = rows.length > take ? rows.slice(0, take) : rows;
    const pairs = Array.from(
      new Set(baseRows.map((row) => `${row.deviceCode}||${row.deviceUserCode}`))
    ).map((key) => {
      const [code, user] = key.split("||");
      return { deviceCode: code, deviceUserCode: user };
    });

    const mappings = pairs.length
      ? await prisma.attendanceDeviceUserMapping.findMany({
          where: {
            OR: pairs.map((pair) => ({
              deviceCode: pair.deviceCode,
              deviceUserCode: pair.deviceUserCode,
            })),
          },
          include: {
            employee: { select: { id: true, code: true, fullName: true } },
          },
        })
      : [];

    const mappingMap = new Map<string, (typeof mappings)[number]>();
    for (const mapping of mappings) {
      mappingMap.set(`${mapping.deviceCode}||${mapping.deviceUserCode}`, mapping);
    }

    const hasMore = rows.length > take;
    const items = baseRows.map((row) => {
      const mapping = mappingMap.get(`${row.deviceCode}||${row.deviceUserCode}`) ?? null;
      return {
        ...row,
        epochMs: row.epochMs.toString(),
        employee: mapping
          ? {
              id: mapping.employeeId,
              code: mapping.employee?.code ?? null,
              fullName: mapping.employee?.fullName ?? null,
              isActive: mapping.isActive,
            }
          : null,
      };
    });
    const nextCursor = hasMore ? rows[take].id : null;

    return NextResponse.json({ ok: true, items, nextCursor });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
