"use client";

type Props = {
  error: Error & { digest?: string };
  reset: () => void;
};

export default function GlobalError({ error, reset }: Props) {
  console.error("Global error", error);

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 text-slate-900">
      <div className="flex max-w-md flex-col gap-4 text-center">
        <div className="text-2xl font-semibold">Đã xảy ra lỗi</div>
        <p className="text-sm text-slate-600">
          Có sự cố trong quá trình xử lý. Vui lòng thử lại hoặc liên hệ quản trị viên nếu lỗi tiếp tục.
        </p>
        <button
          type="button"
          onClick={reset}
          className="mx-auto border border-slate-300 px-4 py-2 text-sm font-medium transition hover:bg-slate-100"
        >
          Thử lại
        </button>
      </div>
    </div>
  );
}
