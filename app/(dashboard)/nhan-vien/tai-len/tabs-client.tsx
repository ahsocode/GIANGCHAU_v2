"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import UploadClient from "./upload-client";
import HistoryClient from "./history-client";

const tabs = [
  { key: "upload", label: "Tải lên" },
  { key: "history", label: "Lịch sử tải lên" },
];

export default function TaiLenTabs() {
  const [active, setActive] = useState<"upload" | "history">("upload");

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 border-b border-slate-200 pb-2 sm:flex-row sm:items-center sm:gap-4">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setActive(tab.key as "upload" | "history")}
            className={cn(
              "rounded-none border border-transparent px-3 py-2 text-sm font-medium transition",
              active === tab.key
                ? "border-slate-300 bg-slate-100 text-slate-900"
                : "text-slate-600 hover:border-slate-200 hover:bg-slate-50"
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {active === "upload" ? <UploadClient /> : <HistoryClient />}
    </div>
  );
}
