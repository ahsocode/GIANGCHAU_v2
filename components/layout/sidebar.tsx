"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, LogOut, ChevronDown, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { getMenuByRole, type RoleKey } from "@/lib/rbac";
import { toast } from "sonner";
import { useState } from "react";
import { signOut } from "next-auth/react";

export function Sidebar({ role }: { role: RoleKey }) {
  const pathname = usePathname();
  const items = getMenuByRole(role);
  const [loading, setLoading] = useState(false);
  const [openHr, setOpenHr] = useState(true);

  async function handleLogout() {
    try {
      setLoading(true);
      await signOut({ callbackUrl: "/dang-nhap", redirect: true });
      toast.success("Đã đăng xuất");
    } catch (error) {
      console.error(error);
      toast.error("Không thể đăng xuất. Thử lại.");
    } finally {
      setLoading(false);
    }
  }

  const hrKeys = new Set(["nhan-vien", "tai-khoan"]);
  const hrItems = items.filter((i) => hrKeys.has(i.key));
  const mainItems = items.filter((i) => !hrKeys.has(i.key));

  const Nav = (
    <>
      <nav className="space-y-1">
        {mainItems.map((it) => {
          const active = pathname === it.href;
          const Icon = it.icon;
          return (
            <Link
              key={it.key}
              href={it.href}
              className={[
                "flex items-center gap-2 px-3 py-2 text-sm transition",
                active ? "bg-gray-100 font-medium" : "hover:bg-gray-100",
              ].join(" ")}
            >
              <Icon className="h-4 w-4" />
              <span>{it.label}</span>
            </Link>
          );
        })}

        {hrItems.length > 0 && (
          <div className="mt-2 space-y-1">
            <button
              type="button"
              onClick={() => setOpenHr((v) => !v)}
              className="flex w-full items-center justify-between px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100"
            >
              <span className="inline-flex items-center gap-2">
                <Users className="h-4 w-4" />
                Nhân viên
              </span>
              <ChevronDown className={`h-4 w-4 transition ${openHr ? "rotate-180" : ""}`} />
            </button>
            {openHr && (
              <div className="space-y-1 pl-2">
                {hrItems.map((it) => {
                  const active = pathname === it.href;
                  const Icon = it.icon;
                  return (
                    <Link
                      key={it.key}
                      href={it.href}
                      className={[
                        "flex items-center gap-2 px-3 py-2 text-sm transition",
                        active ? "bg-gray-100 font-medium" : "hover:bg-gray-100",
                      ].join(" ")}
                    >
                      <Icon className="h-4 w-4" />
                      <span>{it.label}</span>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </nav>

      <div className="mt-6 border-t pt-4">
        <Button
          variant="ghost"
          className="w-full justify-start gap-2 rounded-none text-sm text-gray-600 hover:bg-gray-100"
          onClick={handleLogout}
          disabled={loading}
        >
          <LogOut className="h-4 w-4" />
          Đăng xuất
        </Button>
      </div>
    </>
  );

  return (
    <>
      <aside className="hidden w-64 shrink-0 border-r bg-white md:block">
        <div className="p-4">
          <div className="mb-4">
            <div className="text-lg font-semibold">Giang Châu</div>
            <div className="text-xs text-muted-foreground">Role: {role}</div>
          </div>
          {Nav}
        </div>
      </aside>

      <div className="md:hidden fixed left-4 top-4 z-50">
        <Sheet>
          <SheetTrigger asChild>
            <Button variant="outline" size="icon" aria-label="Mở menu" className="rounded-none">
              <Menu className="h-5 w-5" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-72">
            <SheetHeader className="mb-4">
                <SheetTitle>Menu</SheetTitle>
            </SheetHeader>

            <div className="mb-4">
              <div className="text-lg font-semibold">Giang Châu</div>
              <div className="text-xs text-muted-foreground">Role: {role}</div>
            </div>

            {Nav}
          </SheetContent>
        </Sheet>
      </div>
    </>
  );
}
