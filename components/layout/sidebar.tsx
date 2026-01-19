"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Menu,
  LogOut,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Users,
  X,
  UserCircle,
  CalendarRange,
  Clock4,
  BarChart2,
  MessageSquare,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { getMenuByRole, type RoleKey } from "@/lib/rbac";
import { toast } from "sonner";
import { useState, useEffect } from "react";
import { signOut } from "next-auth/react";
import { cn } from "@/lib/utils";

export function Sidebar({ role }: { role: RoleKey }) {
  const pathname = usePathname();
  const items = getMenuByRole(role);
  const [loading, setLoading] = useState(false);
  const [openHr, setOpenHr] = useState(false);
  const [openPersonal, setOpenPersonal] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const isEmployee = role === "EMPLOYEE";

  useEffect(() => {
    const saved = localStorage.getItem("sidebar-collapsed");
    if (saved !== null) {
      setCollapsed(saved === "true");
    }
  }, []);

  // Đóng sidebar mobile khi đổi route hoặc lên desktop để tránh overlay bị giữ lại
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(min-width: 768px)");
    const handleChange = (e: MediaQueryListEvent) => {
      if (e.matches) setMobileOpen(false);
    };
    // initial check
    if (mq.matches) setMobileOpen(false);
    mq.addEventListener("change", handleChange);
    return () => mq.removeEventListener("change", handleChange);
  }, []);

  const toggleCollapsed = () => {
    const newState = !collapsed;
    setCollapsed(newState);
    localStorage.setItem("sidebar-collapsed", String(newState));
  };

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
  const allowBusiness = role !== "EMPLOYEE";
  const hrItems = allowBusiness ? items.filter((i) => hrKeys.has(i.key)) : [];
  const mainItems = allowBusiness ? items.filter((i) => !hrKeys.has(i.key)) : [];
  const personalItems = [
    { key: "ho-so", label: "Hồ sơ", href: "/ho-so", icon: UserCircle },
    { key: "lich-lam", label: "Lịch làm", href: "/lich-lam", icon: CalendarRange },
    { key: "cham-cong", label: "Chấm công", href: "/cham-cong", icon: Clock4 },
    { key: "tong-hop", label: "Tổng hợp", href: "/tong-hop", icon: BarChart2 },
    { key: "yeu-cau", label: "Yêu cầu", href: "/yeu-cau", icon: MessageSquare },
  ];
  const primaryItems = isEmployee ? personalItems : mainItems;

  // Desktop sidebar
  const DesktopNav = (
    <aside
      className={cn(
        "hidden md:flex h-screen sticky top-0 flex-col border-r bg-white transition-all duration-300 ease-in-out shrink-0",
        collapsed ? "w-16" : "w-64"
      )}
    >
      {/* Header */}
      <div className={cn("border-b p-4 flex items-center justify-between", collapsed && "justify-center")}>
        {!collapsed && (
          <div className="flex-1 min-w-0">
            <div className="text-lg font-semibold truncate">Giang Châu</div>
            <div className="text-xs text-slate-500 truncate">Role: {role}</div>
          </div>
        )}
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={toggleCollapsed}
          className="rounded-md shrink-0 hover:bg-slate-100"
          aria-label={collapsed ? "Mở rộng sidebar" : "Thu gọn sidebar"}
        >
          {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </Button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto p-2">
        <div className="space-y-1">
          {primaryItems.map((it) => {
            const active = pathname === it.href || pathname.startsWith(`${it.href}/`);
            const Icon = it.icon;
            return (
              <Link
                key={it.key}
                href={it.href}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 text-sm rounded-md transition-colors",
                  active
                    ? "bg-emerald-50 text-emerald-700 font-medium"
                    : "text-slate-700 hover:bg-slate-100",
                  collapsed && "justify-center"
                )}
                title={collapsed ? it.label : undefined}
              >
                <Icon className="h-4 w-4 shrink-0" />
                {!collapsed && <span className="truncate">{it.label}</span>}
              </Link>
            );
          })}

          {hrItems.length > 0 && (
            <div className="mt-2">
              {collapsed ? (
                <div className="space-y-1">
                  {hrItems.map((it) => {
                    const active = pathname === it.href || pathname.startsWith(`${it.href}/`);
                    const Icon = it.icon;
                    return (
                      <Link
                        key={it.key}
                        href={it.href}
                        className={cn(
                          "flex items-center justify-center gap-3 px-3 py-2.5 text-sm rounded-md transition-colors",
                          active
                            ? "bg-emerald-50 text-emerald-700 font-medium"
                            : "text-slate-700 hover:bg-slate-100"
                        )}
                        title={it.label}
                      >
                        <Icon className="h-4 w-4 shrink-0" />
                      </Link>
                    );
                  })}
                </div>
              ) : (
                <>
                <button
                  type="button"
                  onClick={() => {
                    setOpenHr((v) => !v);
                    setOpenPersonal(false);
                  }}
                  className="flex w-full items-center justify-between px-3 py-2.5 text-sm font-medium text-slate-700 rounded-md hover:bg-slate-100 transition-colors"
                >
                    <span className="inline-flex items-center gap-3 min-w-0">
                      <Users className="h-4 w-4 shrink-0" />
                      <span className="truncate">Nhân viên</span>
                    </span>
                    <ChevronDown
                      className={cn("h-4 w-4 transition-transform shrink-0", openHr && "rotate-180")}
                    />
                  </button>
                <div
                  className={cn(
                    "overflow-hidden transition-[max-height,opacity] duration-200",
                    openHr ? "max-h-96 opacity-100" : "max-h-0 opacity-0"
                  )}
                >
                  <div className="space-y-1 mt-1 ml-2">
                    {hrItems.map((it) => {
                      const active = pathname === it.href || pathname.startsWith(`${it.href}/`);
                      const Icon = it.icon;
                      return (
                        <Link
                          key={it.key}
                          href={it.href}
                          className={cn(
                            "flex items-center gap-3 px-3 py-2.5 text-sm rounded-md transition-colors",
                            active
                              ? "bg-emerald-50 text-emerald-700 font-medium"
                              : "text-slate-700 hover:bg-slate-100"
                          )}
                        >
                          <Icon className="h-4 w-4 shrink-0" />
                          <span className="truncate">{it.label}</span>
                        </Link>
                      );
                    })}
                  </div>
                </div>
                </>
              )}
            </div>
          )}

          {!isEmployee && (
            <div className="mt-2">
              {collapsed ? (
                <div className="space-y-1">
                  {personalItems.map((it) => {
                    const active = pathname === it.href || pathname.startsWith(`${it.href}/`);
                    const Icon = it.icon;
                    return (
                      <Link
                        key={it.key}
                        href={it.href}
                        className={cn(
                          "flex items-center justify-center gap-3 px-3 py-2.5 text-sm rounded-md transition-colors",
                          active
                            ? "bg-emerald-50 text-emerald-700 font-medium"
                            : "text-slate-700 hover:bg-slate-100"
                        )}
                        title={it.label}
                      >
                        <Icon className="h-4 w-4 shrink-0" />
                      </Link>
                    );
                  })}
                </div>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      setOpenPersonal((v) => !v);
                      setOpenHr(false);
                    }}
                    className="flex w-full items-center justify-between px-3 py-2.5 text-sm font-medium text-slate-700 rounded-md hover:bg-slate-100 transition-colors"
                  >
                    <span className="inline-flex items-center gap-3 min-w-0">
                      <UserCircle className="h-4 w-4 shrink-0" />
                      <span className="truncate">Cá nhân</span>
                    </span>
                    <ChevronDown
                      className={cn("h-4 w-4 transition-transform shrink-0", openPersonal && "rotate-180")}
                    />
                  </button>
                  <div
                    className={cn(
                      "overflow-hidden transition-[max-height,opacity] duration-200",
                      openPersonal ? "max-h-96 opacity-100" : "max-h-0 opacity-0"
                    )}
                  >
                    <div className="space-y-1 mt-1 ml-2">
                      {personalItems.map((it) => {
                        const active = pathname === it.href || pathname.startsWith(`${it.href}/`);
                        const Icon = it.icon;
                        return (
                          <Link
                            key={it.key}
                            href={it.href}
                            className={cn(
                              "flex items-center gap-3 px-3 py-2.5 text-sm rounded-md transition-colors",
                              active
                                ? "bg-emerald-50 text-emerald-700 font-medium"
                                : "text-slate-700 hover:bg-slate-100"
                            )}
                          >
                            <Icon className="h-4 w-4 shrink-0" />
                            <span className="truncate">{it.label}</span>
                          </Link>
                        );
                      })}
                    </div>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </nav>

      {/* Logout button - RED */}
      <div className="border-t p-2">
        <Button
          variant="ghost"
          className={cn(
            "w-full rounded-md text-sm font-medium transition-colors",
            "text-red-600 hover:bg-red-50 hover:text-red-700",
            collapsed ? "justify-center px-3" : "justify-start gap-3 px-3"
          )}
          onClick={handleLogout}
          disabled={loading}
          title={collapsed ? "Đăng xuất" : undefined}
        >
          <LogOut className="h-4 w-4 shrink-0" />
          {!collapsed && <span className="truncate">Đăng xuất</span>}
        </Button>
      </div>
    </aside>
  );

  // Mobile sidebar
  const MobileNav = (
    <div className="md:hidden fixed right-3 top-3 z-50">
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetTrigger asChild>
          <Button
            variant="outline"
            size="icon"
            aria-label="Mở menu"
            className="rounded-md shadow-md bg-white/90 backdrop-blur border-slate-300"
            onClick={() => setMobileOpen(true)}
          >
            <Menu className="h-5 w-5" />
          </Button>
        </SheetTrigger>
        <SheetContent
          side="left"
          className="w-75 sm:w-80 p-0 flex flex-col h-screen max-h-screen rounded-none sm:rounded-r-xl overflow-hidden bg-white shadow-xl"
        >
          {/* Header */}
          <SheetHeader className="border-b p-4 shrink-0 bg-white sticky top-0 z-10">
            <SheetTitle>
              <div className="text-left">
                <div className="text-lg font-semibold truncate">Giang Châu</div>
                <div className="text-xs text-slate-500 font-normal truncate">
                  Quản lý nhân sự, ca làm và chấm công
                </div>
              </div>
            </SheetTitle>
            <div className="absolute right-3 top-3">
              <Button
                variant="ghost"
                size="icon"
                className="rounded-md"
                aria-label="Đóng menu"
                onClick={() => setMobileOpen(false)}
              >
                <X className="h-5 w-5" />
              </Button>
            </div>
          </SheetHeader>

          {/* Navigation - Scrollable */}
          <nav className="flex-1 overflow-y-auto px-4 pb-4 pt-2">
            <div className="space-y-1">
              {primaryItems.map((it) => {
                const active = pathname === it.href || pathname.startsWith(`${it.href}/`);
                const Icon = it.icon;
                return (
                  <Link
                    key={it.key}
                    href={it.href}
                    onClick={() => setMobileOpen(false)}
                    className={cn(
                      "flex items-center gap-3 px-3 py-2.5 text-sm rounded-md transition-colors",
                      active
                        ? "bg-emerald-50 text-emerald-700 font-medium"
                        : "text-slate-700 hover:bg-slate-100"
                    )}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    <span className="truncate">{it.label}</span>
                  </Link>
                );
              })}

              {hrItems.length > 0 && (
                <div className="mt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setOpenHr((v) => !v);
                      setOpenPersonal(false);
                    }}
                    className="flex w-full items-center justify-between px-3 py-2.5 text-sm font-medium text-slate-700 rounded-md hover:bg-slate-100 transition-colors"
                  >
                    <span className="inline-flex items-center gap-3 min-w-0">
                      <Users className="h-4 w-4 shrink-0" />
                      <span className="truncate">Nhân viên</span>
                    </span>
                    <ChevronDown
                      className={cn("h-4 w-4 transition-transform shrink-0", openHr && "rotate-180")}
                    />
                  </button>
                  <div
                    className={cn(
                      "overflow-hidden transition-[max-height,opacity] duration-200",
                      openHr ? "max-h-96 opacity-100" : "max-h-0 opacity-0"
                    )}
                  >
                    <div className="space-y-1 mt-1 ml-2">
                      {hrItems.map((it) => {
                        const active = pathname === it.href || pathname.startsWith(`${it.href}/`);
                        const Icon = it.icon;
                        return (
                          <Link
                            key={it.key}
                            href={it.href}
                            onClick={() => setMobileOpen(false)}
                            className={cn(
                              "flex items-center gap-3 px-3 py-2.5 text-sm rounded-md transition-colors",
                              active
                                ? "bg-emerald-50 text-emerald-700 font-medium"
                                : "text-slate-700 hover:bg-slate-100"
                            )}
                          >
                            <Icon className="h-4 w-4 shrink-0" />
                            <span className="truncate">{it.label}</span>
                          </Link>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}

              {!isEmployee && (
                <div className="mt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setOpenPersonal((v) => !v);
                      setOpenHr(false);
                    }}
                    className="flex w-full items-center justify-between px-3 py-2.5 text-sm font-medium text-slate-700 rounded-md hover:bg-slate-100 transition-colors"
                  >
                    <span className="inline-flex items-center gap-3 min-w-0">
                      <UserCircle className="h-4 w-4 shrink-0" />
                      <span className="truncate">Cá nhân</span>
                    </span>
                    <ChevronDown
                      className={cn("h-4 w-4 transition-transform shrink-0", openPersonal && "rotate-180")}
                    />
                  </button>
                  <div
                    className={cn(
                      "overflow-hidden transition-[max-height,opacity] duration-200",
                      openPersonal ? "max-h-96 opacity-100" : "max-h-0 opacity-0"
                    )}
                  >
                    <div className="space-y-1 mt-1 ml-2">
                      {personalItems.map((it) => {
                        const active = pathname === it.href || pathname.startsWith(`${it.href}/`);
                        const Icon = it.icon;
                        return (
                          <Link
                            key={it.key}
                            href={it.href}
                            onClick={() => setMobileOpen(false)}
                            className={cn(
                              "flex items-center gap-3 px-3 py-2.5 text-sm rounded-md transition-colors",
                              active
                                ? "bg-emerald-50 text-emerald-700 font-medium"
                                : "text-slate-700 hover:bg-slate-100"
                            )}
                          >
                            <Icon className="h-4 w-4 shrink-0" />
                            <span className="truncate">{it.label}</span>
                          </Link>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </nav>

          {/* Logout button - RED */}
          <div className="border-t p-4 shrink-0">
            <Button
              variant="ghost"
              className="w-full justify-start gap-3 rounded-md text-sm font-medium text-red-600 hover:bg-red-50 hover:text-red-700 transition-colors"
              onClick={handleLogout}
              disabled={loading}
            >
              <LogOut className="h-4 w-4 shrink-0" />
              <span className="truncate">Đăng xuất</span>
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );

  return (
    <>
      {DesktopNav}
      {MobileNav}
    </>
  );
}
