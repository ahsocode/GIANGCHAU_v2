import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

type ShiftChangePayload = {
  date?: string;
  desiredShiftId?: string;
  reason?: string;
};

function parseDateOnly(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return null;
  const date = new Date(Date.UTC(year, month - 1, day));
  return Number.isNaN(date.getTime()) ? null : date;
}

export async function POST(request: Request) {
  const session = await auth();
  const email = session?.user?.email?.toLowerCase();
  if (!email) {
    return NextResponse.json({ message: "Chưa đăng nhập" }, { status: 401 });
  }

  const body = (await request.json()) as ShiftChangePayload;
  const dateValue = body.date?.trim();
  const desiredShiftId = body.desiredShiftId?.trim();
  const reason = body.reason?.trim();

  if (!dateValue || !desiredShiftId) {
    return NextResponse.json({ message: "Thiếu thông tin đổi ca." }, { status: 400 });
  }

  const date = parseDateOnly(dateValue);
  if (!date) {
    return NextResponse.json({ message: "Ngày không hợp lệ." }, { status: 400 });
  }

  const account = await prisma.account.findUnique({
    where: { email },
    select: { employeeId: true },
  });
  if (!account?.employeeId) {
    return NextResponse.json({ message: "Không tìm thấy nhân viên." }, { status: 404 });
  }
  const employeeId = account.employeeId;

  const now = new Date();
  const todayUtc = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
  if (date.getTime() <= todayUtc.getTime()) {
    return NextResponse.json(
      { message: "Không thể yêu cầu đổi ca cho hôm nay hoặc ngày trong quá khứ." },
      { status: 400 }
    );
  }

  const schedule = await prisma.workSchedule.findFirst({
    where: { employeeId, date },
    select: { id: true, workShiftId: true },
  });
  if (!schedule?.workShiftId) {
    return NextResponse.json({ message: "Ngày này chưa có ca làm." }, { status: 400 });
  }
  const currentShiftId = schedule.workShiftId;

  if (schedule.workShiftId === desiredShiftId) {
    return NextResponse.json({ message: "Ca mong muốn phải khác ca hiện tại." }, { status: 400 });
  }

  const desiredShift = await prisma.workShift.findUnique({
    where: { id: desiredShiftId },
    select: { id: true },
  });
  if (!desiredShift) {
    return NextResponse.json({ message: "Ca mong muốn không hợp lệ." }, { status: 400 });
  }

  const created = await prisma.$transaction(async (tx) => {
    const request = await tx.shiftChangeRequest.create({
      data: {
        employeeId,
        date,
        currentShiftId,
        desiredShiftId,
        reason: reason || null,
        status: "SUBMITTED",
        submittedAt: new Date(),
      },
      select: { id: true },
    });

    await tx.requestActionLog.create({
      data: {
        requestType: "SHIFT_CHANGE",
        requestId: request.id,
        status: "SUBMITTED",
      },
    });

    return request;
  });

  return NextResponse.json({ id: created.id });
}
