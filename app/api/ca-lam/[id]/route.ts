import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

type UpdatePayload = {
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

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const params = await context.params;
  const item = await prisma.workShift.findUnique({ where: { id: params.id } });
  if (!item) return NextResponse.json({ message: "Không tìm thấy ca làm." }, { status: 404 });
  return NextResponse.json({ item });
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const params = await context.params;
  const body = (await request.json()) as UpdatePayload;
  const current = await prisma.workShift.findUnique({ where: { id: params.id } });
  if (!current) {
    return NextResponse.json({ message: "Không tìm thấy ca làm." }, { status: 404 });
  }

  const code = body.code?.trim() ?? current.code;
  const name = body.name?.trim() ?? current.name;
  const startTime = body.startTime?.trim() ?? current.startTime;
  const endTime = body.endTime?.trim() ?? current.endTime;
  const breakMinutes = Number.isFinite(body.breakMinutes)
    ? Math.max(0, Number(body.breakMinutes))
    : current.breakMinutes;
  const lateGraceMinutes = Number.isFinite(body.lateGraceMinutes)
    ? Math.max(0, Number(body.lateGraceMinutes))
    : current.lateGraceMinutes;
  const earlyGraceMinutes = Number.isFinite(body.earlyGraceMinutes)
    ? Math.max(0, Number(body.earlyGraceMinutes))
    : current.earlyGraceMinutes;
  const overtimeThresholdMinutes = Number.isFinite(body.overtimeThresholdMinutes)
    ? Math.max(0, Number(body.overtimeThresholdMinutes))
    : current.overtimeThresholdMinutes;
  const status = body.status === "ARCHIVED" ? "ARCHIVED" : "ACTIVE";

  if (!code || !name || !startTime || !endTime) {
    return NextResponse.json(
      { message: "Mã, tên ca, giờ bắt đầu và giờ kết thúc là bắt buộc." },
      { status: 400 }
    );
  }

  const existed = await prisma.workShift.findUnique({ where: { code } });
  if (existed && existed.id !== params.id) {
    return NextResponse.json({ message: "Mã ca làm đã tồn tại." }, { status: 400 });
  }

  if (status !== current.status) {
    const scheduleCount = await prisma.workSchedule.count({
      where: { workShiftId: params.id },
    });
    if (scheduleCount > 0) {
      return NextResponse.json(
        { message: "Không thể đổi trạng thái vì đã có nhân viên thuộc ca này." },
        { status: 400 }
      );
    }
  }

  const updated = await prisma.workShift.update({
    where: { id: params.id },
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

  return NextResponse.json({ item: updated });
}

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  const params = await context.params;
  await prisma.workShift.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
