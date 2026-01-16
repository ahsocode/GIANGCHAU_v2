import type { ReactNode } from "react";
import LichLamTabs from "./ui/lich-lam-tabs";

export default function LichLamLayout({ children }: { children: ReactNode }) {
  return (
    <div className="space-y-4">
      <LichLamTabs />
      {children}
    </div>
  );
}
