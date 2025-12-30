import type { ReactNode } from "react";
import { Sidebar } from "@/components/layout/sidebar";
import { getCurrentRoleDev } from "@/lib/auth-dev";

export default async function DashboardLayout({ children }: { children: ReactNode }) {
  // ✅ DEV: role lấy tạm (sau này thay bằng NextAuth/Supabase)
  const role = await getCurrentRoleDev();

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="flex flex-col md:flex-row">
        <Sidebar role={role} />

        <main className="flex-1">
          <div className="border-b bg-white">
            <div className="w-full px-4 py-3 md:px-6 md:py-4">
              <div className="flex items-start justify-between gap-2 flex-wrap">
                <div>
                  <h1 className="text-lg font-semibold">Dashboard</h1>
                  <p className="text-sm text-muted-foreground">
                    Quản lý nhân sự, ca làm và chấm công
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="w-full px-4 py-4 md:px-6 md:py-6">
            <div className="max-w-full overflow-x-auto">{children}</div>
          </div>
        </main>
      </div>
    </div>
  );
}
