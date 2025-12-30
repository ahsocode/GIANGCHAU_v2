import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const accounts = await prisma.account.findMany({
    orderBy: { createdAt: "desc" },
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
