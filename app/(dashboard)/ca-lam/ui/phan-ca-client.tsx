"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type EmployeeOption = {
  id: string;
  code: string;
  fullName: string;
  departmentName?: string | null;
  positionName?: string | null;
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

type ShiftOption = {
  id: string;
  code: string;
  name: string;
  startTime: string;
  endTime: string;
  status: "ACTIVE" | "ARCHIVED";
};

type HolidayItem = {
  date: string;
  name: string;
  color: string;
  payPolicy: "PAID" | "UNPAID" | "LEAVE";
  scope: "ALL" | "DEPARTMENT" | "POSITION" | "EMPLOYEE";
};

const weekdays = [
  { key: "mon", label: "T2" },
  { key: "tue", label: "T3" },
  { key: "wed", label: "T4" },
  { key: "thu", label: "T5" },
  { key: "fri", label: "T6" },
  { key: "sat", label: "T7" },
  { key: "sun", label: "CN" },
];

const weekdayLabels = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"];

function formatDateOnly(date: Date) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function addMonths(date: Date, months: number) {
  const next = new Date(date);
  next.setDate(1);
  next.setMonth(next.getMonth() + months);
  return next;
}

function getCalendarGrid(month: Date) {
  const start = startOfMonth(month);
  const startDay = start.getDay();
  const first = new Date(start);
  first.setDate(first.getDate() - startDay);
  const days: Date[] = [];
  for (let i = 0; i < 42; i += 1) {
    const next = new Date(first);
    next.setDate(first.getDate() + i);
    days.push(next);
  }
  return days;
}

function formatMonthTitle(date: Date) {
  return `tháng ${date.getMonth() + 1} năm ${date.getFullYear()}`;
}

function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function combineDateTime(date: Date, time: string) {
  const [hours, minutes] = time.split(":").map(Number);
  const next = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  next.setHours(hours || 0, minutes || 0, 0, 0);
  return next;
}

function resolveShiftWindow(date: Date, startTime: string, endTime: string) {
  const start = combineDateTime(date, startTime);
  let end = combineDateTime(date, endTime);
  if (end.getTime() <= start.getTime()) {
    end = new Date(end.getTime() + 24 * 60 * 60 * 1000);
  }
  return { start, end };
}

function toShortLabel(value: string) {
  const normalized = value
    .normalize("NFD")
    .replace(/[đĐ]/g, "d")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9\s]/g, " ")
    .trim();
  if (!normalized) return "";
  return normalized
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word[0])
    .join("")
    .toUpperCase();
}

