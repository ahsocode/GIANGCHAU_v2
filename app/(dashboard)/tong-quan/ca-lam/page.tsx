"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

type ShiftStat = {
  id: string;
  code: string;
  name: string;
  startTime: string;
  endTime: string;
  status: "ACTIVE" | "ARCHIVED";
  employeeCount: number;
};

type RatioItem = { key: string; label: string; count: number };

type ShiftSummary = {
  totalShifts: number;
  totalActiveEmployees: number;
  totalAssigned: number;
  totalUnassigned: number;
  shifts: ShiftStat[];
  ratio: RatioItem[];
  monthRange: { from: string; to: string };
};

export default function TongQuanCaLamPage() {
  const [data, setData] = useState<ShiftSummary | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const res = await fetch("/api/tong-quan/ca-lam");
        if (!res.ok) throw new Error("Không tải được dữ liệu ca làm");
        const json = (await res.json()) as ShiftSummary;
        setData(json);
      } catch (error) {
        console.error(error);
        toast.error("Không tải được dữ liệu ca làm");
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const ratioTotal = useMemo(
    () => (data?.ratio ?? []).reduce((sum, item) => sum + item.count, 0),
    [data]
  );

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold">Tổng quan ca làm</h2>
        <p className="text-sm text-muted-foreground">
          Thống kê ca làm trong tháng {data?.monthRange?.from ?? "—"} đến {data?.monthRange?.to ?? "—"}.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-none border border-slate-200 bg-white p-4">
          <div className="text-sm text-slate-500">Tổng số ca làm</div>
          <div className="text-2xl font-semibold text-slate-900">{data?.totalShifts ?? 0}</div>
        </div>
        <div className="rounded-none border border-slate-200 bg-white p-4">
          <div className="text-sm text-slate-500">Nhân viên đang làm</div>
          <div className="text-2xl font-semibold text-slate-900">{data?.totalActiveEmployees ?? 0}</div>
        </div>
        <div className="rounded-none border border-slate-200 bg-white p-4">
          <div className="text-sm text-slate-500">Nhân viên đã có ca</div>
          <div className="text-2xl font-semibold text-slate-900">{data?.totalAssigned ?? 0}</div>
        </div>
        <div className="rounded-none border border-slate-200 bg-white p-4">
          <div className="text-sm text-slate-500">Nhân viên chưa có ca</div>
          <div className="text-2xl font-semibold text-slate-900">{data?.totalUnassigned ?? 0}</div>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-none border border-slate-200 bg-white p-4 space-y-3">
          <div className="text-sm text-slate-500">Tỉ lệ nhân viên theo ca</div>
          <div className="space-y-2">
            {(data?.ratio ?? []).map((item) => {
              const percent = ratioTotal ? Math.round((item.count / ratioTotal) * 100) : 0;
              return (
                <div key={item.key} className="space-y-1">
                  <div className="flex items-center justify-between text-xs text-slate-600">
                    <span>{item.label}</span>
                    <span className="font-semibold text-slate-900">
                      {item.count} ({percent}%)
                    </span>
                  </div>
                  <div className="h-2 w-full rounded-none bg-slate-100">
                    <div className="h-full rounded-none bg-emerald-500" style={{ width: `${percent}%` }} />
                  </div>
                </div>
              );
            })}
            {(data?.ratio ?? []).length === 0 && !loading && (
              <div className="text-sm text-slate-500">Chưa có dữ liệu</div>
            )}
          </div>
        </div>

        <div className="rounded-none border border-slate-200 bg-white p-4 space-y-3">
          <div className="text-sm text-slate-500">Chi tiết ca làm</div>
          <div className="space-y-2">
            {(data?.shifts ?? []).map((shift) => (
              <div
                key={shift.id}
                className="flex flex-col gap-2 rounded-none border border-slate-200 px-3 py-2 text-sm sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <div className="font-semibold text-slate-900">
                    {shift.code} - {shift.name}
                  </div>
                  <div className="text-xs text-slate-500">
                    {shift.startTime} - {shift.endTime}
                  </div>
                </div>
                <div className="flex items-center gap-4 text-xs text-slate-600">
                  <span>
                    Nhân viên: <span className="font-semibold text-slate-900">{shift.employeeCount}</span>
                  </span>
                  <span
                    className={`rounded-full border px-2 py-0.5 text-[11px] font-medium ${
                      shift.status === "ACTIVE"
                        ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                        : "border-slate-200 bg-slate-100 text-slate-500"
                    }`}
                  >
                    {shift.status === "ACTIVE" ? "Đang áp dụng" : "Ngừng áp dụng"}
                  </span>
                </div>
              </div>
            ))}
            {(data?.shifts ?? []).length === 0 && !loading && (
              <div className="text-sm text-slate-500">Chưa có ca làm</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
