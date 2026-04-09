"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

type EmployeeOption = {
  id: string;
  code: string | null;
  fullName: string;
};

type Item = {
  id: string;
  date: string;
  employee: {
    id: string;
    code: string | null;
    fullName: string;
    isActive: boolean;
  };
  shift: {
    name: string;
    start: string;
    end: string;
  };
  attendance: {
    id: string | null;
    checkInAt: string | null;
    checkOutAt: string | null;
    status: string;
    checkInStatus: string | null;
    checkOutStatus: string | null;
    lateMinutes: number;
    earlyLeaveMinutes: number;
    overtimeMinutes: number;
    workMinutes: number;
  };
  derivedStatuses: string[];
};

type ApiResponse = {
  ok: boolean;
  items?: Item[];
  employees?: EmployeeOption[];
  total?: number;
  limited?: boolean;
};

const STATUS_OPTIONS = [
  { value: "ALL", label: "Tất cả trạng thái" },
  { value: "MISSING_CHECKIN", label: "Chưa checkin" },
  { value: "MISSING_CHECKOUT", label: "Chưa checkout" },
  { value: "OVERTIME", label: "Tăng ca" },
  { value: "PRESENT", label: "Đủ công" },
  { value: "ABSENT", label: "Vắng" },
  { value: "LATE", label: "Đi trễ" },
  { value: "EARLY_LEAVE", label: "Về sớm" },
  { value: "LATE_AND_EARLY", label: "Trễ và về sớm" },
  { value: "NON_COMPLIANT", label: "Không đảm bảo" },
  { value: "INCOMPLETE", label: "Chưa đủ" },
  { value: "NO_SHIFT", label: "Không có ca" },
];