export function PhanCaClient() {
  const [assignTarget, setAssignTarget] = useState<"employee" | "department" | "position">("employee");
  const [employeeQuery, setEmployeeQuery] = useState("");
  const [employeeOptions, setEmployeeOptions] = useState<EmployeeOption[]>([]);
  const [employeeLoading, setEmployeeLoading] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<EmployeeOption | null>(null);
  const [departments, setDepartments] = useState<DepartmentOption[]>([]);
  const [positions, setPositions] = useState<PositionOption[]>([]);
  const [selectedDepartmentId, setSelectedDepartmentId] = useState("");
  const [selectedPositionId, setSelectedPositionId] = useState("");
  const [groupEmployees, setGroupEmployees] = useState<EmployeeOption[]>([]);
  const [groupSelected, setGroupSelected] = useState<Set<string>>(new Set());
  const [groupLoading, setGroupLoading] = useState(false);

  const [shiftOptions, setShiftOptions] = useState<ShiftOption[]>([]);
  const [shiftLoading, setShiftLoading] = useState(false);
  const [selectedShiftId, setSelectedShiftId] = useState<string>("");


  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [rangeStart, setRangeStart] = useState<Date | null>(null);
  const [rangeEnd, setRangeEnd] = useState<Date | null>(null);
  const [selectMode, setSelectMode] = useState<"range" | "single">("range");
  const [selectedDates, setSelectedDates] = useState<Set<string>>(new Set());
  const [calendarMonth, setCalendarMonth] = useState<Date>(new Date());
  const [scheduleMap, setScheduleMap] = useState<Record<string, string>>({});
  const [holidayMap, setHolidayMap] = useState<Record<string, HolidayItem[]>>({});
  const [scheduleLoading, setScheduleLoading] = useState(false);
  const [holidayLoading, setHolidayLoading] = useState(false);
  const [selectedWeekdays, setSelectedWeekdays] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [overwriteExisting, setOverwriteExisting] = useState(true);

  useEffect(() => {
    let active = true;
    async function fetchShifts() {
      setShiftLoading(true);
      try {
        const res = await fetch("/api/ca-lam");
        if (!res.ok) throw new Error("Không tải được danh sách ca làm.");
        const data = (await res.json()) as { items?: ShiftOption[] };
        if (active) {
          setShiftOptions((data.items ?? []).filter((item) => item.status === "ACTIVE"));
        }
      } catch (error: unknown) {
        console.error(error);
        toast.error("Không tải được danh sách ca làm.");
      } finally {
        if (active) setShiftLoading(false);
      }
    }
    fetchShifts();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    async function fetchMeta() {
      try {
        const [deptRes, posRes] = await Promise.all([fetch("/api/bo-phan"), fetch("/api/chuc-vu")]);
        const deptData = deptRes.ok ? ((await deptRes.json()) as { items?: DepartmentOption[] }) : { items: [] };
        const posData = posRes.ok ? ((await posRes.json()) as { items?: PositionOption[] }) : { items: [] };
        if (!active) return;
        setDepartments(deptData.items ?? []);
        setPositions(posData.items ?? []);
      } catch (error: unknown) {
        console.error(error);
        toast.error("Không tải được danh sách bộ phận/chức vụ.");
      }
    }
    fetchMeta();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (assignTarget === "employee") {
      setSelectedDepartmentId("");
      setSelectedPositionId("");
      setGroupEmployees([]);
      setGroupSelected(new Set());
      return;
    }
    setSelectedEmployee(null);
    setEmployeeQuery("");
    setEmployeeOptions([]);
  }, [assignTarget]);

  useEffect(() => {
    let active = true;
    if (assignTarget === "department" && selectedDepartmentId) {
      setGroupLoading(true);
      fetch(`/api/nhan-vien?departmentId=${selectedDepartmentId}&page=1&pageSize=200`)
        .then(async (res) => {
          if (!res.ok) throw new Error("Không tải được danh sách nhân viên.");
          const data = (await res.json()) as { items?: EmployeeOption[] };
          if (!active) return;
          setGroupEmployees(data.items ?? []);
          setGroupSelected(new Set());
        })
        .catch((error: unknown) => {
          console.error(error);
          toast.error("Không tải được danh sách nhân viên.");
        })
        .finally(() => {
          if (active) setGroupLoading(false);
        });
      return () => {
        active = false;
      };
    }
    if (assignTarget === "position" && selectedPositionId) {
      setGroupLoading(true);
      fetch(`/api/nhan-vien?positionId=${selectedPositionId}&page=1&pageSize=200`)
        .then(async (res) => {
          if (!res.ok) throw new Error("Không tải được danh sách nhân viên.");
          const data = (await res.json()) as { items?: EmployeeOption[] };
          if (!active) return;
          setGroupEmployees(data.items ?? []);
          setGroupSelected(new Set());
        })
        .catch((error: unknown) => {
          console.error(error);
          toast.error("Không tải được danh sách nhân viên.");
        })
        .finally(() => {
          if (active) setGroupLoading(false);
        });
      return () => {
        active = false;
      };
    }
    setGroupEmployees([]);
    setGroupSelected(new Set());
  }, [assignTarget, selectedDepartmentId, selectedPositionId]);

  useEffect(() => {
    let active = true;
    const q = employeeQuery.trim();
    if (assignTarget !== "employee" || q.length < 2) {
      setEmployeeOptions([]);
      return;
    }
    const timer = setTimeout(async () => {
      setEmployeeLoading(true);
      try {
        const res = await fetch(`/api/nhan-vien?q=${encodeURIComponent(q)}&page=1&pageSize=20`);
        if (!res.ok) throw new Error("Không tải được danh sách nhân viên.");
        const data = (await res.json()) as {
          items?: Array<{
            id: string;
            code: string;
            fullName: string;
            departmentName?: string | null;
            positionName?: string | null;
          }>;
        };
        if (active) setEmployeeOptions(data.items ?? []);
      } catch (error: unknown) {
        console.error(error);
        toast.error("Không tải được danh sách nhân viên.");
      } finally {
        if (active) setEmployeeLoading(false);
      }
    }, 300);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [assignTarget, employeeQuery]);

  const selectedShift = useMemo(
    () => shiftOptions.find((item) => item.id === selectedShiftId) ?? null,
    [shiftOptions, selectedShiftId]
  );

useEffect(() => {
  if (selectMode === "range") {
    setDateFrom(rangeStart ? formatDateOnly(rangeStart) : "");
    setDateTo(rangeEnd ? formatDateOnly(rangeEnd) : "");
  }
}, [rangeStart, rangeEnd, selectMode]);

  const refreshScheduleMap = useCallback(async (employeeIds: string[]) => {
    const monthStart = startOfMonth(calendarMonth);
    const rangeStartDate = new Date(monthStart);
    const rangeEndDate = addMonths(monthStart, 2);
    rangeEndDate.setDate(0);
    const query = new URLSearchParams({
      from: formatDateOnly(rangeStartDate),
      to: formatDateOnly(rangeEndDate),
    });
    if (employeeIds.length === 1) query.set("employeeId", employeeIds[0]);
    else query.set("employeeIds", employeeIds.join(","));
    const res = await fetch(`/api/phan-ca/lich?${query.toString()}`);
    if (!res.ok) throw new Error("Không tải được lịch phân ca.");
    const data = (await res.json()) as { items?: Array<{ date: string; name?: string | null }> };
    const map: Record<string, string> = {};
    (data.items ?? []).forEach((item) => {
      if (item.date) map[item.date] = item.name ?? "";
    });
    setScheduleMap(map);
  }, [calendarMonth]);

  const refreshHolidayMap = useCallback(
    async (employeeIds: string[]) => {
      const monthStart = startOfMonth(calendarMonth);
      const rangeStartDate = new Date(monthStart);
      const rangeEndDate = addMonths(monthStart, 2);
      rangeEndDate.setDate(0);
      const query = new URLSearchParams({
        from: formatDateOnly(rangeStartDate),
        to: formatDateOnly(rangeEndDate),
      });
      if (employeeIds.length === 1) query.set("employeeId", employeeIds[0]);
      else if (employeeIds.length > 1) query.set("employeeIds", employeeIds.join(","));
      const res = await fetch(`/api/ngay-nghi/lich?${query.toString()}`);
      if (!res.ok) throw new Error("Không tải được lịch ngày nghỉ.");
      const data = (await res.json()) as { items?: HolidayItem[] };
      const map: Record<string, HolidayItem[]> = {};
      (data.items ?? []).forEach((item) => {
        if (!item.date) return;
        if (!map[item.date]) map[item.date] = [];
        map[item.date].push(item);
      });
      setHolidayMap(map);
    },
    [calendarMonth]
  );

  useEffect(() => {
    const employeeIds =
      assignTarget === "employee"
        ? selectedEmployee?.id
          ? [selectedEmployee.id]
          : []
        : Array.from(groupSelected);
    let active = true;
    setScheduleLoading(true);
    setHolidayLoading(true);
    const schedulePromise =
      employeeIds.length > 0 ? refreshScheduleMap(employeeIds) : Promise.resolve(setScheduleMap({}));
    const holidayPromise =
      employeeIds.length > 0 ? refreshHolidayMap(employeeIds) : Promise.resolve(setHolidayMap({}));
    Promise.all([schedulePromise, holidayPromise])
      .catch((error: unknown) => {
        console.error(error);
        toast.error("Không tải được lịch phân ca.");
      })
      .finally(() => {
        if (!active) return;
        setScheduleLoading(false);
        setHolidayLoading(false);
      });
    return () => {
      active = false;
    };
  }, [assignTarget, calendarMonth, groupSelected, refreshHolidayMap, refreshScheduleMap, selectedEmployee?.id]);

function handleDateSelect(day: Date) {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const isPast = day.getTime() < todayStart.getTime();
  const isToday = isSameDay(day, now);
  if (isPast) return;
  if (isToday && selectedShift) {
    const window = resolveShiftWindow(day, selectedShift.startTime, selectedShift.endTime);
    if (now.getTime() > window.end.getTime()) return;
  }

  const dayKey = formatDateOnly(day);
  if (selectMode === "single") {
    setSelectedDates((prev) => {
      const next = new Set(prev);
      if (next.has(dayKey)) next.delete(dayKey);
      else next.add(dayKey);
      return next;
    });
    return;
  }

  const startKey = rangeStart ? formatDateOnly(rangeStart) : null;
  const endKey = rangeEnd ? formatDateOnly(rangeEnd) : null;

  if (!rangeStart && !rangeEnd) {
    setRangeStart(new Date(day));
    setRangeEnd(null);
    return;
  }

  if (rangeStart && !rangeEnd) {
    if (startKey === dayKey) {
      setRangeStart(null);
      setRangeEnd(null);
      return;
    }
    const a = rangeStart;
    const b = day;
    const [start, end] = a <= b ? [a, b] : [b, a];
    setRangeStart(new Date(start));
    setRangeEnd(new Date(end));
    return;
  }

  if (rangeStart && rangeEnd) {
    if (startKey === dayKey) {
      setRangeStart(new Date(rangeEnd));
      setRangeEnd(null);
      return;
    }
    if (endKey === dayKey) {
      setRangeEnd(null);
      return;
    }
    setRangeStart(new Date(day));
    setRangeEnd(null);
  }
}

  function toggleWeekday(value: string) {
    setSelectedWeekdays((prev) =>
      prev.includes(value) ? prev.filter((item) => item !== value) : [...prev, value]
    );
  }

async function handleCreateSchedules() {
  const targetEmployeeIds =
    assignTarget === "employee"
      ? selectedEmployee?.id
        ? [selectedEmployee.id]
        : []
      : Array.from(groupSelected);
  if (targetEmployeeIds.length === 0) {
    toast.error("Vui lòng chọn nhân viên.");
    return;
  }
  if (!selectedShiftId) {
    toast.error("Vui lòng chọn ca làm.");
    return;
  }
  if (selectMode === "range") {
    if (!dateFrom || !dateTo) {
      toast.error("Vui lòng chọn khoảng thời gian.");
      return;
    }
  } else if (selectedDates.size === 0) {
    toast.error("Vui lòng chọn ít nhất một ngày.");
    return;
  }
    const weekdayMap: Record<string, number> = {
      sun: 0,
      mon: 1,
      tue: 2,
      wed: 3,
      thu: 4,
      fri: 5,
      sat: 6,
    };
    const weekdayNumbers = selectedWeekdays
      .map((key) => weekdayMap[key])
      .filter((value) => Number.isFinite(value)) as number[];
    const weekdayNumbersToSend = selectMode === "range" ? weekdayNumbers : [];

  try {
    setSubmitting(true);
    setScheduleLoading(true);
    let createdTotal = 0;
    let updatedTotal = 0;
    let skippedTotal = 0;

    const postSchedule = async (employeeIdValue: string, startDateValue: string, endDateValue: string) => {
      const res = await fetch("/api/phan-ca", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          employeeId: employeeIdValue,
          workShiftId: selectedShiftId,
          startDate: startDateValue,
          endDate: endDateValue,
            weekdays: weekdayNumbersToSend,
          overwrite: overwriteExisting,
        }),
      });
      if (!res.ok) {
        const data = (await res.json()) as { message?: string };
        throw new Error(data.message ?? "Không thể tạo lịch phân ca.");
      }
      const data = (await res.json()) as { created?: number; updated?: number; skipped?: number };
      createdTotal += data.created ?? 0;
      updatedTotal += data.updated ?? 0;
      skippedTotal += data.skipped ?? 0;
    };

    if (selectMode === "range") {
      for (const employeeIdValue of targetEmployeeIds) {
        await postSchedule(employeeIdValue, dateFrom, dateTo);
      }
    } else {
      const dates = [...selectedDates].sort();
      for (const employeeIdValue of targetEmployeeIds) {
        for (const dateValue of dates) {
          await postSchedule(employeeIdValue, dateValue, dateValue);
        }
      }
    }

    toast.success(`Đã tạo ${createdTotal} lịch, cập nhật ${updatedTotal}, bỏ qua ${skippedTotal}.`);

      setRangeStart(null);
      setRangeEnd(null);
      setDateFrom("");
      setDateTo("");
    setSelectedWeekdays([]);
    setSelectedDates(new Set());
    if (targetEmployeeIds.length > 0) {
      await refreshScheduleMap(targetEmployeeIds);
      await refreshHolidayMap(targetEmployeeIds);
    }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Không thể tạo lịch phân ca.";
      toast.error(message);
    } finally {
      setScheduleLoading(false);
      setSubmitting(false);
    }
  }

  async function handleRemoveSchedules() {
    const targetEmployeeIds =
      assignTarget === "employee"
        ? selectedEmployee?.id
          ? [selectedEmployee.id]
          : []
        : Array.from(groupSelected);
    if (targetEmployeeIds.length === 0) {
      toast.error("Vui lòng chọn nhân viên.");
      return;
    }
    if (selectMode === "range") {
      if (!dateFrom || !dateTo) {
        toast.error("Vui lòng chọn khoảng thời gian.");
        return;
      }
    } else if (selectedDates.size === 0) {
      toast.error("Vui lòng chọn ít nhất một ngày.");
      return;
    }

    const weekdayMap: Record<string, number> = {
      sun: 0,
      mon: 1,
      tue: 2,
      wed: 3,
      thu: 4,
      fri: 5,
      sat: 6,
    };
    const weekdayNumbers = selectedWeekdays
      .map((key) => weekdayMap[key])
      .filter((value) => Number.isFinite(value)) as number[];
    const weekdayNumbersToSend = selectMode === "range" ? weekdayNumbers : [];

    try {
      setSubmitting(true);
      let deletedTotal = 0;
      const postRemove = async (employeeIdValue: string, startDateValue: string, endDateValue: string) => {
        const res = await fetch("/api/phan-ca/remove", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            employeeId: employeeIdValue,
            workShiftId: selectedShiftId || undefined,
            startDate: startDateValue,
            endDate: endDateValue,
            weekdays: weekdayNumbersToSend,
          }),
        });
        if (!res.ok) {
          const data = (await res.json()) as { message?: string };
          throw new Error(data.message ?? "Không thể gỡ ca làm.");
        }
        const data = (await res.json()) as { deleted?: number };
        deletedTotal += data.deleted ?? 0;
      };

      if (selectMode === "range") {
        for (const employeeIdValue of targetEmployeeIds) {
          await postRemove(employeeIdValue, dateFrom, dateTo);
        }
      } else {
        const dates = [...selectedDates].sort();
        for (const employeeIdValue of targetEmployeeIds) {
          for (const dateValue of dates) {
            await postRemove(employeeIdValue, dateValue, dateValue);
          }
        }
      }

      toast.success(`Đã gỡ ${deletedTotal} lịch phân ca.`);
      setSelectedDates(new Set());
      if (targetEmployeeIds.length > 0) {
        await refreshScheduleMap(targetEmployeeIds);
        await refreshHolidayMap(targetEmployeeIds);
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Không thể gỡ ca làm.";
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="grid gap-4 xl:grid-cols-[2.3fr,1fr]">
      <div className="space-y-4">
        <section className="rounded-lg border bg-white p-4 space-y-4">
          <div>
            <h3 className="text-base font-semibold">Phân ca theo khoảng thời gian</h3>
            <p className="text-sm text-muted-foreground">
              Chọn nhân viên, ca làm và khoảng ngày để hệ thống tự tạo lịch theo tuần.
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Phân ca theo</label>
                <select
                  value={assignTarget}
                  onChange={(event) => setAssignTarget(event.target.value as typeof assignTarget)}
                  className="rounded-none border border-slate-300 bg-white px-2 py-2 text-sm w-full"
                >
                  <option value="employee">Cá nhân</option>
                  <option value="department">Bộ phận</option>
                  <option value="position">Chức vụ</option>
                </select>
              </div>

              {assignTarget === "employee" && (
                <div className="space-y-2">
                  <label className="text-sm font-medium">Nhân viên</label>
                  <Input
                    placeholder="Nhập tên hoặc mã nhân viên..."
                    value={employeeQuery}
                    onChange={(event) => {
                      setEmployeeQuery(event.target.value);
                      setSelectedEmployee(null);
                    }}
                    className="rounded-none"
                  />
                  <div className="rounded-md border border-slate-200 bg-white max-h-44 overflow-y-auto">
                    {employeeLoading ? (
                      <div className="px-3 py-2 text-sm text-slate-500">Đang tìm...</div>
                    ) : employeeOptions.length === 0 ? (
                      <div className="px-3 py-2 text-sm text-slate-500">
                        {employeeQuery.trim().length >= 2 ? "Không tìm thấy nhân viên." : "Nhập ít nhất 2 ký tự."}
                      </div>
                    ) : (
                      employeeOptions.map((item) => (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => {
                            setSelectedEmployee(item);
                            setEmployeeQuery(`${item.fullName} (${item.code})`);
                            setEmployeeOptions([]);
                          }}
                          className="w-full text-left px-3 py-2 text-sm hover:bg-slate-50"
                        >
                          <div className="font-medium text-slate-900">
                            {item.fullName} <span className="text-slate-500">({item.code})</span>
                          </div>
                          <div className="text-xs text-slate-500">
                            {item.departmentName ?? "Chưa có bộ phận"} · {item.positionName ?? "Chưa có chức vụ"}
                          </div>
                        </button>
                      ))
                    )}
                  </div>
                  {selectedEmployee && (
                    <div className="text-xs text-emerald-700">
                      Đã chọn: <span className="font-semibold">{selectedEmployee.fullName}</span>
                    </div>
                  )}
                </div>
              )}

              {assignTarget === "department" && (
                <div className="space-y-2">
                  <label className="text-sm font-medium">Bộ phận</label>
                  <select
                    value={selectedDepartmentId}
                    onChange={(event) => setSelectedDepartmentId(event.target.value)}
                    className="rounded-none border border-slate-300 bg-white px-2 py-2 text-sm w-full"
                  >
                    <option value="">-- Chọn bộ phận --</option>
                    {departments.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.code} - {item.name}
                      </option>
                    ))}
                  </select>
                  <div className="rounded-md border border-slate-200 bg-white max-h-52 overflow-y-auto">
                    {groupLoading ? (
                      <div className="px-3 py-2 text-sm text-slate-500">Đang tải...</div>
                    ) : groupEmployees.length === 0 ? (
                      <div className="px-3 py-2 text-sm text-slate-500">Chưa có nhân viên.</div>
                    ) : (
                      <>
                        <label className="flex items-center gap-2 px-3 py-2 text-sm border-b">
                          <input
                            type="checkbox"
                            checked={groupEmployees.length > 0 && groupSelected.size === groupEmployees.length}
                            onChange={(event) => {
                              if (event.target.checked) {
                                setGroupSelected(new Set(groupEmployees.map((item) => item.id)));
                              } else {
                                setGroupSelected(new Set());
                              }
                            }}
                          />
                          Chọn tất cả
                        </label>
                        {groupEmployees.map((item) => (
                          <label key={item.id} className="flex items-center gap-2 px-3 py-2 text-sm">
                            <input
                              type="checkbox"
                              checked={groupSelected.has(item.id)}
                              onChange={(event) => {
                                setGroupSelected((prev) => {
                                  const next = new Set(prev);
                                  if (event.target.checked) next.add(item.id);
                                  else next.delete(item.id);
                                  return next;
                                });
                              }}
                            />
                            <span className="font-medium">{item.fullName}</span>
                            <span className="text-slate-500">({item.code})</span>
                          </label>
                        ))}
                      </>
                    )}
                  </div>
                  {groupSelected.size > 0 && (
                    <div className="text-xs text-emerald-700">
                      Đã chọn: <span className="font-semibold">{groupSelected.size}</span> nhân viên
                    </div>
                  )}
                </div>
              )}

              {assignTarget === "position" && (
                <div className="space-y-2">
                  <label className="text-sm font-medium">Chức vụ</label>
                  <select
                    value={selectedPositionId}
                    onChange={(event) => setSelectedPositionId(event.target.value)}
                    className="rounded-none border border-slate-300 bg-white px-2 py-2 text-sm w-full"
                  >
                    <option value="">-- Chọn chức vụ --</option>
                    {positions.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.code} - {item.name}
                      </option>
                    ))}
                  </select>
                  <div className="rounded-md border border-slate-200 bg-white max-h-52 overflow-y-auto">
                    {groupLoading ? (
                      <div className="px-3 py-2 text-sm text-slate-500">Đang tải...</div>
                    ) : groupEmployees.length === 0 ? (
                      <div className="px-3 py-2 text-sm text-slate-500">Chưa có nhân viên.</div>
                    ) : (
                      <>
                        <label className="flex items-center gap-2 px-3 py-2 text-sm border-b">
                          <input
                            type="checkbox"
                            checked={groupEmployees.length > 0 && groupSelected.size === groupEmployees.length}
                            onChange={(event) => {
                              if (event.target.checked) {
                                setGroupSelected(new Set(groupEmployees.map((item) => item.id)));
                              } else {
                                setGroupSelected(new Set());
                              }
                            }}
                          />
                          Chọn tất cả
                        </label>
                        {groupEmployees.map((item) => (
                          <label key={item.id} className="flex items-center gap-2 px-3 py-2 text-sm">
                            <input
                              type="checkbox"
                              checked={groupSelected.has(item.id)}
                              onChange={(event) => {
                                setGroupSelected((prev) => {
                                  const next = new Set(prev);
                                  if (event.target.checked) next.add(item.id);
                                  else next.delete(item.id);
                                  return next;
                                });
                              }}
                            />
                            <span className="font-medium">{item.fullName}</span>
                            <span className="text-slate-500">({item.code})</span>
                          </label>
                        ))}
                      </>
                    )}
                  </div>
                  {groupSelected.size > 0 && (
                    <div className="text-xs text-emerald-700">
                      Đã chọn: <span className="font-semibold">{groupSelected.size}</span> nhân viên
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Ca làm</label>
              <select
                value={selectedShiftId}
                onChange={(event) => setSelectedShiftId(event.target.value)}
                className="rounded-none border border-slate-300 bg-white px-2 py-2 text-sm"
                disabled={shiftLoading}
              >
                <option value="">-- Chọn ca làm --</option>
                {shiftOptions.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.code} - {item.name} ({item.startTime}-{item.endTime})
                  </option>
                ))}
              </select>
              {shiftLoading && <div className="text-xs text-slate-500">Đang tải ca làm...</div>}
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">
                {selectMode === "range" ? "Khoảng thời gian" : "Ngày đã chọn"}
              </label>
              {selectMode === "range" ? (
                <div className="grid gap-2 sm:grid-cols-2">
                  <Input value={dateFrom} readOnly placeholder="Ngày bắt đầu" className="rounded-none" />
                  <Input value={dateTo} readOnly placeholder="Ngày kết thúc" className="rounded-none" />
                </div>
              ) : (
                <div className="flex flex-wrap gap-2 rounded-md border border-slate-200 bg-white px-2 py-2 text-sm text-slate-700">
                  {selectedDates.size === 0 ? (
                    <span className="text-slate-500">Chưa chọn ngày nào</span>
                  ) : (
                    [...selectedDates]
                      .sort()
                      .map((date) => (
                        <span
                          key={date}
                          className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700"
                        >
                          {new Intl.DateTimeFormat("vi-VN").format(new Date(`${date}T00:00:00`))}
                        </span>
                      ))
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="text-sm font-medium">Chọn ngày trên lịch</div>
                <div className="text-xs text-slate-500">
                  {selectMode === "range"
                    ? "Click chọn ngày bắt đầu và kết thúc như lịch booking."
                    : "Click chọn một ngày cụ thể."}
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setCalendarMonth(new Date())}
                  className="rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700 hover:border-blue-300 hover:bg-blue-100 cursor-pointer"
                  title="Về tháng hiện tại"
                >
                  Hôm nay: {new Intl.DateTimeFormat("vi-VN").format(new Date())}
                </button>
                <Button
                  type="button"
                  variant="outline"
                  className="rounded-none w-full sm:w-auto"
                  onClick={() => {
                    setRangeStart(null);
                    setRangeEnd(null);
                    setSelectedDates(new Set());
                  }}
                >
                  Reset chọn
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className={`rounded-none w-full sm:w-auto ${
                    selectMode === "single" ? "border-emerald-500 text-emerald-700" : ""
                  }`}
                  onClick={() => {
                    setSelectMode("single");
                    setRangeStart(null);
                    setRangeEnd(null);
                  }}
                >
                  Chọn từng ngày
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className={`rounded-none w-full sm:w-auto ${
                    selectMode === "range" ? "border-emerald-500 text-emerald-700" : ""
                  }`}
                  onClick={() => {
                    setSelectMode("range");
                    setSelectedDates(new Set());
                  }}
                >
                  Chọn theo khoảng
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="rounded-none w-full sm:w-auto"
                  onClick={() => setCalendarMonth(addMonths(calendarMonth, -1))}
                >
                  Tháng trước
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="rounded-none w-full sm:w-auto"
                  onClick={() => setCalendarMonth(addMonths(calendarMonth, 1))}
                >
                  Tháng sau
                </Button>
              </div>
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              {[calendarMonth, addMonths(calendarMonth, 1)].map((month, idx) => {
                const days = getCalendarGrid(month);
                const title = formatMonthTitle(month);
                const startKey = rangeStart ? formatDateOnly(rangeStart) : null;
                const endKey = rangeEnd ? formatDateOnly(rangeEnd) : null;
                return (
                  <div
                    key={`${month.getFullYear()}-${month.getMonth()}-${idx}`}
                    className={`rounded-lg border bg-white ${idx === 1 ? "hidden lg:block" : ""}`}
                  >
                    <div className="border-b px-4 py-3 text-sm font-semibold text-slate-700 capitalize">
                      {title}
                    </div>
                    <div className="grid grid-cols-7 gap-2 px-3 py-3 text-xs text-slate-500 sm:gap-3 sm:px-4">
                      {weekdayLabels.map((label) => (
                        <div key={label} className="text-center">
                          {label}
                        </div>
                      ))}
                    </div>
                    <div className="grid grid-cols-7 gap-2 px-3 pb-4 sm:gap-3 sm:px-4">
                      {days.map((day) => {
                        const inMonth = day.getMonth() === month.getMonth();
                        const dayKey = formatDateOnly(day);
                        const isStart = startKey ? dayKey === startKey : false;
                        const isEnd = endKey ? dayKey === endKey : false;
                        const inRange =
                          selectMode === "range" && !!startKey && !!endKey && dayKey > startKey && dayKey < endKey;
                        const hasShift = !!scheduleMap[dayKey];
                        const shiftName = scheduleMap[dayKey];
                        const holidayItems = holidayMap[dayKey] ?? [];
                        const holiday = holidayItems[0];
                        const hasHoliday = holidayItems.length > 0;
                        const hasConflict = hasHoliday && hasShift;
                        const holidayLabel =
                          holidayItems.length > 1
                            ? `${holiday?.name} (+${holidayItems.length - 1})`
                            : holiday?.name ?? "";
                        const conflictLabelFull =
                          holidayLabel && shiftName ? `${holidayLabel} / ${shiftName}` : shiftName ?? holidayLabel;
                        const conflictLabelShort =
                          holidayLabel && shiftName
                            ? `${toShortLabel(holidayLabel)} / ${toShortLabel(shiftName)}`
                            : toShortLabel(shiftName ?? holidayLabel ?? "");
                        const now = new Date();
                        const isToday = isSameDay(day, now);
                        const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
                        const isPast = day.getTime() < todayStart.getTime();
                        const isTodayBlocked =
                          isToday && selectedShift
                            ? now.getTime() >
                              resolveShiftWindow(day, selectedShift.startTime, selectedShift.endTime).end.getTime()
                            : false;
                        const isBlocked = isPast || isTodayBlocked;
                        const isSelected = isStart || isEnd;
                        const isSelectedSingle =
                          selectMode === "single" && selectedDates.has(dayKey);
                        const isSelectedAny = isSelected || isSelectedSingle;
                        return (
                          <button
                            key={dayKey}
                            type="button"
                            onClick={() => handleDateSelect(day)}
                            disabled={isBlocked}
                            className={`relative flex h-12 flex-col items-center justify-start gap-0.5 rounded-md border pt-3 text-[11px] transition sm:h-14 sm:pt-4 sm:text-sm ${
                              inMonth
                                ? isBlocked
                                  ? "border-slate-200 bg-slate-50 text-slate-400"
                                  : "border-slate-200 bg-white text-slate-900 hover:border-emerald-300"
                                : "border-transparent text-slate-300"
                            } ${
                              isToday && inMonth ? "bg-blue-50! border-blue-200!" : ""
                            } ${inRange ? "bg-emerald-100! border-emerald-300! text-emerald-700!" : ""} ${
                              isStart || isEnd ? "bg-emerald-500! text-white! border-emerald-500!" : ""
                            } ${isSelectedSingle ? "bg-emerald-500! text-white! border-emerald-500!" : ""} ${
                              hasConflict && !isSelectedAny ? "border-red-500! bg-amber-100!" : ""
                            } ${isBlocked ? "cursor-not-allowed opacity-60" : ""}`}
                            title={
                              isPast
                                ? "Không thể phân ca cho ngày trước hôm nay"
                                : isTodayBlocked
                                  ? "Đã quá thời gian check-in cho ca hôm nay"
                                  : hasShift
                                ? "Ngày này đã có ca làm"
                                : hasHoliday
                                  ? "Ngày nghỉ"
                                  : inMonth
                                    ? "Chọn ngày"
                                    : ""
                            }
                          >
                            {hasShift && !hasConflict && !isSelectedAny && (
                              <span className="absolute inset-0 rounded-md bg-amber-100 opacity-70" />
                            )}
                            {hasHoliday && !hasConflict && !isSelectedAny && holiday && (
                              <span
                                className="absolute inset-0 rounded-md opacity-70"
                                style={{
                                  backgroundColor: `${holiday.color}1f`,
                                  borderColor: `${holiday.color}80`,
                                }}
                              />
                            )}
                            {isToday && inMonth && (
                              <>
                                <span className="absolute top-0.5 left-1 right-1 z-10 text-[9px] font-semibold text-blue-700 sm:top-1 sm:text-[10px] hidden sm:block">
                                  Hôm nay
                                </span>
                                <span className="absolute top-1 right-1 z-10 rounded-full bg-blue-100 px-1.5 py-0.5 text-[8px] font-semibold text-blue-700 sm:hidden">
                                  HN
                                </span>
                              </>
                            )}
                            <span
                              className={
                                isSelectedAny
                                  ? "relative z-10 font-semibold text-white"
                                  : isToday && inMonth
                                    ? "relative z-10 font-semibold text-emerald-600"
                                    : "relative z-10"
                              }
                            >
                              {day.getDate()}
                            </span>
                            {hasConflict && conflictLabelFull && (
                              <>
                                <span className="relative z-10 px-0.5 text-center text-[8px] font-semibold leading-tight text-red-600 sm:hidden">
                                  {conflictLabelShort}
                                </span>
                                <span className="relative z-10 px-0.5 text-center text-[9px] font-semibold leading-snug text-red-600 hidden sm:block">
                                  {conflictLabelFull}
                                </span>
                              </>
                            )}
                            {hasHoliday && !hasConflict && holidayLabel && (
                              <span
                                className="relative z-10 truncate text-[9px] font-semibold sm:text-[10px]"
                                style={{ color: isSelectedAny ? "#ffffff" : holiday?.color ?? "#F59E0B" }}
                              >
                                {holidayLabel}
                              </span>
                            )}
                            {!hasConflict && hasShift && shiftName && (
                              <span
                                className={`relative z-10 truncate text-[9px] font-medium sm:text-[10px] ${
                                  isSelectedAny ? "text-white" : "text-amber-700"
                                }`}
                              >
                                {shiftName}
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500">
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-amber-500" />
                Ngày đã có ca
              </div>
              <div className="flex items-center gap-2">
                <span className="h-3 w-3 rounded bg-amber-100 border border-amber-200" />
                Ngày nghỉ
              </div>
              <div className="flex items-center gap-2">
                <span className="h-3 w-3 rounded bg-emerald-100 border border-emerald-200" />
                Khoảng đang chọn
              </div>
              {(scheduleLoading || holidayLoading) && <div>Đang tải lịch...</div>}
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Áp dụng theo thứ</label>
            <div className="flex flex-wrap gap-2">
              {weekdays.map((day) => {
                const active = selectedWeekdays.includes(day.key);
                return (
                  <button
                    key={day.key}
                    type="button"
                    onClick={() => toggleWeekday(day.key)}
                    className={`h-9 w-10 rounded-none border text-sm ${
                      active
                        ? "border-emerald-500 bg-emerald-50 text-emerald-700"
                        : "border-slate-300 bg-white text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    {day.label}
                  </button>
                );
              })}
            </div>
            <p className="text-xs text-slate-500">
              Nếu không chọn, mặc định áp dụng tất cả các ngày trong khoảng.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-sm">
            <input
              id="overwriteExisting"
              type="checkbox"
              checked={overwriteExisting}
              onChange={(event) => setOverwriteExisting(event.target.checked)}
              className="h-4 w-4 accent-emerald-600"
            />
            <label htmlFor="overwriteExisting" className="text-sm text-slate-700">
              Ghi đè ca đã có trong khoảng đã chọn
            </label>
          </div>

          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button variant="outline" className="rounded-none w-full sm:w-auto" onClick={handleRemoveSchedules}>
              Gỡ ca
            </Button>
            <Button
              className="rounded-none bg-emerald-500 text-white hover:bg-emerald-600 w-full sm:w-auto"
              onClick={handleCreateSchedules}
              disabled={submitting}
            >
              Tạo/Cập nhật lịch
            </Button>
          </div>
        </section>

      </div>

      <aside className="rounded-lg border bg-white p-4 space-y-3">
        <h3 className="text-base font-semibold">Tóm tắt phân ca</h3>
        <div className="text-sm text-slate-600 space-y-2">
          <div>
            Nhân viên:{" "}
            <span className="font-semibold text-slate-900">
              {selectedEmployee ? selectedEmployee.fullName : "Chưa chọn"}
            </span>
          </div>
          <div>
            Ca làm:{" "}
            <span className="font-semibold text-slate-900">
              {selectedShift ? `${selectedShift.name} (${selectedShift.code})` : "Chưa chọn"}
            </span>
          </div>
          <div>
            Thời gian:{" "}
            <span className="font-semibold text-slate-900">
              {selectMode === "range"
                ? `${dateFrom || "—"} → ${dateTo || "—"}`
                : selectedDates.size > 0
                  ? [...selectedDates]
                      .sort()
                      .map((date) => new Intl.DateTimeFormat("vi-VN").format(new Date(`${date}T00:00:00`)))
                      .join(", ")
                  : "—"}
            </span>
          </div>
          <div>
            Thứ áp dụng:{" "}
            <span className="font-semibold text-slate-900">
              {selectedWeekdays.length > 0
                ? selectedWeekdays.map((key) => weekdays.find((d) => d.key === key)?.label).join(", ")
                : "Tất cả"}
            </span>
          </div>
        </div>
        <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          Lưu ý: Chức năng tạo lịch sẽ tự ghi đè nếu ngày đã có ca. Bạn có thể bật tuỳ chọn bảo toàn lịch
          sau khi hoàn thiện phần backend.
        </div>
      </aside>
    </div>
  );
}
