import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import type { RoleKey } from "@/lib/rbac";
import { processAttendanceMachineEvents } from "@/lib/attendance-machine";

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

export async function POST(request: Request) {
  try {
    const guard = await requireAdminDirector();
    if (!guard.ok) return guard.response;

    const body = (await request.json().catch(() => ({}))) as { batchSize?: number };
    const batchSize = typeof body.batchSize === "number" ? Math.max(100, Math.min(body.batchSize, 10000)) : undefined;

    const result = await processAttendanceMachineEvents({ batchSize });

    return NextResponse.json({ ok: true, result });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
