import { prisma } from "@/lib/prisma";

export type EmploymentType = "CT" | "TV";

export async function generateEmployeeCode(input: {
  positionId?: string | null;
  employmentType: EmploymentType;
  now?: Date;
}) {
  const now = input.now ?? new Date();
  const year = now.getFullYear();
  const month = (now.getMonth() + 1).toString().padStart(2, "0");

  let positionCode = "NV";
  if (input.positionId) {
    const pos = await prisma.position.findUnique({
      where: { id: input.positionId },
      select: { code: true },
    });
    if (pos?.code) positionCode = pos.code;
  }

  const monthStart = new Date(Date.UTC(now.getFullYear(), now.getMonth(), 1, 0, 0, 0));
  const monthEnd = new Date(Date.UTC(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999));

  const countInMonth = await prisma.employee.count({
    where: {
      createdAt: {
        gte: monthStart,
        lte: monthEnd,
      },
    },
  });
  const seq = (countInMonth + 1).toString().padStart(4, "0");

  const typeSuffix = input.employmentType === "TV" ? "TV" : "CT";

  return `GC${positionCode}${year}${month}${seq}${typeSuffix}`.toUpperCase();
}