const dateTimeFormatter = new Intl.DateTimeFormat("vi-VN", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

function toInputDateLocal(value = new Date()) {
  const year = value.getFullYear();
  const month = `${value.getMonth() + 1}`.padStart(2, "0");
  const day = `${value.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatDateTime(value: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return dateTimeFormatter.format(date);
}

function mapStatusLabel(value: string | null) {
  switch (value) {
    case "MISSING_CHECKIN":
      return "Chưa checkin";
    case "MISSING_CHECKOUT":
      return "Chưa checkout";
    case "OVERTIME":
      return "Tăng ca";
    case "PRESENT":
      return "Đủ công";
    case "ABSENT":
      return "Vắng";
    case "LATE":
      return "Đi trễ";
    case "EARLY_LEAVE":
      return "Về sớm";
    case "LATE_AND_EARLY":
      return "Trễ và về sớm";
    case "NON_COMPLIANT":
      return "Không đảm bảo";
    case "INCOMPLETE":
      return "Chưa đủ";
    case "NO_SHIFT":
      return "Không có ca";
    default:
      return value ?? "—";
  }
}

function mapCheckInOutStatus(value: string | null) {
  switch (value) {
    case "PENDING":
      return "Chờ";
    case "MISSED":
      return "Lỡ";
    case "ON_TIME":
      return "Đúng giờ";
    case "LATE":
      return "Trễ";
    case "EARLY":
      return "Sớm";
    case "OVERTIME":
      return "Tăng ca";
    default:
      return value ?? "—";
  }
}

export default function AttendanceListClient() {
  const today = useMemo(() => toInputDateLocal(new Date()), []);
  const monthStart = useMemo(() => {
    const now = new Date();
    return toInputDateLocal(new Date(now.getFullYear(), now.getMonth(), 1));
  }, []);

  const [items, setItems] = useState<Item[]>([]);
  const [employees, setEmployees] = useState<EmployeeOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [from, setFrom] = useState(monthStart);
  const [to, setTo] = useState(today);
  const [q, setQ] = useState("");
  const [employeeId, setEmployeeId] = useState("ALL");
  const [status, setStatus] = useState("ALL");
  const [limited, setLimited] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (from) params.set("from", from);
      if (to) params.set("to", to);
      if (q.trim()) params.set("q", q.trim());
      if (employeeId !== "ALL") params.set("employeeId", employeeId);
      if (status !== "ALL") params.set("status", status);
      params.set("take", "3000");

      const res = await fetch(`/api/quan-li-cham-cong/danh-sach?${params.toString()}`);
      if (!res.ok) {
        const payload = (await res.json().catch(() => null)) as { error?: string; message?: string } | null;
        throw new Error(payload?.error ?? payload?.message ?? `Không tải được danh sách (HTTP ${res.status}).`);
      }
      const data = (await res.json()) as ApiResponse;
      setItems(data.items ?? []);
      setEmployees(data.employees ?? []);
      setLimited(data.limited === true);
    } catch (error) {
      console.error(error);
      toast.error(error instanceof Error ? error.message : "Không tải được danh sách chấm công.");
    } finally {
      setLoading(false);
    }
  }, [employeeId, from, q, status, to]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg sm:text-xl font-semibold">Danh sách chấm công</h1>
        <p className="text-sm text-muted-foreground">
          Toàn bộ ca làm theo bộ lọc, kèm trạng thái checkin, checkout và tăng ca.
        </p>
      </div>

      <div className="rounded-lg border bg-white p-4">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-5">
          <div className="space-y-1">
            <label className="text-sm text-slate-600">Từ ngày</label>
            <Input type="date" value={from} onChange={(event) => setFrom(event.target.value)} />
          </div>
          <div className="space-y-1">
            <label className="text-sm text-slate-600">Đến ngày</label>
            <Input type="date" value={to} onChange={(event) => setTo(event.target.value)} />
          </div>
          <div className="space-y-1">
            <label className="text-sm text-slate-600">Nhân viên</label>
            <select
              className="h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs"
              value={employeeId}
              onChange={(event) => setEmployeeId(event.target.value)}
            >
              <option value="ALL">Tất cả nhân viên</option>
              {employees.map((employee) => (
                <option key={employee.id} value={employee.id}>
                  {employee.fullName}
                  {employee.code ? ` (${employee.code})` : ""}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-sm text-slate-600">Trạng thái</label>
            <select
              className="h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs"
              value={status}
              onChange={(event) => setStatus(event.target.value)}
            >
              {STATUS_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-sm text-slate-600">Tìm nhanh</label>
            <Input
              value={q}
              onChange={(event) => setQ(event.target.value)}
              placeholder="Mã hoặc tên nhân viên"
            />
          </div>
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          <Button onClick={fetchData} disabled={loading}>
            {loading ? "Đang tải..." : "Lọc dữ liệu"}
          </Button>
          <Button
            variant="outline"
            type="button"
            onClick={() => {
              setFrom(monthStart);
              setTo(today);
              setQ("");
              setEmployeeId("ALL");
              setStatus("ALL");
            }}
          >
            Đặt lại
          </Button>
        </div>
      </div>

      <div className="rounded-lg border bg-white">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-100">
                <TableHead className="w-14 text-center">STT</TableHead>
                <TableHead className="min-w-28 text-center">Ngày</TableHead>
                <TableHead className="min-w-52 text-center">Nhân viên</TableHead>
                <TableHead className="min-w-48 text-center">Ca làm</TableHead>
                <TableHead className="min-w-44 text-center">Checkin</TableHead>
                <TableHead className="min-w-44 text-center">Checkout</TableHead>
                <TableHead className="min-w-36 text-center">Trạng thái</TableHead>
                <TableHead className="min-w-40 text-center">Thông số</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={8} className="py-10 text-center text-sm text-muted-foreground">
                    Đang tải dữ liệu...
                  </TableCell>
                </TableRow>
              ) : items.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="py-10 text-center text-sm text-muted-foreground">
                    Không có dữ liệu phù hợp.
                  </TableCell>
                </TableRow>
              ) : (
                items.map((item, index) => (
                  <TableRow key={item.id}>
                    <TableCell className="text-center text-sm text-slate-500">{index + 1}</TableCell>
                    <TableCell className="text-center">{item.date}</TableCell>
                    <TableCell>
                      <div className="text-sm font-medium text-slate-900">{item.employee.fullName}</div>
                      <div className="text-xs text-slate-500">{item.employee.code ?? "—"}</div>
                    </TableCell>
                    <TableCell className="text-sm text-center">
                      <div className="font-medium text-slate-900">{item.shift.name}</div>
                      <div className="text-xs text-slate-500">
                        {item.shift.start} - {item.shift.end}
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="text-sm">{formatDateTime(item.attendance.checkInAt)}</div>
                      <div className="text-xs text-slate-500">{mapCheckInOutStatus(item.attendance.checkInStatus)}</div>
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="text-sm">{formatDateTime(item.attendance.checkOutAt)}</div>
                      <div className="text-xs text-slate-500">{mapCheckInOutStatus(item.attendance.checkOutStatus)}</div>
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="inline-flex items-center rounded bg-slate-100 px-2 py-1 text-xs font-medium text-slate-700">
                        {mapStatusLabel(item.attendance.status)}
                      </div>
                      {item.derivedStatuses.length > 0 && (
                        <div className="mt-1 flex flex-wrap items-center justify-center gap-1">
                          {item.derivedStatuses.map((derived) => (
                            <span
                              key={derived}
                              className="inline-flex items-center rounded bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-700"
                            >
                              {mapStatusLabel(derived)}
                            </span>
                          ))}
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="text-xs text-slate-600">
                      <div>Trễ: {item.attendance.lateMinutes} phút</div>
                      <div>Về sớm: {item.attendance.earlyLeaveMinutes} phút</div>
                      <div>Tăng ca: {item.attendance.overtimeMinutes} phút</div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
        <div className="flex items-center justify-between border-t px-4 py-3 text-xs text-slate-500">
          <span>Tổng dòng: {items.length}</span>
          {limited && <span>Đang giới hạn kết quả để tối ưu hiệu năng, hãy thu hẹp bộ lọc.</span>}
        </div>
      </div>
    </div>
  );
}
