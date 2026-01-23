import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

type ProfileUpdatePayload = {
  field?: "ACCOUNT_EMAIL" | "PHONE" | "CITIZEN_ID" | "SOCIAL_INSURANCE";
  newValue?: string;
  reason?: string;
};

export async function POST(request: Request) {
  const session = await auth();
  const email = session?.user?.email?.toLowerCase();
  if (!email) {
    return NextResponse.json({ message: "Chưa đăng nhập" }, { status: 401 });
  }

  const body = (await request.json()) as ProfileUpdatePayload;
  const field = body.field;
  const newValue = body.newValue?.trim();
  const reason = body.reason?.trim();

  if (!field || !newValue) {
    return NextResponse.json({ message: "Thiếu thông tin cập nhật." }, { status: 400 });
  }

  const allowedFields = ["ACCOUNT_EMAIL", "PHONE", "CITIZEN_ID", "SOCIAL_INSURANCE"];
  if (!allowedFields.includes(field)) {
    return NextResponse.json({ message: "Loại thông tin không hợp lệ." }, { status: 400 });
  }

  const account = await prisma.account.findUnique({
    where: { email },
    select: {
      employeeId: true,
      email: true,
      employee: {
        select: {
          phone: true,
          citizenIdNumber: true,
          socialInsuranceNumber: true,
        },
      },
    },
  });
  if (!account?.employeeId) {
    return NextResponse.json({ message: "Không tìm thấy nhân viên." }, { status: 404 });
  }
  const employeeId = account.employeeId;

  const previousValue =
    field === "ACCOUNT_EMAIL"
      ? account.email
      : field === "PHONE"
        ? account.employee?.phone ?? null
        : field === "CITIZEN_ID"
          ? account.employee?.citizenIdNumber ?? null
          : field === "SOCIAL_INSURANCE"
            ? account.employee?.socialInsuranceNumber ?? null
            : null;

  const created = await prisma.$transaction(async (tx) => {
    const request = await tx.profileUpdateRequest.create({
      data: {
        employeeId,
        field,
        newValue,
        previousValue,
        reason: reason || null,
        status: "SUBMITTED",
        submittedAt: new Date(),
      },
      select: { id: true },
    });

    await tx.requestActionLog.create({
      data: {
        requestType: "PROFILE_UPDATE",
        requestId: request.id,
        status: "SUBMITTED",
      },
    });

    return request;
  });

  return NextResponse.json({ id: created.id });
}
