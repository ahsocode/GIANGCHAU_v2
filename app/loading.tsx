export default function Loading() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 text-slate-900">
      <div className="flex flex-col items-center gap-4">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-slate-300 border-t-emerald-500" />
        <div className="text-sm font-medium text-slate-600">Đang tải dữ liệu...</div>
      </div>
    </div>
  );
}
