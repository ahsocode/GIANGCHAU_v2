import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

type CreatePayload = {
  code?: string;
  name?: string;
  startTime?: string;
  endTime?: string;
  breakMinutes?: number;
  lateGraceMinutes?: number;
  earlyGraceMinutes?: number;
  overtimeThresholdMinutes?: number;
  status?: "ACTIVE" | "ARCHIVED";
};

export async function GET() {
  const items = await prisma.workShift.findMany({
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { schedules: true } } },
  });
  return NextResponse.json({
    items: items.map((item) => ({
      ...item,
      employeeCount: item._count.schedules,
    })),
  });
}

export async function POST(request: Request) {
  const body = (await request.json()) as CreatePayload;
  const code = body.code?.trim();
  const name = body.name?.trim();
  const startTime = body.startTime?.trim();
  const endTime = body.endTime?.trim();
  const breakMinutes = Number.isFinite(body.breakMinutes) ? Math.max(0, Number(body.breakMinutes)) : 0;
  const lateGraceMinutes = Number.isFinite(body.lateGraceMinutes) ? Math.max(0, Number(body.lateGraceMinutes)) : 0;
  const earlyGraceMinutes = Number.isFinite(body.earlyGraceMinutes) ? Math.max(0, Number(body.earlyGraceMinutes)) : 0;
  const overtimeThresholdMinutes = Number.isFinite(body.overtimeThresholdMinutes)
    ? Math.max(0, Number(body.overtimeThresholdMinutes))
    : 0;
  const status = body.status === "ARCHIVED" ? "ARCHIVED" : "ACTIVE";

  if (!code || !name || !startTime || !endTime) {
    return NextResponse.json(
      { message: "Mã, tên ca, giờ bắt đầu và giờ kết thúc là bắt buộc." },
      { status: 400 }
    );
  }

  const existed = await prisma.workShift.findUnique({ where: { code } });
  if (existed) {
    return NextResponse.json({ message: "Mã ca làm đã tồn tại." }, { status: 400 });
  }

  const created = await prisma.workShift.create({
    data: {
      code,
      name,
      startTime,
      endTime,
      breakMinutes,
      lateGraceMinutes,
      earlyGraceMinutes,
      overtimeThresholdMinutes,
      status,
    },
  });

  return NextResponse.json({ item: created });
}
