"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type HolidayTypeOption = {
  id: string;
  name: string;
  color: string;
  payPolicy: "PAID" | "UNPAID" | "LEAVE";
};

type DepartmentOption = { id: string; code: string; name: string };
type PositionOption = { id: string; code: string; name: string };
type EmployeeOption = { id: string; code: string; fullName: string };

type HolidayItem = {
  date: string;
  name: string;
  color: string;
  payPolicy: "PAID" | "UNPAID" | "LEAVE";
  scope: "ALL" | "DEPARTMENT" | "POSITION" | "EMPLOYEE";
};

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

export function HolidaySetClient() {
  const [holidayTypes, setHolidayTypes] = useState<HolidayTypeOption[]>([]);
  const [selectedHolidayTypeId, setSelectedHolidayTypeId] = useState("");
  const [scope, setScope] = useState<"ALL" | "DEPARTMENT" | "POSITION" | "EMPLOYEE">("ALL");

  const [departments, setDepartments] = useState<DepartmentOption[]>([]);
  const [positions, setPositions] = useState<PositionOption[]>([]);
  const [selectedDepartmentId, setSelectedDepartmentId] = useState("");
  const [selectedPositionId, setSelectedPositionId] = useState("");

  const [employeeQuery, setEmployeeQuery] = useState("");
  const [employeeOptions, setEmployeeOptions] = useState<EmployeeOption[]>([]);
  const [selectedEmployee, setSelectedEmployee] = useState<EmployeeOption | null>(null);
  const [employeeLoading, setEmployeeLoading] = useState(false);

  const [calendarMonth, setCalendarMonth] = useState<Date>(new Date());
  const [selectMode, setSelectMode] = useState<"range" | "single">("range");
  const [rangeStart, setRangeStart] = useState<Date | null>(null);
  const [rangeEnd, setRangeEnd] = useState<Date | null>(null);
  const [selectedDates, setSelectedDates] = useState<Set<string>>(new Set());
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const [holidayMap, setHolidayMap] = useState<Record<string, HolidayItem[]>>({});
  const [holidayLoading, setHolidayLoading] = useState(false);

  useEffect(() => {
    let active = true;
    async function fetchTypes() {
      try {
        const res = await fetch("/api/ngay-nghi/loai");
        if (!res.ok) throw new Error("Không tải được loại ngày nghỉ.");
        const data = (await res.json()) as { items?: HolidayTypeOption[] };
        if (active) setHolidayTypes(data.items ?? []);
      } catch (error: unknown) {
        console.error(error);
        toast.error("Không tải được loại ngày nghỉ.");
      }
    }
    fetchTypes();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    async function fetchDeps() {
      try {
        const res = await fetch("/api/bo-phan");
        if (!res.ok) throw new Error("Không tải bộ phận.");
        const data = (await res.json()) as { items?: DepartmentOption[] };
        if (active) setDepartments(data.items ?? []);
      } catch (error: unknown) {
        console.error(error);
        toast.error("Không tải bộ phận.");
      }
    }
    async function fetchPositions() {
      try {
        const res = await fetch("/api/chuc-vu");
        if (!res.ok) throw new Error("Không tải chức vụ.");
        const data = (await res.json()) as { items?: PositionOption[] };
        if (active) setPositions(data.items ?? []);
      } catch (error: unknown) {
        console.error(error);
        toast.error("Không tải chức vụ.");
      }
    }
    fetchDeps();
    fetchPositions();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (scope !== "EMPLOYEE") {
      setEmployeeQuery("");
      setEmployeeOptions([]);
      setSelectedEmployee(null);
    }
    if (scope !== "DEPARTMENT") setSelectedDepartmentId("");
    if (scope !== "POSITION") setSelectedPositionId("");
  }, [scope]);

  useEffect(() => {
    let active = true;
    const q = employeeQuery.trim();
    if (scope !== "EMPLOYEE" || q.length < 2) {
      setEmployeeOptions([]);
      return;
    }
    const timer = setTimeout(async () => {
      setEmployeeLoading(true);
      try {
        const res = await fetch(`/api/nhan-vien?q=${encodeURIComponent(q)}&page=1&pageSize=20`);
        if (!res.ok) throw new Error("Không tải nhân viên.");
        const data = (await res.json()) as { items?: EmployeeOption[] };
        if (active) setEmployeeOptions(data.items ?? []);
      } catch (error: unknown) {
        console.error(error);
        toast.error("Không tải nhân viên.");
      } finally {
        if (active) setEmployeeLoading(false);
      }
    }, 300);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [employeeQuery, scope]);

  useEffect(() => {
    if (selectMode === "range") {
      setDateFrom(rangeStart ? formatDateOnly(rangeStart) : "");
      setDateTo(rangeEnd ? formatDateOnly(rangeEnd) : "");
    }
  }, [rangeStart, rangeEnd, selectMode]);

  const refreshHolidayMap = useCallback(async () => {
    const monthStart = startOfMonth(calendarMonth);
    const rangeStartDate = new Date(monthStart);
    const rangeEndDate = addMonths(monthStart, 2);
    rangeEndDate.setDate(0);
    const query = new URLSearchParams({
      from: formatDateOnly(rangeStartDate),
      to: formatDateOnly(rangeEndDate),
    });
    const res = await fetch(`/api/ngay-nghi/lich?${query.toString()}`);
    if (!res.ok) throw new Error("Không tải được lịch ngày nghỉ.");
    const data = (await res.json()) as { items?: HolidayItem[] };
    const map: Record<string, HolidayItem[]> = {};
    (data.items ?? []).forEach((item) => {
      if (!map[item.date]) map[item.date] = [];
      map[item.date].push(item);
    });
    setHolidayMap(map);
  }, [calendarMonth]);

  useEffect(() => {
    let active = true;
    setHolidayLoading(true);
    refreshHolidayMap()
      .catch((error: unknown) => {
        console.error(error);
        toast.error("Không tải được lịch ngày nghỉ.");
      })
      .finally(() => {
        if (active) setHolidayLoading(false);
      });
    return () => {
      active = false;
    };
  }, [calendarMonth, refreshHolidayMap]);

  function handleDateSelect(day: Date) {
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

  async function handleCreateHolidays() {
    if (!selectedHolidayTypeId) {
      toast.error("Vui lòng chọn loại ngày nghỉ.");
      return;
    }
    if (selectMode === "range") {
      if (!dateFrom || !dateTo) {
        toast.error("Vui lòng chọn khoảng ngày.");
        return;
      }
    } else if (selectedDates.size === 0) {
      toast.error("Vui lòng chọn ít nhất một ngày.");
      return;
    }

    if (scope === "DEPARTMENT" && !selectedDepartmentId) {
      toast.error("Vui lòng chọn bộ phận.");
      return;
    }
    if (scope === "POSITION" && !selectedPositionId) {
      toast.error("Vui lòng chọn chức vụ.");
      return;
    }
    if (scope === "EMPLOYEE" && !selectedEmployee?.id) {
      toast.error("Vui lòng chọn nhân viên.");
      return;
    }

    try {
      setSubmitting(true);
      const payload: Record<string, unknown> = {
        holidayTypeId: selectedHolidayTypeId,
        scope,
        departmentId: scope === "DEPARTMENT" ? selectedDepartmentId : undefined,
        positionId: scope === "POSITION" ? selectedPositionId : undefined,
        employeeId: scope === "EMPLOYEE" ? selectedEmployee?.id : undefined,
      };
      if (selectMode === "range") {
        payload.startDate = dateFrom;
        payload.endDate = dateTo;
      } else {
        payload.dates = [...selectedDates].sort();
      }
      const res = await fetch("/api/ngay-nghi", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const data = (await res.json()) as { message?: string };
        throw new Error(data.message ?? "Không thể thiết lập ngày nghỉ.");
      }
      const data = (await res.json()) as { created?: number; skipped?: number };
      toast.success(`Đã tạo ${data.created ?? 0} ngày nghỉ, bỏ qua ${data.skipped ?? 0}.`);
      setRangeStart(null);
      setRangeEnd(null);
      setDateFrom("");
      setDateTo("");
      setSelectedDates(new Set());
      await refreshHolidayMap();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Không thể thiết lập ngày nghỉ.";
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  }

  function handleResetSelection() {
    setRangeStart(null);
    setRangeEnd(null);
    setSelectedDates(new Set());
    setDateFrom("");
    setDateTo("");
  }

  return (
    <div className="space-y-4">
      <section className="rounded-lg border bg-white p-4 space-y-4">
        <div>
          <h3 className="text-base font-semibold">Thiết lập ngày nghỉ</h3>
          <p className="text-sm text-muted-foreground">
            Chọn loại ngày nghỉ, phạm vi áp dụng và ngày trên lịch để thiết lập.
          </p>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <div className="space-y-2">
            <label className="text-sm font-medium">Loại ngày nghỉ</label>
            <select
              value={selectedHolidayTypeId}
              onChange={(event) => setSelectedHolidayTypeId(event.target.value)}
              className="rounded-none border border-slate-300 bg-white px-2 py-2 text-sm w-full"
            >
              <option value="">-- Chọn loại --</option>
              {holidayTypes.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name} ({item.payPolicy === "UNPAID" ? "Không lương" : item.payPolicy === "LEAVE" ? "Ngày phép" : "Có lương"})
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Phạm vi áp dụng</label>
            <select
              value={scope}
              onChange={(event) => setScope(event.target.value as typeof scope)}
              className="rounded-none border border-slate-300 bg-white px-2 py-2 text-sm w-full"
            >
              <option value="ALL">Tất cả nhân viên</option>
              <option value="DEPARTMENT">Theo bộ phận</option>
              <option value="POSITION">Theo chức vụ</option>
              <option value="EMPLOYEE">Theo cá nhân</option>
            </select>
          </div>
        </div>

        {scope === "DEPARTMENT" && (
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
          </div>
        )}

        {scope === "POSITION" && (
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
          </div>
        )}

        {scope === "EMPLOYEE" && (
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
      </section>

      <section className="rounded-lg border bg-white p-4 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-base font-semibold">Chọn ngày trên lịch</h3>
            <p className="text-sm text-muted-foreground">
              Chọn theo khoảng hoặc chọn nhiều ngày rời rạc.
            </p>
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
            <Button
              type="button"
              variant={selectMode === "single" ? "default" : "outline"}
              className={selectMode === "single" ? "rounded-none bg-emerald-500 text-white" : "rounded-none"}
              onClick={() => {
                setSelectMode("single");
                setRangeStart(null);
                setRangeEnd(null);
                setDateFrom("");
                setDateTo("");
              }}
            >
              Chọn từng ngày
            </Button>
            <Button
              type="button"
              variant={selectMode === "range" ? "default" : "outline"}
              className={selectMode === "range" ? "rounded-none bg-emerald-500 text-white" : "rounded-none"}
              onClick={() => {
                setSelectMode("range");
                setSelectedDates(new Set());
              }}
            >
              Chọn theo khoảng
            </Button>
            <Button type="button" variant="outline" className="rounded-none" onClick={handleResetSelection}>
              Reset chọn
            </Button>
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <div className="rounded-md border border-slate-200 px-3 py-2 text-sm text-slate-600">
            {selectMode === "range" ? (
              <div>
                Khoảng đã chọn:{" "}
                <span className="font-semibold text-slate-900">
                  {dateFrom && dateTo ? `${dateFrom} → ${dateTo}` : "Chưa chọn"}
                </span>
              </div>
            ) : (
              <div className="flex flex-wrap gap-2">
                {selectedDates.size === 0 ? (
                  <span>Chưa chọn ngày.</span>
                ) : (
                  [...selectedDates]
                    .sort()
                    .map((value) => (
                      <span key={value} className="rounded-full border px-2 py-1 text-xs">
                        {value}
                      </span>
                    ))
                )}
              </div>
            )}
          </div>
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <span className="h-3 w-3 rounded bg-amber-100 border border-amber-200" />
            Ngày nghỉ đã có
            {holidayLoading && <span className="ml-2">Đang tải...</span>}
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
                <div className="border-b px-4 py-3 text-sm font-semibold text-slate-700 capitalize">{title}</div>
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
                    const holidayItems = holidayMap[dayKey] ?? [];
                    const holiday = holidayItems[0];
                    const hasHoliday = holidayItems.length > 0;
                    const holidayLabel =
                      holidayItems.length > 1 ? `${holiday?.name} (+${holidayItems.length - 1})` : holiday?.name ?? "";
                    const isToday = isSameDay(day, new Date());
                    const isSelectedSingle = selectMode === "single" && selectedDates.has(dayKey);
                    const isSelected = isStart || isEnd || isSelectedSingle;
                    return (
                      <button
                        key={dayKey}
                        type="button"
                        onClick={() => handleDateSelect(day)}
                        className={`relative flex h-12 items-center justify-center rounded-md border text-[11px] transition sm:h-14 sm:text-sm ${
                          inMonth
                            ? "border-slate-200 bg-white text-slate-900 hover:border-emerald-300"
                            : "border-transparent text-slate-300"
                        } ${isToday && inMonth ? "!bg-blue-50 !border-blue-200" : ""} ${
                          inRange ? "!bg-emerald-100 !border-emerald-300 !text-emerald-700" : ""
                        } ${isSelected ? "!bg-emerald-500 !text-white !border-emerald-500" : ""}`}
                      >
                        {hasHoliday && !isSelected && (
                          <span
                            className="absolute inset-0 rounded-md opacity-70"
                            style={{
                              backgroundColor: `${holiday?.color ?? "#F59E0B"}1f`,
                              borderColor: `${holiday?.color ?? "#F59E0B"}80`,
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
                        <span className={isSelected ? "relative z-10 font-semibold text-white" : "relative z-10"}>
                          {day.getDate()}
                        </span>
                        {hasHoliday && holidayLabel && (
                          <span
                            className="absolute bottom-1 left-1 right-1 z-10 truncate text-[9px] font-semibold sm:text-[10px]"
                            style={{ color: holiday?.color ?? "#F59E0B" }}
                          >
                            {holidayLabel}
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

        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="outline" className="rounded-none w-full sm:w-auto" onClick={handleResetSelection}>
            Bỏ chọn
          </Button>
          <Button
            className="rounded-none bg-emerald-500 text-white hover:bg-emerald-600 w-full sm:w-auto"
            onClick={handleCreateHolidays}
            disabled={submitting}
          >
            Thiết lập ngày nghỉ
          </Button>
        </div>
      </section>
    </div>
  );
}
