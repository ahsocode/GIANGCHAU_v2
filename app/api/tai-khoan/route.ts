import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Prisma, RoleKey, AccountStatus } from "@prisma/client";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q")?.trim();
  const sort = searchParams.get("sort") ?? "createdAt";
  const order = searchParams.get("order") === "asc" ? "asc" : "desc";
  const roleKey = searchParams.get("roleKey") || undefined;
  const status = searchParams.get("status") || undefined;

  const where: Prisma.AccountWhereInput = {};
  if (q) {
    where.OR = [
      { email: { contains: q, mode: "insensitive" } },
      { employee: { fullName: { contains: q, mode: "insensitive" } } },
      { employee: { code: { contains: q, mode: "insensitive" } } },
    ];
  }
  if (roleKey && ["ADMIN", "DIRECTOR", "STAFF", "EMPLOYEE"].includes(roleKey)) {
    where.roleKey = roleKey as RoleKey;
  }
  if (status && ["ACTIVE", "DISABLED"].includes(status)) {
    where.status = status as AccountStatus;
  }

  let orderBy: Prisma.AccountOrderByWithRelationInput = { createdAt: order };
  if (sort === "email") orderBy = { email: order };
  else if (sort === "status") orderBy = { status: order };
  else if (sort === "roleKey") orderBy = { roleKey: order };
  else if (sort === "employee") orderBy = { employee: { fullName: order } };
  else orderBy = { createdAt: order };

  const accounts = await prisma.account.findMany({
    where,
    orderBy,
    include: { employee: { select: { id: true, code: true, fullName: true } } },
  });

  return NextResponse.json({
    items: accounts.map((acc) => ({
      id: acc.id,
      email: acc.email,
      roleKey: acc.roleKey,
      status: acc.status,
      createdAt: acc.createdAt,
      employeeId: acc.employee?.id ?? null,
      employeeCode: acc.employee?.code ?? null,
      employeeName: acc.employee?.fullName ?? null,
    })),
  });
}
