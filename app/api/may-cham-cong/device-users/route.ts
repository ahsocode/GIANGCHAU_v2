import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import type { RoleKey } from "@/lib/rbac";

async function requirePrivileged() {
  const session = await auth();
  const email = session?.user?.email?.toLowerCase();
  if (!email) {
    return { ok: false as const, response: NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 }) };
  }

  const account = await prisma.account.findUnique({
    where: { email },
    select: { roleKey: true },
  });

  if (!account || account.roleKey === "EMPLOYEE") {
    return { ok: false as const, response: NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 }) };
  }

  return { ok: true as const, roleKey: account.roleKey as RoleKey };
}

export async function GET(request: Request) {
  const guard = await requirePrivileged();
  if (!guard.ok) return guard.response;

  const { searchParams } = new URL(request.url);
  const deviceCode = searchParams.get("deviceCode")?.trim() || undefined;
  const deviceUserCode = searchParams.get("deviceUserCode")?.trim() || undefined;
  const mappedFilter = searchParams.get("mapped");
  const take = Math.min(1000, Math.max(1, Number(searchParams.get("take") ?? "500") || 500));

  const where: Prisma.AttendanceMachineEventWhereInput = {};
  if (deviceCode) where.deviceCode = deviceCode;
  if (deviceUserCode) {
    where.deviceUserCode = { contains: deviceUserCode, mode: "insensitive" };
  }

  const rows = await prisma.attendanceMachineEvent.groupBy({
    by: ["deviceCode", "deviceUserCode"],
    where,
    _max: { occurredAt: true },
    orderBy: [{ deviceCode: "asc" }, { deviceUserCode: "asc" }],
    take,
  });

  if (rows.length === 0) {
    return NextResponse.json({ ok: true, items: [], total: 0 });
  }

  const pairs = rows.map((row) => ({ deviceCode: row.deviceCode, deviceUserCode: row.deviceUserCode }));

  const mappings = await prisma.attendanceDeviceUserMapping.findMany({
    where: {
      OR: pairs.map((pair) => ({ deviceCode: pair.deviceCode, deviceUserCode: pair.deviceUserCode })),
    },
    include: {
      employee: { select: { id: true, code: true, fullName: true } },
    },
  });

  const mappingMap = new Map<string, (typeof mappings)[number]>();
  for (const mapping of mappings) {
    mappingMap.set(`${mapping.deviceCode}||${mapping.deviceUserCode}`, mapping);
  }

  let items = rows.map((row) => {
    const mapping = mappingMap.get(`${row.deviceCode}||${row.deviceUserCode}`) ?? null;
    return {
      deviceCode: row.deviceCode,
      deviceUserCode: row.deviceUserCode,
      lastSeen: row._max.occurredAt ? row._max.occurredAt.toISOString() : null,
      mapping: mapping
        ? {
            employeeId: mapping.employeeId,
            employeeCode: mapping.employee?.code ?? null,
            employeeName: mapping.employee?.fullName ?? null,
            note: mapping.note ?? null,
            isActive: mapping.isActive,
          }
        : null,
    };
  });

  if (mappedFilter === "true") {
    items = items.filter((item) => item.mapping?.isActive);
  } else if (mappedFilter === "false") {
    items = items.filter((item) => !item.mapping?.isActive);
  }

  return NextResponse.json({ ok: true, items, total: items.length });
}
