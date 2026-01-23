import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const POLICY_KEY = "GLOBAL";

export async function GET() {
  const policy = await prisma.shiftChangePolicy.findUnique({
    where: { key: POLICY_KEY },
    select: { totalShiftChangeCount: true },
  });

  return NextResponse.json({
    totalShiftChangeCount: policy?.totalShiftChangeCount ?? 0,
  });
}

export async function POST(request: Request) {
  const body = (await request.json()) as { totalShiftChangeCount?: number };

  const totalShiftChangeCount = Number.isFinite(body.totalShiftChangeCount)
    ? Math.max(0, Math.floor(Number(body.totalShiftChangeCount)))
    : null;
  if (totalShiftChangeCount === null) {
    return NextResponse.json({ message: "Số lượt đổi ca không hợp lệ." }, { status: 400 });
  }

  const updated = await prisma.shiftChangePolicy.upsert({
    where: { key: POLICY_KEY },
    create: { key: POLICY_KEY, totalShiftChangeCount },
    update: { totalShiftChangeCount },
    select: { totalShiftChangeCount: true },
  });

  return NextResponse.json({
    totalShiftChangeCount: updated.totalShiftChangeCount,
  });
}
