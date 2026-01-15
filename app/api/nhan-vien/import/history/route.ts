import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const limit = Math.max(1, Number(searchParams.get("limit") ?? "50") || 50);

  const items = await prisma.fileImport.findMany({
    where: {
      type: { in: ["EMPLOYEE", "EMPLOYEE_UPLOAD"] },
    },
    orderBy: { createdAt: "desc" },
    take: limit,
    include: {
      createdBy: { select: { id: true, name: true, email: true } },
    },
  });

  return NextResponse.json({
    items: items.map((item) => ({
      id: item.id,
      type: item.type,
      fileName: item.fileName,
      totalRows: item.totalRows,
      successRows: item.successRows,
      failedRows: item.failedRows,
      createdAt: item.createdAt,
      createdBy: item.createdBy
        ? { id: item.createdBy.id, name: item.createdBy.name, email: item.createdBy.email }
        : null,
    })),
  });
}
