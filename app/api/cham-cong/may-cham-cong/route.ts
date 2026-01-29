import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

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

async function resolveEmployeeId(email: string) {
  const account = await prisma.account.findUnique({
    where: { email },
    select: { employeeId: true },
  });
  return account?.employeeId ?? null;
}

export async function GET(request: Request) {
  try {
    const session = await auth();
    const email = session?.user?.email?.toLowerCase();
    if (!email) {
      return NextResponse.json({ message: "Chưa đăng nhập" }, { status: 401 });
    }

    const employeeId = await resolveEmployeeId(email);
    if (!employeeId) {
      return NextResponse.json({ message: "Không tìm thấy nhân viên" }, { status: 404 });
    }

    const { searchParams } = new URL(request.url);
    const from = parseDateParam(searchParams.get("from"));
    const to = parseDateParam(searchParams.get("to"), true);
    const cursor = searchParams.get("cursor")?.trim();
    const takeParam = Number(searchParams.get("take") ?? "50");
    const take = Number.isFinite(takeParam) ? Math.min(Math.max(takeParam, 1), 200) : 50;

    const mappings = await prisma.attendanceDeviceUserMapping.findMany({
      where: { employeeId, isActive: true },
      select: { deviceCode: true, deviceUserCode: true },
    });

    if (mappings.length === 0) {
      return NextResponse.json({ ok: true, items: [], nextCursor: null });
    }

    const orFilters = mappings.map((mapping) => ({
      deviceCode: mapping.deviceCode,
      deviceUserCode: mapping.deviceUserCode,
      occurredAt: {
        ...(from ? { gte: from } : null),
        ...(to ? { lte: to } : null),
      },
    }));

    const rows = await prisma.attendanceMachineEvent.findMany({
      where: { OR: orFilters },
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

    const hasMore = rows.length > take;
    const items = (hasMore ? rows.slice(0, take) : rows).map((row) => ({
      ...row,
      epochMs: row.epochMs.toString(),
    }));
    const nextCursor = hasMore ? rows[take].id : null;

    return NextResponse.json({ ok: true, items, nextCursor });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
