import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import type { RoleKey } from "@/lib/rbac";
import QuanLiChamCongTabs from "./ui/quan-li-cham-cong-tabs";

export default async function QuanLiChamCongLayout({ children }: { children: ReactNode }) {
  const session = await auth();
  if (!session?.user) {
    redirect("/dang-nhap");
  }

  const role = (session.user as { roleKey?: RoleKey }).roleKey ?? ("EMPLOYEE" as RoleKey);
  if (role !== "ADMIN" && role !== "DIRECTOR") {
    redirect("/tong-quan");
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg sm:text-xl font-semibold">Quản lý chấm công</h1>
        <p className="text-sm text-muted-foreground">Theo dõi dữ liệu chấm công và log thô từ máy.</p>
      </div>
      <QuanLiChamCongTabs />
      {children}
    </div>
  );
}
