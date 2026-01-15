import type { ReactNode } from "react";
import TaiKhoanTabs from "./ui/tai-khoan-tabs";

export default function TaiKhoanLayout({ children }: { children: ReactNode }) {
  return (
    <div className="space-y-4">
      <TaiKhoanTabs />
      {children}
    </div>
  );
}
