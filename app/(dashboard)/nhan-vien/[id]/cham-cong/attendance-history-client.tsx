"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

type EmployeeInfo = {
  id: string;
  fullName: string;
  code: string;
};

type AttendanceItem = {
  id: string;
  date: string;
  checkInAt: string | null;
  checkOutAt: string | null;
  status: string | null;
  lateMinutes: number;
  earlyLeaveMinutes: number;
  overtimeMinutes: number;
  workMinutes: number;
  checkInStatus: string | null;
  checkOutStatus: string | null;
  plannedName: string | null;
  plannedStart: string | null;
  plannedEnd: string | null;
};

type Summary = {
  totalDays: number;
  checkedInDays: number;
  checkedOutDays: number;
  totalLateMinutes: number;
  totalEarlyLeaveMinutes: number;
  totalOvertimeMinutes: number;
  totalWorkMinutes: number;
  statusCounts: Record<string, number>;
};

type ApiResponse = {
  employee: EmployeeInfo;
  range: {
    from: string;
    to: string;
  };
  summary: Summary;
  items: AttendanceItem[];
};

type Props = {
  employee: EmployeeInfo;
};

const dateFormatter = new Intl.DateTimeFormat("vi-VN", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

const dateTimeFormatter = new Intl.DateTimeFormat("vi-VN", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

function getCurrentMonthInputValue() {
  const now = new Date();
  const month = `${now.getMonth() + 1}`.padStart(2, "0");
  return `${now.getFullYear()}-${month}`;
}

function getMonthDateRange(monthValue: string) {
  const [yearValue, monthValueRaw] = monthValue.split("-").map(Number);
  if (!yearValue || !monthValueRaw) return null;
  const firstDay = new Date(yearValue, monthValueRaw - 1, 1);
  const lastDay = new Date(yearValue, monthValueRaw, 0);
  const from = `${firstDay.getFullYear()}-${`${firstDay.getMonth() + 1}`.padStart(2, "0")}-${`${firstDay.getDate()}`.padStart(2, "0")}`;
  const to = `${lastDay.getFullYear()}-${`${lastDay.getMonth() + 1}`.padStart(2, "0")}-${`${lastDay.getDate()}`.padStart(2, "0")}`;
  return { from, to };
}

function formatDate(value: string) {
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return dateFormatter.format(date);
}

function formatDateTime(value: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return dateTimeFormatter.format(date);
}

function formatMinutesToHourMinute(totalMinutes: number) {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${hours}h ${minutes}p`;
}

function mapStatusLabel(value: string | null) {
  switch (value) {
    case "PRESENT":
      return "Du cong";
    case "ABSENT":
      return "Vang";
    case "LATE":
      return "Di tre";
    case "EARLY_LEAVE":
      return "Ve som";
    case "LATE_AND_EARLY":
      return "Tre va ve som";
    case "OVERTIME":
      return "Tang ca";
    case "NON_COMPLIANT":
      return "Khong dam bao";
    case "INCOMPLETE":
      return "Chua du";
    case "NO_SHIFT":
      return "Khong co ca";
    default:
      return value ?? "—";
  }
}

function mapCheckStatusLabel(value: string | null) {
  switch (value) {
    case "PENDING":
      return "Cho";
    case "MISSED":
      return "Lo";
    case "ON_TIME":
      return "Dung gio";
    case "LATE":
      return "Tre";
    case "EARLY":
      return "Som";
    case "OVERTIME":
      return "Tang ca";
    default:
      return value ?? "—";
  }
}

function csvEscape(value: string | number | null | undefined) {
  const text = value === null || value === undefined ? "" : String(value);
  if (text.includes(",") || text.includes('"') || text.includes("\n")) {
    return `"${text.replaceAll('"', '""')}"`;
  }
  return text;
}

export default function EmployeeAttendanceHistoryClient({ employee }: Props) {
  const [month, setMonth] = useState(getCurrentMonthInputValue);
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<AttendanceItem[]>([]);
  const [summary, setSummary] = useState<Summary>({
    totalDays: 0,
    checkedInDays: 0,
    checkedOutDays: 0,
    totalLateMinutes: 0,
    totalEarlyLeaveMinutes: 0,
    totalOvertimeMinutes: 0,
    totalWorkMinutes: 0,
    statusCounts: {},
  });
  const [range, setRange] = useState<{ from: string; to: string } | null>(null);

  const fetchData = useCallback(async () => {
    const monthRange = getMonthDateRange(month);
    if (!monthRange) {
      toast.error("Thang khong hop le.");
      return;
    }

    setLoading(true);
    try {
      const params = new URLSearchParams({
        from: monthRange.from,
        to: monthRange.to,
      });
      const res = await fetch(`/api/nhan-vien/${employee.id}/cham-cong/lich-su?${params.toString()}`);
      if (!res.ok) {
        const payload = (await res.json().catch(() => null)) as { message?: string } | null;
        throw new Error(payload?.message ?? "Khong tai duoc lich su cham cong.");
      }

      const data = (await res.json()) as ApiResponse;
      setItems(data.items ?? []);
      setSummary(data.summary);
      setRange(data.range);
    } catch (error) {
      console.error(error);
      toast.error(error instanceof Error ? error.message : "Khong tai duoc lich su cham cong.");
    } finally {
      setLoading(false);
    }
  }, [employee.id, month]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const statusSummaryRows = useMemo(
    () =>
      Object.entries(summary.statusCounts)
        .sort((a, b) => b[1] - a[1])
        .map(([status, count]) => ({
          status,
          label: mapStatusLabel(status),
          count,
        })),
    [summary.statusCounts]
  );

  function handleExportCsv() {
    if (items.length === 0) {
      toast.error("Khong co du lieu de xuat CSV.");
      return;
    }

    const headers = [
      "Ngay",
      "Ca lam",
      "Gio ca",
      "Check-in",
      "Trang thai check-in",
      "Check-out",
      "Trang thai check-out",
      "Trang thai ngay cong",
      "Tre (phut)",
      "Ve som (phut)",
      "Tang ca (phut)",
      "Thoi gian lam (phut)",
    ];
    const rows = items.map((item) => [
      item.date,
      item.plannedName ?? "",
      item.plannedStart && item.plannedEnd ? `${item.plannedStart} - ${item.plannedEnd}` : "",
      item.checkInAt ?? "",
      item.checkInStatus ?? "",
      item.checkOutAt ?? "",
      item.checkOutStatus ?? "",
      item.status ?? "",
      item.lateMinutes,
      item.earlyLeaveMinutes,
      item.overtimeMinutes,
      item.workMinutes,
    ]);

    const csvContent = [headers, ...rows].map((row) => row.map(csvEscape).join(",")).join("\n");
    const blob = new Blob([`\uFEFF${csvContent}`], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `cham-cong-${employee.code}-${month}.csv`;
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-4">
      <div className="rounded-lg border bg-white p-4 space-y-3">
        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1">
            <label className="text-sm text-slate-600">Thang xem du lieu</label>
            <Input type="month" value={month} onChange={(event) => setMonth(event.target.value)} className="w-56" />
          </div>
          <Button type="button" onClick={fetchData} disabled={loading}>
            {loading ? "Dang tai..." : "Xem du lieu"}
          </Button>
          <Button type="button" variant="outline" onClick={handleExportCsv} disabled={loading || items.length === 0}>
            Xuat CSV
          </Button>
        </div>
        <p className="text-xs text-slate-500">
          {range ? `Khoang du lieu: ${range.from} den ${range.to}` : "Khoang du lieu theo thang da chon."}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-lg border bg-white p-4">
          <div className="text-xs text-slate-500">Tong ngay co ban ghi</div>
          <div className="mt-1 text-xl font-semibold text-slate-900">{summary.totalDays}</div>
        </div>
        <div className="rounded-lg border bg-white p-4">
          <div className="text-xs text-slate-500">Ngay da check-in / out</div>
          <div className="mt-1 text-xl font-semibold text-slate-900">
            {summary.checkedInDays} / {summary.checkedOutDays}
          </div>
        </div>
        <div className="rounded-lg border bg-white p-4">
          <div className="text-xs text-slate-500">Tong thoi gian lam</div>
          <div className="mt-1 text-xl font-semibold text-slate-900">{formatMinutesToHourMinute(summary.totalWorkMinutes)}</div>
        </div>
        <div className="rounded-lg border bg-white p-4">
          <div className="text-xs text-slate-500">Tong tre / ve som / tang ca</div>
          <div className="mt-1 text-sm font-semibold text-slate-900">
            {summary.totalLateMinutes}p / {summary.totalEarlyLeaveMinutes}p / {summary.totalOvertimeMinutes}p
          </div>
        </div>
      </div>

      <div className="rounded-lg border bg-white p-4">
        <h2 className="text-base font-semibold text-slate-900">Thong ke theo trang thai</h2>
        {statusSummaryRows.length === 0 ? (
          <p className="mt-2 text-sm text-slate-500">Chua co du lieu trang thai.</p>
        ) : (
          <div className="mt-3 flex flex-wrap gap-2">
            {statusSummaryRows.map((item) => (
              <span
                key={item.status}
                className="inline-flex items-center rounded-md border border-slate-200 bg-slate-50 px-3 py-1 text-xs text-slate-700"
              >
                {item.label}: {item.count}
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="rounded-lg border bg-white">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-100">
                <TableHead className="w-14 text-center">STT</TableHead>
                <TableHead className="min-w-28 text-center">Ngay</TableHead>
                <TableHead className="min-w-48 text-center">Ca lam</TableHead>
                <TableHead className="min-w-44 text-center">Check-in</TableHead>
                <TableHead className="min-w-44 text-center">Check-out</TableHead>
                <TableHead className="min-w-36 text-center">Trang thai</TableHead>
                <TableHead className="min-w-44 text-center">Thong so</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={7} className="py-10 text-center text-sm text-slate-500">
                    Dang tai du lieu...
                  </TableCell>
                </TableRow>
              ) : items.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="py-10 text-center text-sm text-slate-500">
                    Khong co du lieu trong thang da chon.
                  </TableCell>
                </TableRow>
              ) : (
                items.map((item, index) => (
                  <TableRow key={item.id}>
                    <TableCell className="text-center text-sm text-slate-500">{index + 1}</TableCell>
                    <TableCell className="text-center">{formatDate(item.date)}</TableCell>
                    <TableCell className="text-center">
                      <div className="text-sm font-medium text-slate-900">{item.plannedName ?? "—"}</div>
                      <div className="text-xs text-slate-500">
                        {item.plannedStart && item.plannedEnd ? `${item.plannedStart} - ${item.plannedEnd}` : "—"}
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="text-sm">{formatDateTime(item.checkInAt)}</div>
                      <div className="text-xs text-slate-500">{mapCheckStatusLabel(item.checkInStatus)}</div>
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="text-sm">{formatDateTime(item.checkOutAt)}</div>
                      <div className="text-xs text-slate-500">{mapCheckStatusLabel(item.checkOutStatus)}</div>
                    </TableCell>
                    <TableCell className="text-center">
                      <span className="inline-flex items-center rounded bg-slate-100 px-2 py-1 text-xs font-medium text-slate-700">
                        {mapStatusLabel(item.status)}
                      </span>
                    </TableCell>
                    <TableCell className="text-xs text-slate-600">
                      <div>Tre: {item.lateMinutes} phut</div>
                      <div>Ve som: {item.earlyLeaveMinutes} phut</div>
                      <div>Tang ca: {item.overtimeMinutes} phut</div>
                      <div>Lam viec: {item.workMinutes} phut</div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}

