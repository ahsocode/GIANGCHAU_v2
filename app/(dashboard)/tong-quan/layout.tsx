import type { ReactNode } from "react";
import TongQuanTabs from "./ui/tong-quan-tabs";

export default function TongQuanLayout({ children }: { children: ReactNode }) {
  return (
    <div className="space-y-4">
      <TongQuanTabs />
      {children}
    </div>
  );
}
