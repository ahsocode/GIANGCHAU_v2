import type { LucideIcon } from "lucide-react";
import {
  Building2,
  BriefcaseBusiness,
  CalendarRange,
  CalendarDays,
  LayoutDashboard,
  Users,
  UserRound,
  MessageSquare,
} from "lucide-react";

export type RoleKey = "ADMIN" | "DIRECTOR" | "STAFF" | "EMPLOYEE";

export type MenuItem = {
  key: string;
  label: string;
  href: string;
  icon: LucideIcon;
};

const base: MenuItem[] = [
  { key: "tong-quan", label: "Tổng quan", href: "/tong-quan", icon: LayoutDashboard },
  { key: "ca-lam", label: "Ca làm", href: "/ca-lam", icon: CalendarRange },
  { key: "ngay-nghi", label: "Ngày nghỉ", href: "/ngay-nghi/loai", icon: CalendarDays },
  { key: "xu-ly-yeu-cau", label: "Xử lý yêu cầu", href: "/xu-ly-yeu-cau", icon: MessageSquare },
];

const nhanSu: MenuItem[] = [
  { key: "bo-phan", label: "Bộ phận", href: "/bo-phan", icon: Building2 },
  { key: "chuc-vu", label: "Chức vụ", href: "/chuc-vu", icon: BriefcaseBusiness },
  { key: "nhan-vien", label: "Danh sách nhân viên", href: "/nhan-vien", icon: Users },
  { key: "tai-khoan", label: "Danh sách tài khoản", href: "/tai-khoan", icon: UserRound },
];

export function getMenuByRole(role: RoleKey): MenuItem[] {
  if (role === "ADMIN") return [...base, ...nhanSu];
  if (role === "DIRECTOR") return [...base, ...nhanSu];
  if (role === "STAFF") return [...base, ...nhanSu];
  // Nhân viên chỉ xem cụm cá nhân, không hiển thị menu chung
  return [];
}
