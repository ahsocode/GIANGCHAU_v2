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

export async function GET() {
  const items = await prisma.holidayType.findMany({
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json({ items });
}

export async function POST(request: Request) {
  const body = (await request.json()) as Payload;
  const name = body.name?.trim();
  if (!name) {
    return NextResponse.json({ message: "Tên loại ngày nghỉ là bắt buộc." }, { status: 400 });
  }
  const existing = await prisma.holidayType.findFirst({
    where: { name: { equals: name, mode: "insensitive" } },
    select: { id: true },
  });
  if (existing) {
    return NextResponse.json({ message: "Tên loại ngày nghỉ đã tồn tại." }, { status: 400 });
  }

  const created = await prisma.holidayType.create({
    data: {
      name,
      color: normalizeColor(body.color),
      payPolicy: body.payPolicy === "UNPAID" ? "UNPAID" : body.payPolicy === "LEAVE" ? "LEAVE" : "PAID",
    },
  });
  return NextResponse.json({ item: created });
}
