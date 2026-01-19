import type { ReactNode } from "react";
import HolidayTabs from "./ui/holiday-tabs";

export default function NgayNghiLayout({ children }: { children: ReactNode }) {
  return (
    <div className="space-y-4">
      <HolidayTabs />
      {children}
    </div>
  );
}
