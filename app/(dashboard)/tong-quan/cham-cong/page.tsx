"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type StatusBucket = { status: string; count: number };
type DailyBucket = {
  date: string;
  present: number;
  absent: number;
  late: number;
  nonCompliant: number;
  overtime: number;
  incomplete: number;
};

type AttendanceSummary = {
  monthRange: { from: string; to: string };
  totalRecords: number;
  statusBuckets: StatusBucket[];
  dailyBuckets: DailyBucket[];
};

function mapStatusLabel(value: string) {
  switch (value) {
    case "PRESENT":
      return "Chuẩn";
    case "ABSENT":
      return "Vắng";
    case "LATE":
      return "Trễ giờ";
    case "EARLY_LEAVE":
      return "Về sớm";
    case "LATE_AND_EARLY":
      return "Trễ & về sớm";
    case "OVERTIME":
      return "Tăng ca";
    case "NON_COMPLIANT":
      return "Không đảm bảo";
    case "INCOMPLETE":
      return "Chưa đủ";
    case "NO_SHIFT":
      return "Không có ca";
    default:
      return value;
  }
}

export default function TongQuanChamCongPage() {
  const [data, setData] = useState<AttendanceSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const todayValue = useMemo(() => {
    const now = new Date();
    const year = now.getFullYear();
    const month = `${now.getMonth() + 1}`.padStart(2, "0");
    const day = `${now.getDate()}`.padStart(2, "0");
    return `${year}-${month}-${day}`;
  }, []);
  const [filterMode, setFilterMode] = useState<"range" | "day">("day");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [singleDate, setSingleDate] = useState(todayValue);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        if (filterMode === "day" && singleDate) {
          params.set("date", singleDate);
        } else if (filterMode === "range" && fromDate && toDate) {
          params.set("from", fromDate);
          params.set("to", toDate);
        }
        const res = await fetch(`/api/tong-quan/cham-cong?${params.toString()}`);
        if (!res.ok) throw new Error("Không tải được dữ liệu chấm công");
        const json = (await res.json()) as AttendanceSummary;
        setData(json);
      } catch (error) {
        console.error(error);
        toast.error("Không tải được dữ liệu chấm công");
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [filterMode, fromDate, toDate, singleDate]);

  const total = data?.totalRecords ?? 0;
  const statusTotal = useMemo(
    () => (data?.statusBuckets ?? []).reduce((sum, item) => sum + item.count, 0),
    [data]
  );
  const maxDaily = useMemo(
    () =>
      Math.max(
        1,
        ...(data?.dailyBuckets ?? []).map((item) => item.present + item.absent + item.late + item.nonCompliant)
      ),
    [data]
  );

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold">Tổng quan chấm công</h2>
        <p className="text-sm text-muted-foreground">
          Thống kê chấm công từ {data?.monthRange?.from ?? "—"} đến {data?.monthRange?.to ?? "—"}.
        </p>
      </div>

      <div className="flex flex-col gap-3 rounded-none border border-slate-200 bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2 text-sm text-slate-600">
          <span className="text-slate-500">Chế độ:</span>
          <button
            type="button"
            onClick={() => setFilterMode("range")}
            className={`rounded-none border px-3 py-1 text-sm ${
              filterMode === "range"
                ? "border-emerald-300 bg-emerald-50 text-emerald-700"
                : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
            }`}
          >
            Khoảng ngày
          </button>
          <button
            type="button"
            onClick={() => setFilterMode("day")}
            className={`rounded-none border px-3 py-1 text-sm ${
              filterMode === "day"
                ? "border-emerald-300 bg-emerald-50 text-emerald-700"
                : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
            }`}
          >
            Theo ngày
          </button>
        </div>
        {filterMode === "range" ? (
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <Input
              type="date"
              value={fromDate}
              onChange={(event) => setFromDate(event.target.value)}
              className="rounded-none"
            />
            <span className="text-sm text-slate-500">đến</span>
            <Input
              type="date"
              value={toDate}
              onChange={(event) => setToDate(event.target.value)}
              className="rounded-none"
            />
            <Button
              type="button"
              variant="outline"
              className="rounded-none"
              onClick={() => {
                setFromDate("");
                setToDate("");
              }}
            >
              Bỏ lọc
            </Button>
          </div>
        ) : (
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <Input
              type="date"
              value={singleDate}
              onChange={(event) => setSingleDate(event.target.value)}
              className="rounded-none"
            />
            <Button
              type="button"
              variant="outline"
              className="rounded-none"
              onClick={() => setSingleDate("")}
            >
              Bỏ lọc
            </Button>
          </div>
        )}
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-none border border-slate-200 bg-white p-4">
          <div className="text-sm text-slate-500">Tổng lượt chấm công</div>
          <div className="text-2xl font-semibold text-slate-900">{total}</div>
        </div>
        <div className="rounded-none border border-slate-200 bg-white p-4">
          <div className="text-sm text-slate-500">Vắng</div>
          <div className="text-2xl font-semibold text-slate-900">
            {(data?.statusBuckets ?? []).find((item) => item.status === "ABSENT")?.count ?? 0}
          </div>
        </div>
        <div className="rounded-none border border-slate-200 bg-white p-4">
          <div className="text-sm text-slate-500">Trễ giờ</div>
          <div className="text-2xl font-semibold text-slate-900">
            {(data?.statusBuckets ?? []).find((item) => item.status === "LATE")?.count ?? 0}
          </div>
        </div>
        <div className="rounded-none border border-slate-200 bg-white p-4">
          <div className="text-sm text-slate-500">Không đảm bảo</div>
          <div className="text-2xl font-semibold text-slate-900">
            {(data?.statusBuckets ?? []).find((item) => item.status === "NON_COMPLIANT")?.count ?? 0}
          </div>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-none border border-slate-200 bg-white p-4 space-y-3">
          <div className="text-sm text-slate-500">Tỉ lệ trạng thái chấm công</div>
          <div className="space-y-2">
            {(data?.statusBuckets ?? []).map((item) => {
              const percent = statusTotal ? Math.round((item.count / statusTotal) * 100) : 0;
              return (
                <div key={item.status} className="space-y-1">
                  <div className="flex items-center justify-between text-xs text-slate-600">
                    <span>{mapStatusLabel(item.status)}</span>
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
            {(data?.statusBuckets ?? []).length === 0 && !loading && (
              <div className="text-sm text-slate-500">Chưa có dữ liệu</div>
            )}
          </div>
        </div>

        <div className="rounded-none border border-slate-200 bg-white p-4 space-y-3">
          <div className="text-sm text-slate-500">Xu hướng 7 ngày gần nhất</div>
          <div className="flex items-end gap-3 overflow-x-auto pb-1">
            {(data?.dailyBuckets ?? []).map((bucket) => {
              const totalDay = bucket.present + bucket.absent + bucket.late + bucket.nonCompliant + bucket.overtime;
              const height = Math.max(8, (totalDay / maxDaily) * 120);
              return (
                <div key={bucket.date} className="flex min-w-[48px] flex-1 flex-col items-center gap-2">
                  <div
                    className="w-full rounded-none bg-blue-500/80"
                    style={{ height: `${height}px` }}
                    title={`Tổng ${totalDay} lượt`}
                  />
                  <div className="text-xs text-slate-500">{bucket.date.slice(5)}</div>
                </div>
              );
            })}
          </div>
          <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500">
            <span>Tính theo tổng lượt chấm công mỗi ngày.</span>
            {loading && <span>Đang tải…</span>}
          </div>
        </div>
      </div>
    </div>
  );
}
