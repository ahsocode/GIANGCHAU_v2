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
  departmentId?: string | null;
  positionId?: string | null;
};

type DepartmentOption = {
  id: string;
  code: string;
  name: string;
};

type PositionOption = {
  id: string;
  code: string;
  name: string;
};

type Item = {
  id: string;
  date: string;
  employee: {
    id: string;
    code: string | null;
    fullName: string;
    isActive: boolean;
    departmentId: string | null;
    departmentName: string | null;
    positionId: string | null;
    positionName: string | null;
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
  departments?: DepartmentOption[];
  positions?: PositionOption[];
  total?: number;
  limited?: boolean;
};

type ViewMode = "RANGE" | "MONTH" | "DAY";

const STATUS_OPTIONS = [
  { value: "ALL", label: "Tat ca trang thai" },
  { value: "MISSING_CHECKIN", label: "Chua checkin" },
  { value: "MISSING_CHECKOUT", label: "Chua checkout" },
  { value: "OVERTIME", label: "Tang ca" },
  { value: "PRESENT", label: "Du cong" },
  { value: "ABSENT", label: "Vang" },
  { value: "LATE", label: "Di tre" },
  { value: "EARLY_LEAVE", label: "Ve som" },
  { value: "LATE_AND_EARLY", label: "Tre va ve som" },
  { value: "NON_COMPLIANT", label: "Khong dam bao" },
  { value: "INCOMPLETE", label: "Chua du" },
  { value: "NO_SHIFT", label: "Khong co ca" },
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

function toInputMonthLocal(value = new Date()) {
  const year = value.getFullYear();
  const month = `${value.getMonth() + 1}`.padStart(2, "0");
  return `${year}-${month}`;
}

function getMonthRange(monthValue: string) {
  const [year, month] = monthValue.split("-").map(Number);
  if (!year || !month) return null;
  const start = new Date(year, month - 1, 1);
  const end = new Date(year, month, 0);
  return {
    from: toInputDateLocal(start),
    to: toInputDateLocal(end),
  };
}

function formatDateTime(value: string | null) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return dateTimeFormatter.format(date);
}

function mapStatusLabel(value: string | null) {
  switch (value) {
    case "MISSING_CHECKIN":
      return "Chua checkin";
    case "MISSING_CHECKOUT":
      return "Chua checkout";
    case "OVERTIME":
      return "Tang ca";
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
    case "NON_COMPLIANT":
      return "Khong dam bao";
    case "INCOMPLETE":
      return "Chua du";
    case "NO_SHIFT":
      return "Khong co ca";
    default:
      return value ?? "-";
  }
}

function mapCheckInOutStatus(value: string | null) {
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
      return value ?? "-";
  }
}

function csvEscape(value: string | number | null | undefined) {
  const text = value === null || value === undefined ? "" : String(value);
  if (text.includes(",") || text.includes('"') || text.includes("\n")) {
    return `"${text.replaceAll('"', '""')}"`;
  }
  return text;
}

