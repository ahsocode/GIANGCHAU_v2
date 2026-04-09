"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const tabs = [
  { href: "/quan-li-cham-cong", label: "D\u1eef li\u1ec7u ch\u1ea5m c\u00f4ng" },
  { href: "/quan-li-cham-cong/danh-sach", label: "Danh s\u00e1ch ch\u1ea5m c\u00f4ng" },
  { href: "/quan-li-cham-cong/raw-event", label: "D\u1eef li\u1ec7u ch\u1ea5m c\u00f4ng ch\u01b0a qua x\u1eed l\u00fd" },
  { href: "/quan-li-cham-cong/device-users", label: "Nh\u00e2n vi\u00ean trong m\u00e1y ch\u1ea5m c\u00f4ng" },
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
