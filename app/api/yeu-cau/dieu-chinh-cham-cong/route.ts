import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

type AttendanceAdjustmentPayload = {
  date?: string;
  field?: "CHECK_IN_TIME" | "CHECK_OUT_TIME" | "CHECK_IN_STATUS" | "CHECK_OUT_STATUS";
  newValue?: string;
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

  const body = (await request.json()) as AttendanceAdjustmentPayload;
  const dateRaw = body.date?.trim();
  const field = body.field;
  const newValue = body.newValue?.trim();
  const reason = body.reason?.trim();

  if (!dateRaw || !field || !newValue) {
    return NextResponse.json({ message: "Thiếu thông tin điều chỉnh chấm công." }, { status: 400 });
  }

  const allowedFields = ["CHECK_IN_TIME", "CHECK_OUT_TIME", "CHECK_IN_STATUS", "CHECK_OUT_STATUS"];
  if (!allowedFields.includes(field)) {
    return NextResponse.json({ message: "Loại điều chỉnh không hợp lệ." }, { status: 400 });
  }

  const date = parseDateOnly(dateRaw);
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

  const created = await prisma.$transaction(async (tx) => {
    const request = await tx.attendanceAdjustmentRequest.create({
      data: {
      employeeId,
        date,
        field,
        newValue,
        reason: reason || null,
        status: "SUBMITTED",
        submittedAt: new Date(),
      },
      select: { id: true },
    });

    await tx.requestActionLog.create({
      data: {
        requestType: "ATTENDANCE_ADJUSTMENT",
        requestId: request.id,
        status: "SUBMITTED",
      },
    });

    return request;
  });

  return NextResponse.json({ id: created.id });
}
