import Link from "next/link";
import { Button } from "@/components/ui/button";
import { NhanVienCrud } from "./ui/nhan-vien-crud";

export default function NhanVienPage() {
  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold">Danh sách nhân viên</h2>
          <p className="text-sm text-muted-foreground">Tạo / sửa / xoá nhân viên và gán bộ phận, chức vụ.</p>
        </div>
        <Button
          asChild
          className="rounded-none border-none bg-emerald-500 text-white shadow-sm transition hover:bg-emerald-600"
        >
          <Link href="/nhan-vien/tai-len">Tải lên danh sách</Link>
        </Button>
      </div>

      <NhanVienCrud />
    </div>
  );
}
