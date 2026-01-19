import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

type Payload = {
  name?: string;
  color?: string;
  payPolicy?: "PAID" | "UNPAID" | "LEAVE";
};

function normalizeColor(value?: string | null) {
  if (!value) return "#F59E0B";
  const trimmed = value.trim();
  if (!trimmed.startsWith("#")) return trimmed;
  return trimmed.toUpperCase();
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!id) return NextResponse.json({ message: "Thiếu id" }, { status: 400 });

  const body = (await request.json()) as Payload;
  const name = body.name?.trim();
  if (!name) {
    return NextResponse.json({ message: "Tên loại ngày nghỉ là bắt buộc." }, { status: 400 });
  }

  const existing = await prisma.holidayType.findFirst({
    where: { id: { not: id }, name: { equals: name, mode: "insensitive" } },
    select: { id: true },
  });
  if (existing) {
    return NextResponse.json({ message: "Tên loại ngày nghỉ đã tồn tại." }, { status: 400 });
  }

  const updated = await prisma.holidayType.update({
    where: { id },
    data: {
      name,
      color: normalizeColor(body.color),
      payPolicy: body.payPolicy === "UNPAID" ? "UNPAID" : body.payPolicy === "LEAVE" ? "LEAVE" : "PAID",
    },
  });

  return NextResponse.json({ item: updated });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!id) return NextResponse.json({ message: "Thiếu id" }, { status: 400 });

  const count = await prisma.holiday.count({ where: { holidayTypeId: id } });
  if (count > 0) {
    return NextResponse.json(
      { message: "Không thể xoá vì đã có ngày nghỉ sử dụng loại này." },
      { status: 400 }
    );
  }

  await prisma.holidayType.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
