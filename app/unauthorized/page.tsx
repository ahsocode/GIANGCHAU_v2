import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function UnauthorizedPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 text-slate-900">
      <div className="flex max-w-md flex-col gap-3 text-center">
        <div className="text-2xl font-semibold">Trang không tồn tại</div>
        <p className="text-sm text-slate-600">Liên kết bạn truy cập không tồn tại.</p>
        <Button asChild className="mt-2 rounded-none bg-emerald-500 text-white hover:bg-emerald-600">
          <Link href="/lich-lam">Quay về lịch làm</Link>
        </Button>
      </div>
    </div>
  );
}
