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

type ShiftOption = {
  id: string;
  code: string;
  name: string;
  startTime: string;
  endTime: string;
  status: "ACTIVE" | "ARCHIVED";
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

function parseDateOnly(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return null;
  const parsed = new Date(Date.UTC(year, month - 1, day));
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function getDatesBetween(start: Date, end: Date) {
  const dates: Date[] = [];
  const current = new Date(start);
  while (current <= end) {
    dates.push(new Date(current));
    current.setUTCDate(current.getUTCDate() + 1);
  }
  return dates;
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

export function PhanCaClient() {
  const [employeeQuery, setEmployeeQuery] = useState("");
  const [employeeOptions, setEmployeeOptions] = useState<EmployeeOption[]>([]);
  const [employeeLoading, setEmployeeLoading] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<EmployeeOption | null>(null);

  const [shiftOptions, setShiftOptions] = useState<ShiftOption[]>([]);
  const [shiftLoading, setShiftLoading] = useState(false);
  const [selectedShiftId, setSelectedShiftId] = useState<string>("");

  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [rangeStart, setRangeStart] = useState<Date | null>(null);
  const [rangeEnd, setRangeEnd] = useState<Date | null>(null);
  const [selectMode, setSelectMode] = useState<"range" | "single">("range");
  const [calendarMonth, setCalendarMonth] = useState<Date>(new Date());
  const [scheduleMap, setScheduleMap] = useState<Record<string, string>>({});
  const [scheduleLoading, setScheduleLoading] = useState(false);
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
    const q = employeeQuery.trim();
    if (q.length < 2) {
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
  }, [employeeQuery]);

  const selectedShift = useMemo(
    () => shiftOptions.find((item) => item.id === selectedShiftId) ?? null,
    [shiftOptions, selectedShiftId]
  );

  useEffect(() => {
    if (rangeStart) setDateFrom(formatDateOnly(rangeStart));
    if (rangeEnd) setDateTo(formatDateOnly(rangeEnd));
  }, [rangeStart, rangeEnd]);

  const refreshScheduleMap = useCallback(async (employeeId: string) => {
    const monthStart = startOfMonth(calendarMonth);
    const rangeStartDate = new Date(monthStart);
    const rangeEndDate = addMonths(monthStart, 2);
    rangeEndDate.setDate(0);
    const query = new URLSearchParams({
      employeeId,
      from: formatDateOnly(rangeStartDate),
      to: formatDateOnly(rangeEndDate),
    });
    const res = await fetch(`/api/phan-ca/lich?${query.toString()}`);
    if (!res.ok) throw new Error("Không tải được lịch phân ca.");
    const data = (await res.json()) as { items?: Array<{ date: string; name?: string | null }> };
    const map: Record<string, string> = {};
    (data.items ?? []).forEach((item) => {
      if (item.date) map[item.date] = item.name ?? "";
    });
    setScheduleMap(map);
  }, [calendarMonth]);

  useEffect(() => {
    const employeeId = selectedEmployee?.id;
    if (!employeeId) {
      setScheduleMap({});
      return;
    }
    let active = true;
    setScheduleLoading(true);
    refreshScheduleMap(employeeId)
      .catch((error: unknown) => {
        console.error(error);
        toast.error("Không tải được lịch phân ca.");
      })
      .finally(() => {
        if (active) setScheduleLoading(false);
      });
    return () => {
      active = false;
    };
  }, [calendarMonth, refreshScheduleMap, selectedEmployee?.id]);

  function handleDateSelect(day: Date) {
    if (selectMode === "single") {
      setRangeStart(new Date(day));
      setRangeEnd(new Date(day));
      return;
    }
    if (!rangeStart || (rangeStart && rangeEnd)) {
      setRangeStart(new Date(day));
      setRangeEnd(null);
      return;
    }
    if (rangeStart && !rangeEnd) {
      if (day < rangeStart) {
        setRangeStart(new Date(day));
        return;
      }
      setRangeEnd(new Date(day));
    }
  }

  function toggleWeekday(value: string) {
    setSelectedWeekdays((prev) =>
      prev.includes(value) ? prev.filter((item) => item !== value) : [...prev, value]
    );
  }

  async function handleCreateSchedules() {
    if (!selectedEmployee) {
      toast.error("Vui lòng chọn nhân viên.");
      return;
    }
    if (!selectedShiftId) {
      toast.error("Vui lòng chọn ca làm.");
      return;
    }
    if (!dateFrom || !dateTo) {
      toast.error("Vui lòng chọn khoảng thời gian.");
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

    try {
      setSubmitting(true);
      setScheduleLoading(true);
      const res = await fetch("/api/phan-ca", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          employeeId: selectedEmployee.id,
          workShiftId: selectedShiftId,
          startDate: dateFrom,
          endDate: dateTo,
          weekdays: weekdayNumbers,
          overwrite: overwriteExisting,
        }),
      });
      if (!res.ok) {
        const data = (await res.json()) as { message?: string };
        throw new Error(data.message ?? "Không thể tạo lịch phân ca.");
      }
      const data = (await res.json()) as { created?: number; updated?: number; skipped?: number };
      toast.success(
        `Đã tạo ${data.created ?? 0} lịch, cập nhật ${data.updated ?? 0}, bỏ qua ${data.skipped ?? 0}.`
      );

      const start = parseDateOnly(dateFrom);
      const end = parseDateOnly(dateTo);
      if (start && end && selectedShift) {
        const selectedDays = getDatesBetween(start, end).filter((date) =>
          weekdayNumbers.length > 0 ? weekdayNumbers.includes(date.getUTCDay()) : true
        );
        setScheduleMap((prev) => {
          const next = { ...prev };
          selectedDays.forEach((date) => {
            const key = formatDateOnly(date);
            next[key] = selectedShift.name;
          });
          return next;
        });
      }

      setRangeStart(null);
      setRangeEnd(null);
      setDateFrom("");
      setDateTo("");
      setSelectedWeekdays([]);
      if (selectedEmployee?.id) {
        await refreshScheduleMap(selectedEmployee.id);
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
    if (!selectedEmployee) {
      toast.error("Vui lòng chọn nhân viên.");
      return;
    }
    if (!dateFrom || !dateTo) {
      toast.error("Vui lòng chọn khoảng thời gian.");
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

    try {
      setSubmitting(true);
      const res = await fetch("/api/phan-ca/remove", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          employeeId: selectedEmployee.id,
          workShiftId: selectedShiftId || undefined,
          startDate: dateFrom,
          endDate: dateTo,
          weekdays: weekdayNumbers,
        }),
      });
      if (!res.ok) {
        const data = (await res.json()) as { message?: string };
        throw new Error(data.message ?? "Không thể gỡ ca làm.");
      }
      const data = (await res.json()) as { deleted?: number };
      toast.success(`Đã gỡ ${data.deleted ?? 0} lịch phân ca.`);

      if (selectedEmployee?.id) {
        await refreshScheduleMap(selectedEmployee.id);
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
              <label className="text-sm font-medium">Khoảng thời gian</label>
              <div className="grid gap-2 sm:grid-cols-2">
                <Input value={dateFrom} readOnly placeholder="Ngày bắt đầu" className="rounded-none" />
                <Input value={dateTo} readOnly placeholder="Ngày kết thúc" className="rounded-none" />
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <div className="text-sm font-medium">Chọn ngày trên lịch</div>
                <div className="text-xs text-slate-500">
                  {selectMode === "range"
                    ? "Click chọn ngày bắt đầu và kết thúc như lịch booking."
                    : "Click chọn một ngày cụ thể."}
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
                  Hôm nay: {new Intl.DateTimeFormat("vi-VN").format(new Date())}
                </span>
                <Button
                  type="button"
                  variant="outline"
                  className={`rounded-none ${selectMode === "single" ? "border-emerald-500 text-emerald-700" : ""}`}
                  onClick={() => {
                    setSelectMode("single");
                    setRangeEnd(rangeStart);
                  }}
                >
                  Chọn từng ngày
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className={`rounded-none ${selectMode === "range" ? "border-emerald-500 text-emerald-700" : ""}`}
                  onClick={() => setSelectMode("range")}
                >
                  Chọn theo khoảng
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="rounded-none"
                  onClick={() => setCalendarMonth(addMonths(calendarMonth, -1))}
                >
                  Tháng trước
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="rounded-none"
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
                    className="rounded-lg border bg-white"
                  >
                    <div className="border-b px-4 py-3 text-sm font-semibold text-slate-700 capitalize">
                      {title}
                    </div>
                    <div className="grid grid-cols-7 gap-3 px-4 py-3 text-xs text-slate-500">
                      {weekdayLabels.map((label) => (
                        <div key={label} className="text-center">
                          {label}
                        </div>
                      ))}
                    </div>
                    <div className="grid grid-cols-7 gap-3 px-4 pb-4">
                      {days.map((day) => {
                        const inMonth = day.getMonth() === month.getMonth();
                        const dayKey = formatDateOnly(day);
                        const isStart = startKey ? dayKey === startKey : false;
                        const isEnd = endKey ? dayKey === endKey : false;
                        const inRange =
                          !!startKey && !!endKey && dayKey > startKey && dayKey < endKey;
                        const hasShift = !!scheduleMap[dayKey];
                        const shiftName = scheduleMap[dayKey];
                        const isToday = isSameDay(day, new Date());
                        const isSelected = isStart || isEnd;
                        return (
                          <button
                            key={dayKey}
                            type="button"
                            onClick={() => handleDateSelect(day)}
                            className={`relative flex h-14 items-center justify-center rounded-md border text-sm transition ${
                              inMonth
                                ? "border-slate-200 bg-white text-slate-900 hover:border-emerald-300"
                                : "border-transparent text-slate-300"
                            } ${
                              isToday && inMonth ? "!bg-blue-50 !border-blue-200" : ""
                            } ${inRange ? "!bg-emerald-100 !border-emerald-300 !text-emerald-700" : ""} ${
                              isStart || isEnd ? "!bg-emerald-500 !text-white !border-emerald-500" : ""
                            }`}
                            title={
                              hasShift
                                ? "Ngày này đã có ca làm"
                                : inMonth
                                  ? "Chọn ngày"
                                  : ""
                            }
                          >
                            {hasShift && (
                              <span className="absolute inset-0 rounded-md bg-amber-100 opacity-70" />
                            )}
                            {isToday && inMonth && (
                              <span className="absolute top-1 left-1 right-1 z-10 text-[10px] font-semibold text-blue-700">
                                Hôm nay
                              </span>
                            )}
                            <span
                              className={
                                isSelected
                                  ? "relative z-10 font-semibold text-white"
                                  : isToday && inMonth
                                    ? "relative z-10 font-semibold text-emerald-600"
                                    : "relative z-10"
                              }
                            >
                              {day.getDate()}
                            </span>
                            {hasShift && shiftName && (
                              <span className="absolute bottom-1 left-1 right-1 z-10 truncate text-[10px] font-medium text-amber-700">
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
                <span className="h-3 w-3 rounded bg-emerald-100 border border-emerald-200" />
                Khoảng đang chọn
              </div>
              {scheduleLoading && <div>Đang tải lịch...</div>}
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
              {dateFrom || "—"} → {dateTo || "—"}
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
