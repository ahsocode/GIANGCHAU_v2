import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await auth();
  const email = session?.user?.email?.toLowerCase();
  if (!email) {
    return NextResponse.json({ message: "Chưa đăng nhập" }, { status: 401 });
  }

  const account = await prisma.account.findUnique({
    where: { email },
    select: { employeeId: true },
  });
  if (!account?.employeeId) {
    return NextResponse.json({ message: "Không tìm thấy nhân viên." }, { status: 404 });
  }

  const [benefit, policy] = await Promise.all([
    prisma.employeeBenefit.findUnique({
      where: { employeeId: account.employeeId },
      select: { usedShiftChangeCount: true },
    }),
    prisma.shiftChangePolicy.findUnique({
      where: { key: "GLOBAL" },
      select: { totalShiftChangeCount: true },
    }),
  ]);

  return NextResponse.json({
    totalShiftChangeCount: policy?.totalShiftChangeCount ?? 0,
    usedShiftChangeCount: benefit?.usedShiftChangeCount ?? 0,
  });
}
