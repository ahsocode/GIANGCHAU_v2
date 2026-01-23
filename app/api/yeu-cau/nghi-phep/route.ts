import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

type LeavePayload = {
  from?: string;
  to?: string;
  type?: "ANNUAL" | "SICK" | "UNPAID" | "OTHER";
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

  const body = (await request.json()) as LeavePayload;
  const fromRaw = body.from?.trim();
  const toRaw = body.to?.trim();
  const type = body.type;
  const reason = body.reason?.trim();

  if (!fromRaw || !toRaw || !type) {
    return NextResponse.json({ message: "Thiếu thông tin nghỉ phép." }, { status: 400 });
  }

  const startDate = parseDateOnly(fromRaw);
  const endDate = parseDateOnly(toRaw);
  if (!startDate || !endDate || startDate > endDate) {
    return NextResponse.json({ message: "Khoảng ngày không hợp lệ." }, { status: 400 });
  }

  const allowedTypes = ["ANNUAL", "SICK", "UNPAID", "OTHER"];
  if (!allowedTypes.includes(type)) {
    return NextResponse.json({ message: "Loại nghỉ phép không hợp lệ." }, { status: 400 });
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
    const request = await tx.leaveRequest.create({
      data: {
      employeeId,
        type,
        startDate,
        endDate,
        reason: reason || null,
        status: "SUBMITTED",
        submittedAt: new Date(),
      },
      select: { id: true },
    });

    await tx.requestActionLog.create({
      data: {
        requestType: "LEAVE",
        requestId: request.id,
        status: "SUBMITTED",
      },
    });

    return request;
  });

  return NextResponse.json({ id: created.id });
}
