"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

type TongHopData = {
  profile: {
    name: string;
    positionName: string | null;
    departmentName: string | null;
    code: string | null;
    personalEmail: string | null;
    phone: string | null;
    joinedAt: string | null;
    employmentType: "CT" | "TV";
    accountEmail: string;
  };
  summary: {
    scheduleCount: number;
    statusMap: Record<string, number>;
    now: string;
  };
  upcomingSchedules: {
    date: string;
    plannedName: string | null;
    plannedStart: string | null;
    plannedEnd: string | null;
  }[];
  recentAttendance: {
    date: string;
    status: string | null;
    checkInAt: string | null;
    checkOutAt: string | null;
    plannedName: string | null;
    plannedStart: string | null;
    plannedEnd: string | null;
  }[];
  upcomingLeaves: {
    id: string;
    type: string;
    status: string;
    startDate: string;
    endDate: string;
  }[];
};

function formatDate(value: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(`${value}T00:00:00`));
}

function formatShortDate(value: string) {
  return new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit",
    month: "2-digit",
  }).format(new Date(`${value}T00:00:00`));
}

function formatTimeRange(start: string | null, end: string | null) {
  if (!start || !end) return "—";
  return `${start} - ${end}`;
}

function formatClock(value: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function mapAttendanceStatus(value: string | null) {
  if (value === "ABSENT") return "Vắng";
  if (value === "NON_COMPLIANT") return "Không đảm bảo";
  if (value === "OVERTIME") return "Tăng ca";
  if (value === "LATE_AND_EARLY") return "Trễ / Về sớm";
  if (value === "LATE") return "Trễ";
  if (value === "EARLY_LEAVE") return "Về sớm";
  if (value === "PRESENT") return "Đủ";
  if (value === "INCOMPLETE") return "Chưa hoàn tất";
  return "—";
}

function mapLeaveType(value: string) {
  if (value === "ANNUAL") return "Phép năm";
  if (value === "SICK") return "Ốm";
  if (value === "UNPAID") return "Nghỉ không lương";
  return "Khác";
}

function mapLeaveStatus(value: string) {
  if (value === "APPROVED") return "Đã duyệt";
  if (value === "REJECTED") return "Từ chối";
  if (value === "SUBMITTED") return "Chờ duyệt";
  if (value === "CANCELLED") return "Đã hủy";
  return "Nháp";
}

export default function TongHopPage() {
  const [data, setData] = useState<TongHopData | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        const res = await fetch("/api/tong-hop");
        if (!res.ok) {
          const err = await res.json().catch(() => null);
          throw new Error(err?.message || "Không tải được dữ liệu tổng hợp");
        }
        const json = (await res.json()) as TongHopData;
        setData(json);
      } catch (error) {
        console.error(error);
        toast.error(error instanceof Error ? error.message : "Không tải được dữ liệu tổng hợp");
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, []);

  const statusMap = data?.summary.statusMap ?? {};
  const presentCount =
    (statusMap.PRESENT ?? 0) +
    (statusMap.LATE ?? 0) +
    (statusMap.EARLY_LEAVE ?? 0) +
    (statusMap.LATE_AND_EARLY ?? 0) +
    (statusMap.OVERTIME ?? 0) +
    (statusMap.NON_COMPLIANT ?? 0);
  const absentCount = statusMap.ABSENT ?? 0;
  const lateCount = (statusMap.LATE ?? 0) + (statusMap.LATE_AND_EARLY ?? 0);
  const overtimeCount = statusMap.OVERTIME ?? 0;
  const incompleteCount = statusMap.INCOMPLETE ?? 0;
  const profile = data?.profile;

  const heading = useMemo(() => profile?.name ?? "Tổng hợp cá nhân", [profile]);

  return (
    <div className="space-y-6">
      <div className="rounded-none border border-slate-200 bg-white p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm text-slate-500">Tổng hợp cá nhân</p>
            <h1 className="text-2xl font-semibold text-slate-900">{heading}</h1>
            <p className="text-sm text-slate-500">
              {profile?.positionName ?? "Chưa cập nhật chức vụ"} • {profile?.departmentName ?? "Chưa cập nhật bộ phận"}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button asChild className="rounded-none bg-emerald-500 text-white hover:bg-emerald-600">
              <Link href="/cham-cong">Chấm công ngay</Link>
            </Button>
            <Button asChild variant="outline" className="rounded-none">
              <Link href="/lich-lam">Xem lịch làm</Link>
            </Button>
            <Button asChild variant="outline" className="rounded-none">
              <Link href="/ho-so">Hồ sơ</Link>
            </Button>
          </div>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-none border border-slate-200 bg-white p-4">
            <div className="text-sm text-slate-500">Lịch làm tháng này</div>
            <div className="text-2xl font-semibold text-slate-900">{data?.summary.scheduleCount ?? 0}</div>
            <div className="text-xs text-slate-500">Tính đến {formatDate(data?.summary.now ?? null)}</div>
          </div>
          <div className="rounded-none border border-slate-200 bg-white p-4">
            <div className="text-sm text-slate-500">Ngày đi làm</div>
            <div className="text-2xl font-semibold text-slate-900">{presentCount}</div>
            <div className="text-xs text-slate-500">Bao gồm tăng ca và vi phạm</div>
          </div>
          <div className="rounded-none border border-slate-200 bg-white p-4">
            <div className="text-sm text-slate-500">Vắng mặt</div>
            <div className="text-2xl font-semibold text-slate-900">{absentCount}</div>
            <div className="text-xs text-slate-500">Trong tháng hiện tại</div>
          </div>
          <div className="rounded-none border border-slate-200 bg-white p-4">
            <div className="text-sm text-slate-500">Trễ giờ</div>
            <div className="text-2xl font-semibold text-slate-900">{lateCount}</div>
            <div className="text-xs text-slate-500">Tổng số lần trễ</div>
          </div>
        </div>

        <div className="rounded-none border border-slate-200 bg-white p-4 space-y-4">
          <div>
            <div className="text-sm text-slate-500">Ca sắp tới</div>
            <div className="text-base font-semibold text-slate-900">3 ca gần nhất</div>
          </div>
          <div className="space-y-3">
            {loading ? (
              <div className="text-sm text-slate-500">Đang tải...</div>
            ) : data?.upcomingSchedules?.length ? (
              data.upcomingSchedules.map((item) => (
                <div
                  key={`${item.date}-${item.plannedStart ?? ""}`}
                  className="rounded-none border border-slate-100 bg-slate-50 p-3"
                >
                  <div className="text-sm font-semibold text-slate-900">{item.plannedName ?? "Ca làm"}</div>
                  <div className="text-xs text-slate-500">
                    {formatDate(item.date)} • {formatTimeRange(item.plannedStart, item.plannedEnd)}
                  </div>
                </div>
              ))
            ) : (
              <div className="text-sm text-slate-500">Chưa có lịch làm sắp tới.</div>
            )}
          </div>
          <div className="border-t border-slate-100 pt-3 text-xs text-slate-500">
            Tăng ca: {overtimeCount} • Chưa hoàn tất: {incompleteCount}
          </div>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.2fr_1fr]">
        <div className="rounded-none border border-slate-200 bg-white p-4 space-y-4">
          <div>
            <h2 className="text-base font-semibold text-slate-900">Lịch sử chấm công gần đây</h2>
            <p className="text-xs text-slate-500">5 ngày gần nhất có dữ liệu.</p>
          </div>
          <div className="divide-y divide-slate-100">
            {loading ? (
              <div className="text-sm text-slate-500 py-3">Đang tải...</div>
            ) : data?.recentAttendance?.length ? (
              data.recentAttendance.map((record) => (
                <div key={record.date} className="py-3 flex items-center justify-between gap-4">
                  <div>
                    <div className="text-sm font-semibold text-slate-900">
                      {record.plannedName ?? "Ca làm"} • {formatShortDate(record.date)}
                    </div>
                    <div className="text-xs text-slate-500">
                      {formatTimeRange(record.plannedStart, record.plannedEnd)}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-semibold text-slate-900">{mapAttendanceStatus(record.status)}</div>
                    <div className="text-xs text-slate-500">
                      IN {formatClock(record.checkInAt)} · OUT {formatClock(record.checkOutAt)}
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-sm text-slate-500 py-3">Chưa có dữ liệu chấm công.</div>
            )}
          </div>
          <div className="flex justify-end">
            <Button asChild variant="outline" className="rounded-none">
              <Link href="/cham-cong/lich-su">Xem chi tiết</Link>
            </Button>
          </div>
        </div>

        <div className="rounded-none border border-slate-200 bg-white p-4 space-y-4">
          <div>
            <h2 className="text-base font-semibold text-slate-900">Yêu cầu nghỉ sắp tới</h2>
            <p className="text-xs text-slate-500">Theo dõi trạng thái các đơn nghỉ.</p>
          </div>
          <div className="space-y-3">
            {loading ? (
              <div className="text-sm text-slate-500">Đang tải...</div>
            ) : data?.upcomingLeaves?.length ? (
              data.upcomingLeaves.map((leave) => (
                <div key={leave.id} className="rounded-none border border-slate-100 bg-slate-50 p-3">
                  <div className="text-sm font-semibold text-slate-900">{mapLeaveType(leave.type)}</div>
                  <div className="text-xs text-slate-500">
                    {formatDate(leave.startDate)} - {formatDate(leave.endDate)}
                  </div>
                  <div className="text-xs text-slate-500">Trạng thái: {mapLeaveStatus(leave.status)}</div>
                </div>
              ))
            ) : (
              <div className="text-sm text-slate-500">Chưa có đơn nghỉ.</div>
            )}
          </div>
          <div className="text-xs text-slate-500 border-t border-slate-100 pt-3">
            Cần duyệt thêm? Liên hệ quản lý hoặc HR.
          </div>
        </div>
      </div>

      <div className="rounded-none border border-slate-200 bg-white p-4">
        <h2 className="text-base font-semibold text-slate-900 mb-3">Thông tin cá nhân</h2>
        <div className="grid gap-3 text-sm text-slate-700 sm:grid-cols-2">
          <div className="flex items-center justify-between gap-3">
            <span className="text-slate-500">Mã nhân viên</span>
            <span className="font-semibold">{profile?.code ?? "—"}</span>
          </div>
          <div className="flex items-center justify-between gap-3">
            <span className="text-slate-500">Email công ty</span>
            <span className="font-semibold">{profile?.accountEmail ?? "—"}</span>
          </div>
          <div className="flex items-center justify-between gap-3">
            <span className="text-slate-500">Email cá nhân</span>
            <span className="font-semibold">{profile?.personalEmail ?? "—"}</span>
          </div>
          <div className="flex items-center justify-between gap-3">
            <span className="text-slate-500">Điện thoại</span>
            <span className="font-semibold">{profile?.phone ?? "—"}</span>
          </div>
          <div className="flex items-center justify-between gap-3">
            <span className="text-slate-500">Ngày vào làm</span>
            <span className="font-semibold">{formatDate(profile?.joinedAt ?? null)}</span>
          </div>
          <div className="flex items-center justify-between gap-3">
            <span className="text-slate-500">Loại nhân viên</span>
            <span className="font-semibold">{profile?.employmentType === "TV" ? "Thời vụ" : "Chính thức"}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
