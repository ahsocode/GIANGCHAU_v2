import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q")?.trim();
  const sort = searchParams.get("sort") ?? "createdAt";
  const order = searchParams.get("order") === "asc" ? "asc" : "desc";

  const where =
    q && q.length > 0
      ? {
          OR: [
            { code: { contains: q, mode: "insensitive" as const } },
            { name: { contains: q, mode: "insensitive" as const } },
          ],
        }
      : undefined;

  let orderBy:
    | { createdAt: "asc" | "desc" }
    | { code: "asc" | "desc" }
    | { name: "asc" | "desc" }
    | { employees: { _count: "asc" | "desc" } } = { createdAt: "desc" };

  if (sort === "code") orderBy = { code: order };
  else if (sort === "name") orderBy = { name: order };
  else if (sort === "employeeCount") orderBy = { employees: { _count: order } };
  else orderBy = { createdAt: order };

  const items = await prisma.department.findMany({
    where,
    orderBy,
    include: { _count: { select: { employees: true } } },
  });
  return NextResponse.json({
    items: items.map((d: (typeof items)[number]) => ({
      id: d.id,
      code: d.code,
      name: d.name,
      employeeCount: d._count.employees,
      createdAt: d.createdAt,
    })),
  });
}

export async function POST(request: Request) {
  const body = (await request.json()) as { ma?: string; ten?: string };
  const ma = body.ma?.trim();
  const ten = body.ten?.trim();
  if (!ma || !ten) {
    return NextResponse.json({ message: "Mã và tên bộ phận là bắt buộc" }, { status: 400 });
  }

  const existingByName = await prisma.department.findFirst({
    where: { name: { equals: ten, mode: "insensitive" as const } },
    select: { id: true },
  });
  if (existingByName) {
    return NextResponse.json({ message: "Tên bộ phận đã tồn tại" }, { status: 400 });
  }

  const normalizeCode = (value: string) => value.toUpperCase().replace(/[^A-Z0-9]/g, "");
  const baseCode = normalizeCode(ma) || "BP";
  let code = baseCode;
  let suffix = 1;
  // If code exists, generate a close variant by appending a number.
  // This avoids blocking creation while keeping the code similar.
  while (await prisma.department.findUnique({ where: { code } })) {
    code = `${baseCode}${suffix}`;
    suffix += 1;
  }

  const created = await prisma.department.create({ data: { code, name: ten } });
  return NextResponse.json({ item: created });
}
