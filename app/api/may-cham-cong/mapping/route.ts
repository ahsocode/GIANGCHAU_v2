import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import type { RoleKey } from "@/lib/rbac";
import { processAttendanceMachineEventsForPairs } from "@/lib/attendance-machine";

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
  const deviceCode = searchParams.get("deviceCode")?.trim();
  if (!deviceCode) {
    return NextResponse.json({ ok: false, error: "deviceCode is required" }, { status: 400 });
  }

  const data = await prisma.attendanceDeviceUserMapping.findMany({
    where: { deviceCode },
    orderBy: { deviceUserCode: "asc" },
    include: {
      employee: { select: { id: true, code: true, fullName: true } },
    },
  });

  return NextResponse.json({ ok: true, data });
}

export async function POST(request: Request) {
  const guard = await requirePrivileged();
  if (!guard.ok) return guard.response;

  const body = (await request.json()) as {
    deviceCode?: string;
    deviceUserCode?: string;
    employeeId?: string;
    note?: string | null;
    isActive?: boolean | null;
  };

  const deviceCode = body.deviceCode?.trim();
  const deviceUserCode = body.deviceUserCode?.trim();
  const employeeId = body.employeeId?.trim();

  if (!deviceCode || !deviceUserCode || !employeeId) {
    return NextResponse.json({ ok: false, error: "Invalid payload" }, { status: 400 });
  }

  const result = await prisma.attendanceDeviceUserMapping.upsert({
    where: {
      deviceCode_deviceUserCode: { deviceCode, deviceUserCode },
    },
    create: {
      deviceCode,
      deviceUserCode,
      employeeId,
      note: body.note ?? null,
      isActive: body.isActive ?? true,
    },
    update: {
      employeeId,
      note: body.note ?? null,
      isActive: body.isActive ?? true,
    },
    include: {
      employee: { select: { id: true, code: true, fullName: true } },
    },
  });

  const now = new Date();
  const twoDaysAgo = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000);
  await processAttendanceMachineEventsForPairs({
    pairs: [{ deviceCode, deviceUserCode }],
    from: twoDaysAgo,
    to: now,
  });

  return NextResponse.json({ ok: true, item: result });
}

export async function DELETE(request: Request) {
  const guard = await requirePrivileged();
  if (!guard.ok) return guard.response;

  const { searchParams } = new URL(request.url);
  const deviceCode = searchParams.get("deviceCode")?.trim();
  const deviceUserCode = searchParams.get("deviceUserCode")?.trim();

  if (!deviceCode || !deviceUserCode) {
    return NextResponse.json({ ok: false, error: "deviceCode and deviceUserCode are required" }, { status: 400 });
  }

  const result = await prisma.attendanceDeviceUserMapping.deleteMany({
    where: { deviceCode, deviceUserCode },
  });

  return NextResponse.json({ ok: true, deleted: result.count });
}
