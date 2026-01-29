"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";

type AttendanceItem = {
  id: string;
  date: string;
  plannedName: string | null;
  plannedStart: string | null;
  plannedEnd: string | null;
  checkInAt: string | null;
  checkOutAt: string | null;
  status: string | null;
  lateMinutes: number;
  earlyLeaveMinutes: number;
  overtimeMinutes: number;
  checkInStatus: string | null;
  checkOutStatus: string | null;
};

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

function endOfMonth(date: Date) {
  const next = new Date(date.getFullYear(), date.getMonth() + 1, 1);
  next.setDate(0);
  return next;
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

function formatDate(value: string) {
  return new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(`${value}T00:00:00`));
}

function formatTime(value: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function formatDateTime(value: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(value));
}

function startOfDay(value: Date) {
  return new Date(value.getFullYear(), value.getMonth(), value.getDate());
}

function parseDateOnly(value: string) {
  return new Date(`${value}T00:00:00`);
}

function combineDateTime(dateOnly: string, time: string) {
  const [hours, minutes] = time.split(":").map(Number);
  const base = new Date(`${dateOnly}T00:00:00`);
  base.setHours(hours || 0, minutes || 0, 0, 0);
  return base;
}

function resolveShiftWindow(dateOnly: string, startTime: string, endTime: string) {
  const start = combineDateTime(dateOnly, startTime);
  let end = combineDateTime(dateOnly, endTime);
  if (end.getTime() <= start.getTime()) {
    end = new Date(end.getTime() + 24 * 60 * 60 * 1000);
  }
  return { start, end };
}

function isAutoAbsent(attendance: AttendanceItem, now: Date) {
  if (attendance.checkInAt) return false;
  if (attendance.status) return false;
  if (!attendance.plannedStart || !attendance.plannedEnd) return false;
  const today = startOfDay(now);
  const attendanceDay = startOfDay(parseDateOnly(attendance.date));
  if (attendanceDay.getTime() > today.getTime()) return false;
  const window = resolveShiftWindow(attendance.date, attendance.plannedStart, attendance.plannedEnd);
  return now.getTime() > window.end.getTime();
}

function mapCheckInStatus(value: string | null) {
  if (value === "PENDING") return "Chưa";
  if (value === "MISSED") return "Thiếu";
  if (value === "LATE") return "Trễ";
  if (value === "ON_TIME") return "Đúng";
  return "—";
}

function mapCheckOutStatus(value: string | null) {
  if (value === "PENDING") return "Chưa";
  if (value === "MISSED") return "Thiếu";
  if (value === "OVERTIME") return "Tăng ca";
  if (value === "EARLY") return "Về sớm";
  if (value === "ON_TIME") return "Đúng";
  return "—";
}

function mapAttendanceStatus(value: string | null) {
  if (value === "ABSENT") return "Vắng";
  if (value === "NON_COMPLIANT") return "Không đảm bảo";
  if (value === "OVERTIME") return "Tăng ca";
  if (value === "LATE_AND_EARLY") return "Trễ / Về sớm";
  if (value === "LATE") return "Trễ";
  if (value === "EARLY_LEAVE") return "Về sớm";
  if (value === "PRESENT") return "Đủ";
  return "—";
}

