import type { ReactNode } from "react";
import { Sidebar } from "@/components/layout/sidebar";
import { getCurrentRoleDev } from "@/lib/auth-dev";

export default async function DashboardLayout({ children }: { children: ReactNode }) {
  // ✅ DEV: role lấy tạm (sau này thay bằng NextAuth/Supabase)
  const role = await getCurrentRoleDev();

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="flex">
        <Sidebar role={role} />

        <main className="flex-1">
          <div className="border-b bg-white">
            <div className="mx-auto max-w-6xl px-4 py-4">
              <div className="flex items-center justify-between">
                <div>
                  <h1 className="text-lg font-semibold">Dashboard</h1>
                  <p className="text-sm text-muted-foreground">
                    Quản lý nhân sự, ca làm và chấm công
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="mx-auto max-w-6xl px-4 py-6">{children}</div>
        </main>
      </div>
    </div>
  );
}
