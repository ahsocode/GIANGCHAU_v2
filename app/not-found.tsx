export default function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 text-slate-900">
      <div className="flex max-w-md flex-col gap-3 text-center">
        <div className="text-4xl font-bold">404</div>
        <div className="text-lg font-semibold">Không tìm thấy trang</div>
        <p className="text-sm text-slate-600">
          Đường dẫn không tồn tại hoặc bạn không có quyền truy cập. Vui lòng kiểm tra lại URL.
        </p>
      </div>
    </div>
  );
}
