"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const tabs = [
  { href: "/quan-li-cham-cong", label: "Dữ liệu chấm công" },
  { href: "/quan-li-cham-cong/raw-event", label: "Dữ liệu chấm công chưa qua xử lý" },
];

export default function QuanLiChamCongTabs() {
  const pathname = usePathname();

  return (
    <div className="flex flex-col gap-2 border-b border-slate-200 pb-2 sm:flex-row sm:items-center sm:gap-4">
      {tabs.map((tab) => {
        const isActive = pathname === tab.href;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={cn(
              "rounded-none border border-transparent px-3 py-2 text-sm font-medium transition",
              isActive
                ? "border-slate-300 bg-slate-100 text-slate-900"
                : "text-slate-600 hover:border-slate-200 hover:bg-slate-50"
            )}
          >
            {tab.label}
          </Link>
        );
      })}
    </div>
  );
}
