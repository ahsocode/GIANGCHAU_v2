export default function UnauthorizedPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 text-slate-900">
      <div className="flex max-w-md flex-col gap-3 text-center">
        <div className="text-2xl font-semibold">Không có quyền truy cập</div>
        <p className="text-sm text-slate-600">
          Bạn không có quyền xem nội dung này. Vui lòng đăng nhập bằng tài khoản phù hợp hoặc liên hệ quản
          trị viên.
        </p>
      </div>
    </div>
  );
}
