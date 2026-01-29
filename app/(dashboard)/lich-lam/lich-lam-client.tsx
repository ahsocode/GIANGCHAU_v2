"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";

type ScheduleItem = {
  date: string;
  name: string;
  startTime: string;
  endTime: string;
};

type ShiftItem = {
  id: string;
  code: string;
  name: string;
  startTime: string;
  endTime: string;
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

export function LichLamClient() {
  const [calendarMonth, setCalendarMonth] = useState<Date>(new Date());
  const [scheduleMap, setScheduleMap] = useState<Record<string, ScheduleItem>>({});
  const [holidayMap, setHolidayMap] = useState<Record<string, HolidayItem[]>>({});
  const [shiftOptions, setShiftOptions] = useState<ShiftItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [holidayLoading, setHolidayLoading] = useState(false);
  const [selectedSchedule, setSelectedSchedule] = useState<ScheduleItem | null>(null);
  const [selectedDate, setSelectedDate] = useState<string>("");

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
    async function fetchShifts() {
      try {
        const res = await fetch("/api/ca-lam");
        if (!res.ok) throw new Error("Không tải được danh sách ca.");
        const data = (await res.json()) as { items?: ShiftItem[] };
        if (!active) return;
        setShiftOptions(data.items ?? []);
      } catch (error: unknown) {
        console.error(error);
        toast.error("Không tải được danh sách ca.");
      }
    }

    async function fetchSchedules() {
      setLoading(true);
      try {
        const query = new URLSearchParams(monthRange);
        const res = await fetch(`/api/lich-lam?${query.toString()}`);
        if (!res.ok) throw new Error("Không tải được lịch làm.");
        const data = (await res.json()) as { items?: ScheduleItem[] };
        if (!active) return;
        const map: Record<string, ScheduleItem> = {};
        (data.items ?? []).forEach((item) => {
          map[item.date] = item;
        });
        setScheduleMap(map);
      } catch (error: unknown) {
        console.error(error);
        toast.error("Không tải được lịch làm.");
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
    fetchShifts();
    fetchSchedules();
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
          <h2 className="text-xl font-semibold">Lịch làm của tôi</h2>
          <p className="text-sm text-muted-foreground">Xem lịch ca làm theo tháng.</p>
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

      <div className="rounded-lg border bg-white p-4">
        <h3 className="text-sm font-semibold text-slate-800">Các ca làm hiện có</h3>
        <p className="text-xs text-slate-500">Danh sách ca làm để bạn đối chiếu lịch cá nhân.</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {shiftOptions.length === 0 ? (
            <span className="text-xs text-slate-500">Chưa có dữ liệu ca làm.</span>
          ) : (
            shiftOptions.map((shift) => (
              <span
                key={shift.id}
                className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700"
              >
                {shift.code} · {shift.name} ({shift.startTime}-{shift.endTime})
              </span>
            ))
          )}
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
            const schedule = scheduleMap[dayKey];
            const holidayItems = holidayMap[dayKey] ?? [];
            const holiday = holidayItems[0];
            const hasHoliday = holidayItems.length > 0;
            const hasConflict = hasHoliday && !!schedule;
            const holidayLabel =
              holidayItems.length > 1 ? `${holiday?.name} (+${holidayItems.length - 1})` : holiday?.name ?? "";
            const conflictLabelFull =
              holidayLabel && schedule?.name ? `${holidayLabel} / ${schedule.name}` : schedule?.name ?? holidayLabel;
            const conflictLabelShort =
              holidayLabel && schedule?.name
                ? `${toShortLabel(holidayLabel)} / ${toShortLabel(schedule.name)}`
                : toShortLabel(schedule?.name ?? holidayLabel ?? "");
            const clickable = !!schedule;
            const isToday =
              day.getFullYear() === new Date().getFullYear() &&
              day.getMonth() === new Date().getMonth() &&
              day.getDate() === new Date().getDate();
            return (
              <button
                key={dayKey}
                type="button"
                onClick={() => {
                  if (!schedule) return;
                  setSelectedSchedule(schedule);
                  setSelectedDate(dayKey);
                }}
                className={`relative flex h-16 flex-col items-center justify-center rounded-md border text-sm transition ${
                  inMonth
                    ? schedule
                      ? "border-amber-200 bg-amber-100 text-slate-900"
                      : "border-slate-200 bg-white text-slate-900"
                    : "border-transparent text-slate-300"
                } ${isToday && inMonth ? "!bg-blue-50 !border-blue-200" : ""} ${
                  clickable ? "cursor-pointer hover:border-amber-300" : "cursor-default"
                } ${hasConflict && inMonth ? "!border-red-500 !bg-amber-100" : ""}`}
              >
                {hasHoliday && !hasConflict && inMonth && (
                  <span
                    className="absolute inset-0 rounded-md opacity-70"
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
                {hasConflict && conflictLabelFull && (
                  <>
                    <span className="relative z-10 mt-1 px-0.5 text-center text-[8px] font-semibold leading-tight text-red-600 sm:hidden">
                      {conflictLabelShort}
                    </span>
                    <span className="relative z-10 mt-1 px-0.5 text-center text-[9px] font-semibold leading-snug text-red-600 hidden sm:block">
                      {conflictLabelFull}
                    </span>
                  </>
                )}
                {hasHoliday && !hasConflict && holidayLabel && (
                  <span
                    className="relative z-10 mt-1 truncate text-[10px] font-semibold"
                    style={{ color: holiday?.color ?? "#F59E0B" }}
                  >
                    {holidayLabel}
                  </span>
                )}
                {!hasConflict && schedule && (
                  <span className="relative z-10 mt-1 truncate text-[10px] font-medium text-amber-800">
                    {schedule.name} {schedule.startTime}-{schedule.endTime}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500">
        <div className="flex items-center gap-2">
          <span className="h-3 w-3 rounded bg-amber-100 border border-amber-200" />
          Ngày có ca làm
        </div>
        <div className="flex items-center gap-2">
          <span className="h-3 w-3 rounded bg-amber-100 border border-amber-200" />
          Ngày nghỉ
        </div>
        {(loading || holidayLoading) && <div>Đang tải lịch...</div>}
      </div>

      <Dialog open={!!selectedSchedule} onOpenChange={(open) => (!open ? setSelectedSchedule(null) : null)}>
        <DialogContent className="rounded-none">
          <DialogHeader>
            <DialogTitle>Chi tiết ca làm</DialogTitle>
            <DialogDescription>Thông tin ca làm trong ngày bạn đã chọn.</DialogDescription>
          </DialogHeader>
          {selectedSchedule && (
            <div className="space-y-2 text-sm text-slate-700">
              <div>
                Ngày:{" "}
                <span className="font-semibold text-slate-900">
                  {selectedDate
                    ? new Intl.DateTimeFormat("vi-VN").format(new Date(`${selectedDate}T00:00:00`))
                    : "—"}
                </span>
              </div>
              <div>
                Ca làm: <span className="font-semibold text-slate-900">{selectedSchedule.name}</span>
              </div>
              <div>
                Giờ làm:{" "}
                <span className="font-semibold text-slate-900">
                  {selectedSchedule.startTime} - {selectedSchedule.endTime}
                </span>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
