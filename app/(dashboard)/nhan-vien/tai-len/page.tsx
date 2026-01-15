import Link from "next/link";
import { Button } from "@/components/ui/button";
import TaiLenTabs from "./tabs-client";

export default function NhanVienTaiLenPage() {
  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <h2 className="text-xl font-semibold">Tải lên danh sách nhân viên</h2>
          <p className="text-sm text-muted-foreground">Tải lên danh sách nhân viên từ file để tạo hàng loạt.</p>
        </div>
        <Button asChild variant="outline" className="rounded-none w-full sm:w-auto">
          <Link href="/nhan-vien">Quay lại danh sách</Link>
        </Button>
      </div>

      <TaiLenTabs />
    </div>
  );
}
