import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

type BenefitPayload = {
  totalAnnualLeaveDays?: number;
  usedAnnualLeaveDays?: number;
  usedShiftChangeCount?: number;
};

function normalizeNumber(value: number | undefined) {
  if (value === undefined) return null;
  if (!Number.isFinite(value)) return null;
  return Math.max(0, Math.floor(value));
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  if (!id) {
    return NextResponse.json({ message: "Thiếu id" }, { status: 400 });
  }

  const body = (await request.json()) as BenefitPayload;
  const totalAnnualLeaveDays = normalizeNumber(body.totalAnnualLeaveDays);
  const usedAnnualLeaveDays = normalizeNumber(body.usedAnnualLeaveDays);
  const usedShiftChangeCount = normalizeNumber(body.usedShiftChangeCount);

  if (totalAnnualLeaveDays === null || usedAnnualLeaveDays === null || usedShiftChangeCount === null) {
    return NextResponse.json({ message: "Dữ liệu quyền lợi không hợp lệ." }, { status: 400 });
  }

  const employee = await prisma.employee.findUnique({
    where: { id },
    select: { id: true },
  });
  if (!employee) {
    return NextResponse.json({ message: "Không tìm thấy nhân viên" }, { status: 404 });
  }

  const benefit = await prisma.employeeBenefit.upsert({
    where: { employeeId: employee.id },
    create: {
      employeeId: employee.id,
      totalAnnualLeaveDays,
      usedAnnualLeaveDays,
      usedShiftChangeCount,
    },
    update: {
      totalAnnualLeaveDays,
      usedAnnualLeaveDays,
      usedShiftChangeCount,
    },
    select: {
      totalAnnualLeaveDays: true,
      usedAnnualLeaveDays: true,
      usedShiftChangeCount: true,
    },
  });

  return NextResponse.json({ item: benefit });
}
