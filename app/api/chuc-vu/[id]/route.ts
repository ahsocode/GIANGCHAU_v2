import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const body = (await request.json()) as { ma?: string; ten?: string };
  const ma = body.ma?.trim();
  const ten = body.ten?.trim();
  const { id } = await params;

  if (!id) {
    return NextResponse.json({ message: "Thiếu id" }, { status: 400 });
  }
  if (!ma || !ten) {
    return NextResponse.json({ message: "Mã và tên chức vụ là bắt buộc" }, { status: 400 });
  }

  const updated = await prisma.position.update({
    where: { id },
    data: { code: ma, name: ten },
    include: { _count: { select: { employees: true } } },
  });

  return NextResponse.json({
    item: {
      id: updated.id,
      code: updated.code,
      name: updated.name,
      employeeCount: updated._count.employees,
      createdAt: updated.createdAt,
    },
  });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  if (!id) {
    return NextResponse.json({ message: "Thiếu id" }, { status: 400 });
  }
  await prisma.position.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
