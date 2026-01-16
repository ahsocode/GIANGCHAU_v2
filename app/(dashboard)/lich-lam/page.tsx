import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { LichLamClient } from "./lich-lam-client";

export const dynamic = "force-dynamic";

export default async function LichLamPage() {
  const session = await auth();
  if (!session?.user?.email) {
    redirect("/dang-nhap");
  }

  const account = await prisma.account.findUnique({
    where: { email: session.user.email.toLowerCase() },
    select: { employee: { select: { id: true } } },
  });

  if (!account?.employee?.id) {
    return <div className="text-sm text-slate-600">Chưa có hồ sơ nhân viên để xem lịch làm.</div>;
  }

  return <LichLamClient />;
}