export function AttendanceHistoryClient() {
  const [calendarMonth, setCalendarMonth] = useState<Date>(new Date());
  const [attendanceMap, setAttendanceMap] = useState<Record<string, AttendanceItem>>({});
  const [holidayMap, setHolidayMap] = useState<Record<string, HolidayItem[]>>({});
  const [loading, setLoading] = useState(false);
  const [holidayLoading, setHolidayLoading] = useState(false);
  const [selectedAttendance, setSelectedAttendance] = useState<AttendanceItem | null>(null);
  const [selectedDate, setSelectedDate] = useState<string>("");
  const now = new Date();

  const monthRange = useMemo(() => {
    const from = startOfMonth(calendarMonth);
    const to = endOfMonth(calendarMonth);
    return { from: formatDateOnly(from), to: formatDateOnly(to) };
  }, [calendarMonth]);

  const monthOptions = useMemo(
    () =>
      Array.from({ length: 12 }, (_, idx) => ({
        value: idx,
        label: `Tháng ${idx + 1}`,
      })),
    []
  );

  const yearOptions = useMemo(() => {
    const current = new Date().getFullYear();
    return [current - 1, current, current + 1];
  }, []);

  useEffect(() => {
    let active = true;
    async function fetchAttendance() {
      setLoading(true);
      try {
        const query = new URLSearchParams(monthRange);
        const res = await fetch(`/api/cham-cong/lich-su?${query.toString()}`);
        if (!res.ok) throw new Error("Không tải được lịch sử chấm công.");
        const data = (await res.json()) as { items?: AttendanceItem[] };
        if (!active) return;
        const map: Record<string, AttendanceItem> = {};
        (data.items ?? []).forEach((item) => {
          map[item.date] = item;
        });
        setAttendanceMap(map);
      } catch (error: unknown) {
        console.error(error);
        toast.error("Không tải được lịch sử chấm công.");
      } finally {
        if (active) setLoading(false);
      }
    }

    async function fetchHolidays() {
      setHolidayLoading(true);
      try {
        const query = new URLSearchParams(monthRange);
        const res = await fetch(`/api/ngay-nghi/lich?${query.toString()}`);
        if (!res.ok) throw new Error("Không tải được lịch ngày nghỉ.");
        const data = (await res.json()) as { items?: HolidayItem[] };
        if (!active) return;
        const map: Record<string, HolidayItem[]> = {};
        (data.items ?? []).forEach((item) => {
          if (!map[item.date]) map[item.date] = [];
          map[item.date].push(item);
        });
        setHolidayMap(map);
      } catch (error: unknown) {
        console.error(error);
        toast.error("Không tải được lịch ngày nghỉ.");
      } finally {
        if (active) setHolidayLoading(false);
      }
    }

    fetchAttendance();
    fetchHolidays();
    return () => {
      active = false;
    };
  }, [monthRange]);

  const days = useMemo(() => getCalendarGrid(calendarMonth), [calendarMonth]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-xl font-semibold">Lịch sử chấm công</h2>
          <p className="text-sm text-muted-foreground">Xem chi tiết chấm công theo lịch.</p>
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
          <div className="flex items-center gap-2">
            <select
              value={calendarMonth.getMonth()}
              onChange={(event) => {
                const nextMonth = Number(event.target.value);
                setCalendarMonth(new Date(calendarMonth.getFullYear(), nextMonth, 1));
              }}
              className="rounded-none border border-slate-300 bg-white px-2 py-1.5 text-xs"
            >
              {monthOptions.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
            <select
              value={calendarMonth.getFullYear()}
              onChange={(event) => {
                const nextYear = Number(event.target.value);
                setCalendarMonth(new Date(nextYear, calendarMonth.getMonth(), 1));
              }}
              className="rounded-none border border-slate-300 bg-white px-2 py-1.5 text-xs"
            >
              {yearOptions.map((year) => (
                <option key={year} value={year}>
                  {year}
                </option>
              ))}
            </select>
          </div>
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

      <div className="rounded-lg border bg-white">
        <div className="border-b px-4 py-3 text-sm font-semibold text-slate-700 capitalize">
          {formatMonthTitle(calendarMonth)}
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
            const inMonth = day.getMonth() === calendarMonth.getMonth();
            const dayKey = formatDateOnly(day);
            const attendance = attendanceMap[dayKey];
            const holidayItems = holidayMap[dayKey] ?? [];
            const holiday = holidayItems[0];
            const hasHoliday = holidayItems.length > 0;
            const holidayLabel =
              holidayItems.length > 1 ? `${holiday?.name} (+${holidayItems.length - 1})` : holiday?.name ?? "";
            const holidayLabelShort = toShortLabel(holidayLabel);
            const clickable = !!attendance;
            const isToday =
              day.getFullYear() === new Date().getFullYear() &&
              day.getMonth() === new Date().getMonth() &&
              day.getDate() === new Date().getDate();

            const shouldAutoAbsent = attendance ? isAutoAbsent(attendance, now) : false;
            const isAbsent = attendance?.status === "ABSENT" || (!attendance?.status && shouldAutoAbsent);

            return (
              <button
                key={dayKey}
                type="button"
                onClick={() => {
                  if (!attendance) return;
                  setSelectedAttendance(attendance);
                  setSelectedDate(dayKey);
                }}
                className={`relative flex h-20 flex-col items-center justify-center rounded-md border text-[11px] transition ${
                  inMonth
                    ? attendance
                      ? isAbsent
                        ? "border-rose-200 bg-rose-50 text-slate-900"
                        : "border-emerald-200 bg-emerald-50 text-slate-900"
                      : "border-slate-200 bg-white text-slate-900"
                    : "border-transparent text-slate-300"
                } ${isToday && inMonth ? "bg-blue-50! border-blue-200!" : ""} ${
                  clickable ? (isAbsent ? "cursor-pointer hover:border-rose-300" : "cursor-pointer hover:border-emerald-300") : "cursor-default"
                }`}
              >
                {hasHoliday && inMonth && (
                  <span
                    className="absolute inset-0 rounded-md opacity-60"
                    style={{
                      backgroundColor: `${holiday?.color ?? "#F59E0B"}1f`,
                      borderColor: `${holiday?.color ?? "#F59E0B"}80`,
                    }}
                  />
                )}
                {isToday && inMonth && (
                  <span className="absolute top-1 left-1 right-1 text-[10px] font-semibold text-blue-700">
                    Hôm nay
                  </span>
                )}
                <span className="relative z-10 text-sm font-semibold">{day.getDate()}</span>
                {attendance ? (
                  isAbsent ? (
                    <span className="relative z-10 mt-1 text-[10px] font-semibold text-rose-600">
                      Vắng
                    </span>
                  ) : (
                    <>
                      <span className="relative z-10 mt-1 text-[10px] font-semibold text-emerald-700">
                        IN {formatTime(attendance.checkInAt)} · OUT {formatTime(attendance.checkOutAt)}
                      </span>
                      <span className="relative z-10 mt-0.5 text-[9px] text-slate-600">
                        {mapCheckInStatus(attendance.checkInStatus)} / {mapCheckOutStatus(attendance.checkOutStatus)}
                      </span>
                    </>
                  )
                ) : null}
                {hasHoliday && holidayLabel && (
                  <>
                    <span className="relative z-10 mt-1 text-[9px] font-semibold text-amber-700 sm:hidden">
                      {holidayLabelShort}
                    </span>
                    <span className="relative z-10 mt-1 text-[9px] font-semibold text-amber-700 hidden sm:block">
                      {holidayLabel}
                    </span>
                  </>
                )}
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500">
        <div className="flex items-center gap-2">
          <span className="h-3 w-3 rounded bg-emerald-100 border border-emerald-200" />
          Có chấm công
        </div>
        <div className="flex items-center gap-2">
          <span className="h-3 w-3 rounded bg-amber-100 border border-amber-200" />
          Ngày nghỉ
        </div>
        {(loading || holidayLoading) && <div>Đang tải lịch...</div>}
      </div>

      <Dialog open={!!selectedAttendance} onOpenChange={(open) => (!open ? setSelectedAttendance(null) : null)}>
        <DialogContent className="rounded-none">
          <DialogHeader>
            <DialogTitle>Chi tiết chấm công</DialogTitle>
            <DialogDescription>Thông tin chấm công trong ngày bạn đã chọn.</DialogDescription>
          </DialogHeader>
          {selectedAttendance && (
            <div className="space-y-2 text-sm text-slate-700">
              <div>
                Ngày: <span className="font-semibold text-slate-900">{formatDate(selectedDate)}</span>
              </div>
              <div>
                Ca làm: <span className="font-semibold text-slate-900">{selectedAttendance.plannedName ?? "—"}</span>
              </div>
              <div>
                Giờ làm:{" "}
                <span className="font-semibold text-slate-900">
                  {selectedAttendance.plannedStart && selectedAttendance.plannedEnd
                    ? `${selectedAttendance.plannedStart} - ${selectedAttendance.plannedEnd}`
                    : "—"}
                </span>
              </div>
              <div>
                Check-in: <span className="font-semibold text-slate-900">{formatDateTime(selectedAttendance.checkInAt)}</span>
              </div>
              <div>
                Check-out: <span className="font-semibold text-slate-900">{formatDateTime(selectedAttendance.checkOutAt)}</span>
              </div>
              <div>
                Trạng thái:{" "}
                <span className="font-semibold text-slate-900">
                  {mapAttendanceStatus(
                    selectedAttendance.status
                      ? selectedAttendance.status
                      : isAutoAbsent(selectedAttendance, now)
                        ? "ABSENT"
                        : selectedAttendance.status
                  )}
                </span>
              </div>
              <div>
                Trễ: <span className="font-semibold text-slate-900">{selectedAttendance.lateMinutes} phút</span>
              </div>
              <div>
                Về sớm: <span className="font-semibold text-slate-900">{selectedAttendance.earlyLeaveMinutes} phút</span>
              </div>
              <div>
                Tăng ca: <span className="font-semibold text-slate-900">{selectedAttendance.overtimeMinutes} phút</span>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
