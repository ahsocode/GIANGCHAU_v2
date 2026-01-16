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

export function LichLamClient() {
  const [calendarMonth, setCalendarMonth] = useState<Date>(new Date());
  const [scheduleMap, setScheduleMap] = useState<Record<string, ScheduleItem>>({});
  const [shiftOptions, setShiftOptions] = useState<ShiftItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedSchedule, setSelectedSchedule] = useState<ScheduleItem | null>(null);
  const [selectedDate, setSelectedDate] = useState<string>("");

  const monthRange = useMemo(() => {
    const from = startOfMonth(calendarMonth);
    const to = endOfMonth(calendarMonth);
    return { from: formatDateOnly(from), to: formatDateOnly(to) };
  }, [calendarMonth]);

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
    fetchShifts();
    fetchSchedules();
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
          <span className="rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
            Hôm nay: {new Intl.DateTimeFormat("vi-VN").format(new Date())}
          </span>
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
                }`}
              >
                {isToday && inMonth && (
                  <span className="absolute top-1 left-1 right-1 text-[10px] font-semibold text-blue-700">
                    Hôm nay
                  </span>
                )}
                <span className="text-sm font-semibold">{day.getDate()}</span>
                {schedule && (
                  <span className="mt-1 truncate text-[10px] font-medium text-amber-800">
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
        {loading && <div>Đang tải lịch...</div>}
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
