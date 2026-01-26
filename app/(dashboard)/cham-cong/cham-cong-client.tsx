"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { FlipClock } from "@/components/ui/flip-clock";
import { toast } from "sonner";

type ScheduleInfo = {
  id: string;
  date: string;
  name: string;
  startTime: string;
  endTime: string;
  breakMinutes: number;
  lateGraceMinutes: number;
  earlyGraceMinutes: number;
};

type AttendanceInfo = {
  id: string;
  checkInAt: string | null;
  checkOutAt: string | null;
  status?: string | null;
  workMinutes?: number;
  lateMinutes?: number;
  earlyLeaveMinutes?: number;
  overtimeMinutes?: number;
  checkInStatus?: "PENDING" | "MISSED" | "ON_TIME" | "LATE" | null;
  checkOutStatus?: "PENDING" | "MISSED" | "ON_TIME" | "EARLY" | "OVERTIME" | null;
};

type AttendanceState = {
  schedule: ScheduleInfo | null;
  record: AttendanceInfo | null;
  summary?: {
    plannedMinutes: number;
    actualMinutes: number;
    lateMinutes: number;
    earlyLeaveMinutes: number;
    overtimeMinutes: number;
    checkInStatus: string;
    checkOutStatus: string;
  } | null;
  allowCheckIn: boolean;
  allowCheckOut: boolean;
  nextAllowedCheckInAt: string | null;
};

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

function resolveShiftMinutes(date: string, startTime: string, endTime: string) {
  const [y, m, d] = date.split("-").map(Number);
  const [startH, startM] = startTime.split(":").map(Number);
  const [endH, endM] = endTime.split(":").map(Number);
  const start = new Date(y, (m ?? 1) - 1, d ?? 1, startH || 0, startM || 0, 0, 0);
  let end = new Date(y, (m ?? 1) - 1, d ?? 1, endH || 0, endM || 0, 0, 0);
  if (end.getTime() <= start.getTime()) {
    end = new Date(end.getTime() + 24 * 60 * 60 * 1000);
  }
  return Math.max(0, Math.round((end.getTime() - start.getTime()) / 60000));
}

function mapCheckInStatus(value?: string | null) {
  if (value === "PENDING") return "Chưa";
  if (value === "MISSED") return "Thiếu";
  if (value === "LATE") return "Trễ giờ";
  if (value === "ON_TIME") return "Đúng giờ";
  return "Đúng giờ";
}

function mapCheckOutStatus(value?: string | null) {
  if (value === "PENDING") return "Chưa";
  if (value === "MISSED") return "Thiếu";
  if (value === "EARLY") return "Về sớm";
  if (value === "OVERTIME") return "Tăng ca";
  if (value === "ON_TIME") return "Đúng giờ";
  return "Đúng giờ";
}