export default function AttendanceListClient() {
  const today = useMemo(() => toInputDateLocal(new Date()), []);
  const monthStart = useMemo(() => {
    const now = new Date();
    return toInputDateLocal(new Date(now.getFullYear(), now.getMonth(), 1));
  }, []);
  const thisMonth = useMemo(() => toInputMonthLocal(new Date()), []);

  const [items, setItems] = useState<Item[]>([]);
  const [employees, setEmployees] = useState<EmployeeOption[]>([]);
  const [departments, setDepartments] = useState<DepartmentOption[]>([]);
  const [positions, setPositions] = useState<PositionOption[]>([]);
  const [loading, setLoading] = useState(false);

  const [viewMode, setViewMode] = useState<ViewMode>("MONTH");
  const [from, setFrom] = useState(monthStart);
  const [to, setTo] = useState(today);
  const [monthValue, setMonthValue] = useState(thisMonth);
  const [dayValue, setDayValue] = useState(today);

  const [q, setQ] = useState("");
  const [employeeId, setEmployeeId] = useState("ALL");
  const [departmentId, setDepartmentId] = useState("ALL");
  const [positionId, setPositionId] = useState("ALL");
  const [status, setStatus] = useState("ALL");
  const [limited, setLimited] = useState(false);

  const filteredEmployees = useMemo(
    () =>
      employees.filter((employee) => {
        if (departmentId !== "ALL" && employee.departmentId !== departmentId) return false;
        if (positionId !== "ALL" && employee.positionId !== positionId) return false;
        return true;
      }),
    [departmentId, employees, positionId]
  );

  const effectiveRange = useMemo(() => {
    if (viewMode === "DAY") {
      return { from: dayValue, to: dayValue };
    }
    if (viewMode === "MONTH") {
      return getMonthRange(monthValue);
    }
    return { from, to };
  }, [dayValue, from, monthValue, to, viewMode]);

  const summary = useMemo(() => {
    return items.reduce(
      (acc, item) => {
        acc.totalRows += 1;
        acc.totalLateMinutes += item.attendance.lateMinutes;
        acc.totalEarlyLeaveMinutes += item.attendance.earlyLeaveMinutes;
        acc.totalOvertimeMinutes += item.attendance.overtimeMinutes;
        acc.totalWorkMinutes += item.attendance.workMinutes;
        return acc;
      },
      {
        totalRows: 0,
        totalLateMinutes: 0,
        totalEarlyLeaveMinutes: 0,
        totalOvertimeMinutes: 0,
        totalWorkMinutes: 0,
      }
    );
  }, [items]);

  const fetchData = useCallback(async () => {
    if (!effectiveRange?.from || !effectiveRange?.to) {
      toast.error("Khoang ngay khong hop le.");
      return;
    }

    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("from", effectiveRange.from);
      params.set("to", effectiveRange.to);
      if (q.trim()) params.set("q", q.trim());
      if (employeeId !== "ALL") params.set("employeeId", employeeId);
      if (departmentId !== "ALL") params.set("departmentId", departmentId);
      if (positionId !== "ALL") params.set("positionId", positionId);
      if (status !== "ALL") params.set("status", status);
      params.set("take", "5000");

      const res = await fetch(`/api/quan-li-cham-cong/danh-sach?${params.toString()}`);
      if (!res.ok) {
        const payload = (await res.json().catch(() => null)) as { error?: string; message?: string } | null;
        throw new Error(payload?.error ?? payload?.message ?? `Khong tai duoc danh sach (HTTP ${res.status}).`);
      }

      const data = (await res.json()) as ApiResponse;
      setItems(data.items ?? []);
      setEmployees(data.employees ?? []);
      setDepartments(data.departments ?? []);
      setPositions(data.positions ?? []);
      setLimited(data.limited === true);
    } catch (error) {
      console.error(error);
      toast.error(error instanceof Error ? error.message : "Khong tai duoc danh sach cham cong.");
    } finally {
      setLoading(false);
    }
  }, [departmentId, effectiveRange, employeeId, positionId, q, status]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  function exportCsv() {
    if (items.length === 0) {
      toast.error("Khong co du lieu de xuat.");
      return;
    }

    const headers = [
      "Ngay",
      "Ma nhan vien",
      "Nhan vien",
      "Bo phan",
      "Chuc vu",
      "Ca lam",
      "Khung gio",
      "Checkin",
      "Trang thai checkin",
      "Checkout",
      "Trang thai checkout",
      "Trang thai",
      "Tre (phut)",
      "Ve som (phut)",
      "Tang ca (phut)",
      "Lam viec (phut)",
    ];

    const rows = items.map((item) => [
      item.date,
      item.employee.code ?? "",
      item.employee.fullName,
      item.employee.departmentName ?? "",
      item.employee.positionName ?? "",
      item.shift.name,
      `${item.shift.start} - ${item.shift.end}`,
      item.attendance.checkInAt ?? "",
      item.attendance.checkInStatus ?? "",
      item.attendance.checkOutAt ?? "",
      item.attendance.checkOutStatus ?? "",
      item.attendance.status,
      item.attendance.lateMinutes,
      item.attendance.earlyLeaveMinutes,
      item.attendance.overtimeMinutes,
      item.attendance.workMinutes,
    ]);

    const csv = [headers, ...rows].map((row) => row.map(csvEscape).join(",")).join("\n");
    const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);

    const tag = document.createElement("a");
    tag.href = url;
    const suffix = viewMode === "DAY" ? dayValue : viewMode === "MONTH" ? monthValue : `${from}_to_${to}`;
    tag.download = `danh-sach-cham-cong-${suffix}.csv`;
    document.body.append(tag);
    tag.click();
    tag.remove();

    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg sm:text-xl font-semibold">Danh sach cham cong</h1>
        <p className="text-sm text-muted-foreground">
          Loc theo nhan vien, chuc vu, bo phan va tong ket theo ngay/thang. Co the xuat CSV.
        </p>
      </div>

      <div className="rounded-lg border bg-white p-4 space-y-4">
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-4">
          <div className="space-y-1">
            <label className="text-sm text-slate-600">Kieu xem</label>
            <select
              className="h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs"
              value={viewMode}
              onChange={(event) => setViewMode(event.target.value as ViewMode)}
            >
              <option value="MONTH">Tong ket theo thang</option>
              <option value="DAY">Tong ket theo ngay</option>
              <option value="RANGE">Theo khoang ngay</option>
            </select>
          </div>

          {viewMode === "MONTH" && (
            <div className="space-y-1">
              <label className="text-sm text-slate-600">Thang cu the</label>
              <Input type="month" value={monthValue} onChange={(event) => setMonthValue(event.target.value)} />
            </div>
          )}

          {viewMode === "DAY" && (
            <div className="space-y-1">
              <label className="text-sm text-slate-600">Ngay cu the</label>
              <Input type="date" value={dayValue} onChange={(event) => setDayValue(event.target.value)} />
            </div>
          )}

          {viewMode === "RANGE" && (
            <>
              <div className="space-y-1">
                <label className="text-sm text-slate-600">Tu ngay</label>
                <Input type="date" value={from} onChange={(event) => setFrom(event.target.value)} />
              </div>
              <div className="space-y-1">
                <label className="text-sm text-slate-600">Den ngay</label>
                <Input type="date" value={to} onChange={(event) => setTo(event.target.value)} />
              </div>
            </>
          )}
        </div>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-5">
          <div className="space-y-1">
            <label className="text-sm text-slate-600">Bo phan</label>
            <select
              className="h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs"
              value={departmentId}
              onChange={(event) => {
                setDepartmentId(event.target.value);
                setEmployeeId("ALL");
              }}
            >
              <option value="ALL">Tat ca bo phan</option>
              {departments.map((department) => (
                <option key={department.id} value={department.id}>
                  {department.name}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-sm text-slate-600">Chuc vu</label>
            <select
              className="h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs"
              value={positionId}
              onChange={(event) => {
                setPositionId(event.target.value);
                setEmployeeId("ALL");
              }}
            >
              <option value="ALL">Tat ca chuc vu</option>
              {positions.map((position) => (
                <option key={position.id} value={position.id}>
                  {position.name}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-sm text-slate-600">Nhan vien</label>
            <select
              className="h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs"
              value={employeeId}
              onChange={(event) => setEmployeeId(event.target.value)}
            >
              <option value="ALL">Tat ca nhan vien</option>
              {filteredEmployees.map((employee) => (
                <option key={employee.id} value={employee.id}>
                  {employee.fullName}
                  {employee.code ? ` (${employee.code})` : ""}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-sm text-slate-600">Trang thai</label>
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
            <label className="text-sm text-slate-600">Tim nhanh</label>
            <Input value={q} onChange={(event) => setQ(event.target.value)} placeholder="Ma hoac ten nhan vien" />
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button onClick={fetchData} disabled={loading}>
            {loading ? "Dang tai..." : "Loc du lieu"}
          </Button>
          <Button variant="outline" type="button" onClick={exportCsv} disabled={loading || items.length === 0}>
            Xuat CSV
          </Button>
          <Button
            variant="outline"
            type="button"
            onClick={() => {
              setViewMode("MONTH");
              setMonthValue(thisMonth);
              setDayValue(today);
              setFrom(monthStart);
              setTo(today);
              setQ("");
              setEmployeeId("ALL");
              setDepartmentId("ALL");
              setPositionId("ALL");
              setStatus("ALL");
            }}
          >
            Dat lai
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <div className="rounded-lg border bg-white p-4">
          <div className="text-xs text-slate-500">Tong dong</div>
          <div className="mt-1 text-xl font-semibold text-slate-900">{summary.totalRows}</div>
        </div>
        <div className="rounded-lg border bg-white p-4">
          <div className="text-xs text-slate-500">Tong tre</div>
          <div className="mt-1 text-xl font-semibold text-slate-900">{summary.totalLateMinutes} phut</div>
        </div>
        <div className="rounded-lg border bg-white p-4">
          <div className="text-xs text-slate-500">Tong ve som</div>
          <div className="mt-1 text-xl font-semibold text-slate-900">{summary.totalEarlyLeaveMinutes} phut</div>
        </div>
        <div className="rounded-lg border bg-white p-4">
          <div className="text-xs text-slate-500">Tong tang ca</div>
          <div className="mt-1 text-xl font-semibold text-slate-900">{summary.totalOvertimeMinutes} phut</div>
        </div>
        <div className="rounded-lg border bg-white p-4">
          <div className="text-xs text-slate-500">Tong gio lam</div>
          <div className="mt-1 text-xl font-semibold text-slate-900">{summary.totalWorkMinutes} phut</div>
        </div>
      </div>

      <div className="rounded-lg border bg-white">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-100">
                <TableHead className="w-14 text-center">STT</TableHead>
                <TableHead className="min-w-28 text-center">Ngay</TableHead>
                <TableHead className="min-w-56 text-center">Nhan vien</TableHead>
                <TableHead className="min-w-48 text-center">Ca lam</TableHead>
                <TableHead className="min-w-44 text-center">Checkin</TableHead>
                <TableHead className="min-w-44 text-center">Checkout</TableHead>
                <TableHead className="min-w-36 text-center">Trang thai</TableHead>
                <TableHead className="min-w-40 text-center">Thong so</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={8} className="py-10 text-center text-sm text-muted-foreground">
                    Dang tai du lieu...
                  </TableCell>
                </TableRow>
              ) : items.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="py-10 text-center text-sm text-muted-foreground">
                    Khong co du lieu phu hop.
                  </TableCell>
                </TableRow>
              ) : (
                items.map((item, index) => (
                  <TableRow key={item.id}>
                    <TableCell className="text-center text-sm text-slate-500">{index + 1}</TableCell>
                    <TableCell className="text-center">{item.date}</TableCell>
                    <TableCell>
                      <div className="text-sm font-medium text-slate-900">{item.employee.fullName}</div>
                      <div className="text-xs text-slate-500">{item.employee.code ?? "-"}</div>
                      <div className="text-xs text-slate-500">{item.employee.departmentName ?? "-"}</div>
                      <div className="text-xs text-slate-500">{item.employee.positionName ?? "-"}</div>
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
                      <div>Tre: {item.attendance.lateMinutes} phut</div>
                      <div>Ve som: {item.attendance.earlyLeaveMinutes} phut</div>
                      <div>Tang ca: {item.attendance.overtimeMinutes} phut</div>
                      <div>Lam: {item.attendance.workMinutes} phut</div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
        <div className="flex items-center justify-between border-t px-4 py-3 text-xs text-slate-500">
          <span>Tong dong: {items.length}</span>
          {limited && <span>Dang gioi han ket qua, hay thu hep bo loc de toi uu hieu nang.</span>}
        </div>
      </div>
    </div>
  );
}
