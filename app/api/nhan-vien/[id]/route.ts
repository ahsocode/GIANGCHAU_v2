import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import type { EmploymentType } from "@/lib/employee-code";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  if (!id) return NextResponse.json({ message: "Thiếu id" }, { status: 400 });

  const body = (await request.json()) as {
    fullName?: string;
    departmentId?: string | null;
    positionId?: string | null;
    employmentType?: EmploymentType | string;
    isActive?: boolean;
  };

  const fullName = body.fullName?.trim();
  if (!fullName) {
    return NextResponse.json({ message: "Tên nhân viên là bắt buộc" }, { status: 400 });
  }

  const employmentType: EmploymentType = body.employmentType === "TV" ? "TV" : "CT";

  const updated = await prisma.employee.update({
    where: { id },
    data: {
      fullName,
      departmentId: body.departmentId || null,
      positionId: body.positionId || null,
      isActive: body.isActive ?? true,
    },
    include: {
      department: { select: { id: true, name: true } },
      position: { select: { id: true, name: true, code: true } },
      account: { select: { id: true, email: true } },
    },
  });

  return NextResponse.json({
    item: {
      id: updated.id,
      code: updated.code,
      fullName: updated.fullName,
      employmentType,
      departmentId: updated.departmentId,
      departmentName: updated.department?.name ?? null,
      positionId: updated.positionId,
      positionName: updated.position?.name ?? null,
      positionCode: updated.position?.code ?? null,
      accountEmail: updated.account?.email ?? null,
      isActive: updated.isActive,
      createdAt: updated.createdAt,
    },
  });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  if (!id) return NextResponse.json({ message: "Thiếu id" }, { status: 400 });

  const emp = await prisma.employee.findUnique({
    where: { id },
    select: { account: { select: { id: true } } },
  });
  if (emp?.account) {
    return NextResponse.json(
      { message: "Không thể xoá nhân viên đang gắn tài khoản" },
      { status: 400 }
    );
  }

  await prisma.employee.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