export function ChamCongClient() {
  const [now, setNow] = useState(new Date());
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [data, setData] = useState<AttendanceState | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    let timer: number;
    const tick = () => {
      const next = new Date();
      setNow(next);
      const delay = 1000 - (next.getTime() % 1000);
      timer = window.setTimeout(tick, Math.max(50, delay));
    };
    const initialDelay = 1000 - (Date.now() % 1000);
    timer = window.setTimeout(tick, initialDelay);
    return () => window.clearTimeout(timer);
  }, []);

  async function fetchState() {
    setLoading(true);
    try {
      const res = await fetch("/api/cham-cong");
      if (!res.ok) throw new Error("Không tải được dữ liệu chấm công.");
      const json = (await res.json()) as AttendanceState;
      setData(json);
    } catch (error: unknown) {
      console.error(error);
      toast.error("Không tải được dữ liệu chấm công.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchState();
  }, []);

  const clockHours = useMemo(() => now.getHours().toString().padStart(2, "0"), [now]);
  const clockMinutes = useMemo(() => now.getMinutes().toString().padStart(2, "0"), [now]);
  const clockSeconds = useMemo(() => now.getSeconds().toString().padStart(2, "0"), [now]);
  const dateLabel = useMemo(
    () =>
      new Intl.DateTimeFormat("vi-VN", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      }).format(now),
    [now]
  );

  async function handleAction(action: "checkin" | "checkout") {
    try {
      setSubmitting(true);
      const res = await fetch("/api/cham-cong", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      let payload: { message?: string } = {};
      const contentType = res.headers.get("content-type") ?? "";
      if (contentType.includes("application/json")) {
        payload = (await res.json()) as { message?: string };
      }
      if (!res.ok) {
        toast.error(payload.message ?? "Không thể chấm công.");
        return;
      }
      toast.success(action === "checkin" ? "Đã check-in." : "Đã check-out.");
      await fetchState();
    } catch (error: unknown) {
      console.error(error);
      toast.error("Không thể chấm công.");
    } finally {
      setSubmitting(false);
    }
  }

  const record = data?.record;
  const summary = data?.summary;
  const plannedMinutes = data?.schedule
    ? resolveShiftMinutes(data.schedule.date, data.schedule.startTime, data.schedule.endTime)
    : 0;
  const actualMinutes = summary?.actualMinutes ?? (record?.checkOutAt ? record.workMinutes ?? 0 : 0);
  const overtimeMinutes = summary?.overtimeMinutes ?? (record?.checkOutAt ? record.overtimeMinutes ?? 0 : 0);
  const checkoutStatusPreview = useMemo(() => {
    if (!data?.schedule) return "—";
    const [y, m, d] = data.schedule.date.split("-").map(Number);
    const [endH, endM] = data.schedule.endTime.split(":").map(Number);
    const [startH, startM] = data.schedule.startTime.split(":").map(Number);
    const start = new Date(y, (m ?? 1) - 1, d ?? 1, startH || 0, startM || 0, 0, 0);
    let end = new Date(y, (m ?? 1) - 1, d ?? 1, endH || 0, endM || 0, 0, 0);
    if (end.getTime() <= start.getTime()) {
      end = new Date(end.getTime() + 24 * 60 * 60 * 1000);
    }
    const earlyBoundary = new Date(end.getTime() - (data.schedule.earlyGraceMinutes ?? 0) * 60000);
    if (now.getTime() > end.getTime()) return "Tăng ca";
    if (now.getTime() < earlyBoundary.getTime()) return "Về sớm";
    return "Đúng giờ";
  }, [data?.schedule, now]);

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-semibold">Chấm công</h2>
        <p className="text-sm text-muted-foreground">Check-in và check-out theo ca làm hôm nay.</p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-lg border bg-white p-4 sm:p-5">
          <div className="text-sm text-slate-500">Thời gian hiện tại</div>
          <div className="mt-3 flex w-full flex-col items-center gap-2 overflow-hidden">
            {mounted ? (
              <FlipClock className="clock-large" hours={clockHours} minutes={clockMinutes} seconds={clockSeconds} />
            ) : (
              <div className="flip-clock clock-large" aria-hidden="true">
                <span className="text-slate-500">--:--:--</span>
              </div>
            )}
            <div className="flex flex-col items-center justify-center text-center text-sm text-slate-600">
              <div className="text-xs uppercase tracking-widest text-slate-400">Ngày</div>
              <div className="font-semibold text-slate-900">{mounted ? dateLabel : "—"}</div>
            </div>
          </div>
        </div>

        <div className="rounded-lg border bg-white p-4 sm:p-5 space-y-2">
          <div className="text-sm text-slate-500">Ca làm hôm nay</div>
          {loading ? (
            <div className="text-sm text-slate-500">Đang tải...</div>
          ) : data?.schedule ? (
            <div className="space-y-2 text-sm text-slate-700">
              <div className="font-semibold text-slate-900">{data.schedule.name}</div>
              <div className="grid gap-2 sm:grid-cols-2">
                <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
                  <div className="text-xs text-slate-500">Giờ làm</div>
                  <div className="font-semibold text-slate-900">
                    {data.schedule.startTime} - {data.schedule.endTime}
                  </div>
                </div>
                <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
                  <div className="text-xs text-slate-500">Nghỉ giữa ca</div>
                  <div className="font-semibold text-slate-900">{data.schedule.breakMinutes} phút</div>
                </div>
                <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
                  <div className="text-xs text-slate-500">Cho phép trễ</div>
                  <div className="font-semibold text-slate-900">{data.schedule.lateGraceMinutes} phút</div>
                </div>
                <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
                  <div className="text-xs text-slate-500">Cho phép về sớm</div>
                  <div className="font-semibold text-slate-900">{data.schedule.earlyGraceMinutes} phút</div>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-sm text-slate-500">Chưa có ca làm hôm nay.</div>
          )}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-lg border bg-white p-4 sm:p-5 space-y-3">
          <div className="text-sm font-medium text-slate-800">Check-in / Check-out</div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-md border border-slate-200 bg-slate-50 p-3 text-sm">
              <div className="text-slate-500">Check-in</div>
              <div className="font-semibold text-slate-900">{formatDateTime(record?.checkInAt ?? null)}</div>
            </div>
            <div className="rounded-md border border-slate-200 bg-slate-50 p-3 text-sm">
              <div className="text-slate-500">Check-out</div>
              <div className="font-semibold text-slate-900">{formatDateTime(record?.checkOutAt ?? null)}</div>
            </div>
          </div>

          {data?.nextAllowedCheckInAt && !record?.checkInAt && (
            <div className="text-xs text-slate-500">
              Bạn có thể check-in từ: {formatDateTime(data.nextAllowedCheckInAt)}
            </div>
          )}

          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          {data?.allowCheckOut && (
            <Button
              className="w-full rounded-none bg-emerald-500 text-white hover:bg-emerald-600 sm:w-auto"
              onClick={() => setConfirmOpen(true)}
              disabled={submitting}
            >
              Check-out
            </Button>
          )}
          {data?.allowCheckIn && (
            <Button
              className="w-full rounded-none bg-emerald-500 text-white hover:bg-emerald-600 sm:w-auto"
              onClick={() => handleAction("checkin")}
              disabled={submitting}
            >
              Check-in
            </Button>
          )}
          {!data?.allowCheckIn && !data?.allowCheckOut && (
            <Button className="w-full rounded-none sm:w-auto" variant="outline" disabled>
              {record?.checkOutAt ? "Đã hoàn tất ca" : "Chưa đến giờ check-in"}
            </Button>
          )}
          </div>
        </div>

        <div className="rounded-lg border bg-white p-4 sm:p-5 space-y-3">
          <div className="text-sm font-medium text-slate-800">Tổng kết ca làm</div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-md border border-slate-200 bg-white p-3 text-sm">
              <div className="text-slate-500">Thời lượng ca chuẩn</div>
              <div className="font-semibold text-slate-900">
                {data?.schedule ? `${plannedMinutes} phút` : "—"}
              </div>
            </div>
            <div className="rounded-md border border-slate-200 bg-white p-3 text-sm">
              <div className="text-slate-500">Thời gian làm thực tế</div>
              <div className="font-semibold text-slate-900">
                {record?.checkOutAt ? `${actualMinutes} phút` : "—"}
              </div>
            </div>
            <div className="rounded-md border border-slate-200 bg-white p-3 text-sm">
              <div className="text-slate-500">Trạng thái check-in</div>
              <div className="font-semibold text-slate-900">
                {record?.checkInAt ? mapCheckInStatus(record.checkInStatus ?? summary?.checkInStatus ?? null) : "Chưa check-in"}
              </div>
            </div>
            <div className="rounded-md border border-slate-200 bg-white p-3 text-sm">
              <div className="text-slate-500">Trạng thái check-out</div>
              <div className="font-semibold text-slate-900">
                {record?.checkOutAt
                  ? mapCheckOutStatus(record.checkOutStatus ?? summary?.checkOutStatus ?? null)
                  : "Chưa check-out"}
              </div>
            </div>
            <div className="rounded-md border border-slate-200 bg-white p-3 text-sm sm:col-span-2">
              <div className="text-slate-500">Tổng thời gian tăng ca</div>
              <div className="font-semibold text-slate-900">
                {record?.checkOutAt ? `${overtimeMinutes} phút` : "—"}
              </div>
            </div>
          </div>
        </div>
      </div>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="rounded-none">
          <DialogHeader>
            <DialogTitle>Xác nhận check-out</DialogTitle>
            <DialogDescription>Kiểm tra lại thời gian check-out trước khi xác nhận.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 text-sm text-slate-700">
            <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
              <div className="text-slate-500">Thời gian check-out</div>
              <div className="font-semibold text-slate-900">{formatDateTime(now.toISOString())}</div>
            </div>
            <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
              <div className="text-slate-500">Trạng thái check-out</div>
              <div className="font-semibold text-slate-900">{checkoutStatusPreview}</div>
            </div>
          </div>
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button variant="outline" className="rounded-none" onClick={() => setConfirmOpen(false)}>
              Hủy
            </Button>
            <Button
              className="rounded-none bg-emerald-500 text-white hover:bg-emerald-600"
              onClick={async () => {
                await handleAction("checkout");
                setConfirmOpen(false);
              }}
              disabled={submitting}
            >
              Xác nhận check-out
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
