import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { Sidebar } from "@/components/layout/sidebar";
import { auth } from "@/auth";
import type { RoleKey } from "@/lib/rbac";

export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const session = await auth();
  if (!session?.user) {
    redirect("/dang-nhap");
  }

  const role = (session.user as { roleKey?: RoleKey }).roleKey ?? ("EMPLOYEE" as RoleKey);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="flex flex-col md:flex-row min-h-screen">
        <Sidebar role={role} />

        <main className="flex-1 flex flex-col min-w-0">
          {/* Header */}
          <div className="border-b bg-white sticky top-0 z-10 shadow-sm">
            <div className="w-full px-4 py-3 md:px-6 md:py-4">
              <div className="flex items-start justify-between gap-2 flex-wrap">
                <div>
                  <h1 className="text-lg sm:text-xl font-semibold">Dashboard</h1>
                  <p className="text-xs sm:text-sm text-muted-foreground">
                    Quản lý nhân sự, ca làm và chấm công
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 w-full">
            <div className="px-4 py-4 md:px-6 md:py-6 max-w-full">
              <div className="max-w-full overflow-x-hidden">{children}</div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
