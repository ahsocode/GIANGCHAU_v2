import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { generateEmployeeCode } from "@/lib/employee-code";
import type { EmploymentType } from "@/lib/employee-code";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q")?.trim();
  const sort = searchParams.get("sort") ?? "createdAt";
  const order = searchParams.get("order") === "asc" ? "asc" : "desc";
  const departmentId = searchParams.get("departmentId") || undefined;
  const positionId = searchParams.get("positionId") || undefined;

  const where: Prisma.EmployeeWhereInput = {};
  if (q && q.length > 0) {
    where.OR = [
      { code: { contains: q, mode: "insensitive" as const } },
      { fullName: { contains: q, mode: "insensitive" as const } },
      { phone: { contains: q, mode: "insensitive" as const } },
    ];
  }
  if (departmentId) where.departmentId = departmentId;
  if (positionId) where.positionId = positionId;

  let orderBy: Prisma.EmployeeOrderByWithRelationInput = { createdAt: order };
  if (sort === "code") orderBy = { code: order };
  else if (sort === "fullName") orderBy = { fullName: order };
  else if (sort === "department") orderBy = { department: { name: order } };
  else if (sort === "position") orderBy = { position: { name: order } };
  else orderBy = { createdAt: order };

  const items = await prisma.employee.findMany({
    where,
    orderBy,
    include: {
      department: { select: { id: true, name: true } },
      position: { select: { id: true, name: true, code: true } },
      account: { select: { id: true, email: true } },
    },
  });

  return NextResponse.json({
    items: items.map((e: (typeof items)[number]) => ({
      id: e.id,
      code: e.code,
      fullName: e.fullName,
      employmentType: ((e as unknown as { employmentType?: EmploymentType }).employmentType ?? "CT") as EmploymentType,
      departmentId: e.departmentId,
      departmentName: e.department?.name ?? null,
      positionId: e.positionId,
      positionName: e.position?.name ?? null,
      positionCode: e.position?.code ?? null,
      accountEmail: e.account?.email ?? null,
      personalEmail: (e as { personalEmail?: string | null }).personalEmail ?? null,
      isActive: e.isActive,
      avatarUrl: (e as { avatarUrl?: string | null }).avatarUrl ?? null,
      createdAt: e.createdAt,
    })),
  });
}

export async function POST(request: Request) {
  const body = (await request.json()) as {
    fullName?: string;
    departmentId?: string | null;
    positionId?: string | null;
    employmentType?: EmploymentType | string;
  };

  const fullName = body.fullName?.trim();
  if (!fullName) {
    return NextResponse.json({ message: "Tên nhân viên là bắt buộc" }, { status: 400 });
  }
  const employmentType: EmploymentType =
    body.employmentType === "TV" ? "TV" : "CT";

  const code = await generateEmployeeCode({
    positionId: body.positionId,
    employmentType,
  });

  const created = await prisma.employee.create({
    data: {
      code,
      fullName,
      departmentId: body.departmentId || null,
      positionId: body.positionId || null,
    },
  });

  return NextResponse.json({
    item: {
      ...created,
      employmentType,
    },
  });
}
