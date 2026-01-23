"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Shuffle, FilePenLine, CalendarClock, ClipboardCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

type RequestType = "shift" | "profile" | "leave" | "attendance" | null;
type ShiftOption = { id: string; name: string; code: string };
type ScheduleItem = {
  date: string;
  shiftId: string;
  shiftName: string;
  shiftCode: string;
};
type AttendanceInfo = {
  schedule: {
    name: string;
    startTime: string;
    endTime: string;
    breakMinutes: number;
  } | null;
  attendance: {
    checkInAt: string | null;
    checkOutAt: string | null;
    status: string | null;
    checkInStatus: string | null;
    checkOutStatus: string | null;
  } | null;
};

function formatDateTime(value: string | null | undefined) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(value));
}

function RequestCard({
  title,
  description,
  icon: Icon,
  onCreate,
}: {
  title: string;
  description: string;
  icon: typeof Shuffle;
  onCreate: () => void;
}) {
  return (
    <div className="rounded-none border border-slate-200 bg-white p-5 space-y-3">
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-none bg-emerald-50 text-emerald-600 flex items-center justify-center">
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <h3 className="text-base font-semibold text-slate-900">{title}</h3>
          <p className="text-sm text-slate-500">{description}</p>
        </div>
      </div>
      <div className="flex justify-end">
        <Button
          type="button"
          className="rounded-none bg-emerald-500 text-white hover:bg-emerald-600"
          onClick={onCreate}
        >
          Tạo yêu cầu
        </Button>
      </div>
    </div>
  );
}

export default function EmployeeRequestsClient() {
  const [open, setOpen] = useState<RequestType>(null);
  const [shiftOptions, setShiftOptions] = useState<ShiftOption[]>([]);
  const [shiftDate, setShiftDate] = useState("");
  const [desiredShiftId, setDesiredShiftId] = useState("");
  const [shiftReason, setShiftReason] = useState("");
  const [profileField, setProfileField] = useState("");
  const [profileValue, setProfileValue] = useState("");
  const [profileReason, setProfileReason] = useState("");
  const [profileCurrentValue, setProfileCurrentValue] = useState("");
  const [leaveFrom, setLeaveFrom] = useState("");
  const [leaveTo, setLeaveTo] = useState("");
  const [leaveType, setLeaveType] = useState("");
  const [leaveReason, setLeaveReason] = useState("");
  const [leaveMode, setLeaveMode] = useState<"single" | "range">("single");
  const [attendanceDate, setAttendanceDate] = useState("");
  const [attendanceField, setAttendanceField] = useState("");
  const [attendanceValue, setAttendanceValue] = useState("");
  const [attendanceReason, setAttendanceReason] = useState("");
  const [submitting, setSubmitting] = useState<RequestType>(null);
  const [scheduleMap, setScheduleMap] = useState<Record<string, ScheduleItem>>({});
  const [scheduleLoading, setScheduleLoading] = useState(false);
  const [benefitTotal, setBenefitTotal] = useState(0);
  const [benefitUsed, setBenefitUsed] = useState(0);
  const [serverToday, setServerToday] = useState("");
  const [serverTomorrow, setServerTomorrow] = useState("");
  const [attendanceHistoryDates, setAttendanceHistoryDates] = useState<string[]>([]);
  const [attendanceLoading, setAttendanceLoading] = useState(false);
  const [attendanceInfo, setAttendanceInfo] = useState<AttendanceInfo | null>(null);
  const [attendanceInfoLoading, setAttendanceInfoLoading] = useState(false);

  const closeDialog = () => setOpen(null);

  const minShiftDate = useMemo(() => serverTomorrow || "", [serverTomorrow]);

  const profileOptions = useMemo(
    () => [
      { value: "ACCOUNT_EMAIL", label: "Email tài khoản" },
      { value: "PHONE", label: "Số điện thoại" },
      { value: "CITIZEN_ID", label: "CCCD/CMND" },
      { value: "SOCIAL_INSURANCE", label: "BHXH" },
    ],
    []
  );

  const attendanceOptions = useMemo(
    () => [
      { value: "CHECK_IN_TIME", label: "Giờ vào" },
      { value: "CHECK_OUT_TIME", label: "Giờ ra" },
    ],
    []
  );

  useEffect(() => {
    const loadShifts = async () => {
      try {
        const res = await fetch("/api/ca-lam");
        if (!res.ok) throw new Error("Không tải được danh sách ca làm.");
        const data = (await res.json()) as { items?: ShiftOption[] };
        setShiftOptions(data.items ?? []);
      } catch (error) {
        console.error(error);
        toast.error("Không tải được danh sách ca làm.");
      }
    };
    loadShifts();
  }, []);

  useEffect(() => {
    const loadServerTime = async () => {
      try {
        const res = await fetch("/api/time");
        if (!res.ok) throw new Error("Không tải được thời gian hệ thống.");
        const data = (await res.json()) as { today?: string; tomorrow?: string };
        setServerToday(data.today ?? "");
        setServerTomorrow(data.tomorrow ?? "");
      } catch (error) {
        console.error(error);
        toast.error("Không tải được thời gian hệ thống.");
      }
    };
    loadServerTime();
  }, []);

  useEffect(() => {
    if (!profileField) {
      setProfileCurrentValue("");
      return;
    }
    const loadProfile = async () => {
      try {
        const res = await fetch("/api/ho-so");
        if (!res.ok) throw new Error("Không tải được thông tin hiện tại.");
        const data = (await res.json()) as {
          item?: { account?: { email?: string | null }; employee?: { phone?: string | null; citizenIdNumber?: string | null; socialInsuranceNumber?: string | null } };
        };
        const current =
          profileField === "ACCOUNT_EMAIL"
            ? data.item?.account?.email ?? ""
            : profileField === "PHONE"
              ? data.item?.employee?.phone ?? ""
              : profileField === "CITIZEN_ID"
                ? data.item?.employee?.citizenIdNumber ?? ""
                : profileField === "SOCIAL_INSURANCE"
                  ? data.item?.employee?.socialInsuranceNumber ?? ""
                  : "";
        setProfileCurrentValue(current);
      } catch (error) {
        console.error(error);
        toast.error("Không tải được thông tin hiện tại.");
        setProfileCurrentValue("");
      }
    };
    loadProfile();
  }, [profileField]);

  const formatDateOnlyUtc = (value: Date) => {
    const year = value.getUTCFullYear();
    const month = `${value.getUTCMonth() + 1}`.padStart(2, "0");
    const day = `${value.getUTCDate()}`.padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  useEffect(() => {
    if (open !== "attendance") return;
    if (!serverToday) return;
    const loadAttendanceHistory = async () => {
      setAttendanceLoading(true);
      try {
        const todayValue = serverToday;
        const todayUtc = new Date(`${serverToday}T00:00:00Z`);
        const toDate = new Date(
          Date.UTC(todayUtc.getUTCFullYear(), todayUtc.getUTCMonth(), todayUtc.getUTCDate() - 1)
        );
        const fromDate = new Date(
          Date.UTC(toDate.getUTCFullYear(), toDate.getUTCMonth() - 2, 1)
        );
        const fromParam = formatDateOnlyUtc(fromDate);
        const toParam = formatDateOnlyUtc(toDate);
        const res = await fetch(`/api/lich-lam?from=${fromParam}&to=${toParam}`);
        if (!res.ok) throw new Error("Không tải được lịch làm.");
        const data = (await res.json()) as { items?: { date: string; workShiftId?: string | null }[] };
        const items = Array.isArray(data.items) ? data.items : [];
        const pastScheduleDates = items
          .filter((item) => !!item.workShiftId)
          .map((item) => item.date)
          .filter((date) => date < todayValue)
          .sort();
        setAttendanceHistoryDates(pastScheduleDates);
        const latest = pastScheduleDates[pastScheduleDates.length - 1] ?? "";
        setAttendanceDate(latest);
      } catch (error) {
        console.error(error);
        toast.error("Không tải được lịch làm.");
        setAttendanceHistoryDates([]);
        setAttendanceDate("");
      } finally {
        setAttendanceLoading(false);
      }
    };
    loadAttendanceHistory();
  }, [open, serverToday]);

  useEffect(() => {
    if (!attendanceDate) {
      setAttendanceInfo(null);
      return;
    }
    const loadInfo = async () => {
      setAttendanceInfoLoading(true);
      try {
        const res = await fetch(`/api/yeu-cau/cham-cong-info?date=${attendanceDate}`);
        if (!res.ok) throw new Error("Không tải được thông tin chấm công.");
        const data = (await res.json()) as AttendanceInfo;
        setAttendanceInfo(data);
      } catch (error) {
        console.error(error);
        toast.error("Không tải được thông tin chấm công.");
        setAttendanceInfo(null);
      } finally {
        setAttendanceInfoLoading(false);
      }
    };
    loadInfo();
  }, [attendanceDate]);

  useEffect(() => {
    const loadBenefit = async () => {
      try {
        const res = await fetch("/api/yeu-cau/thong-ke");
        if (!res.ok) throw new Error("Không tải được quyền lợi đổi ca.");
        const data = (await res.json()) as { totalShiftChangeCount?: number; usedShiftChangeCount?: number };
        setBenefitTotal(data.totalShiftChangeCount ?? 0);
        setBenefitUsed(data.usedShiftChangeCount ?? 0);
      } catch (error) {
        console.error(error);
        toast.error("Không tải được quyền lợi đổi ca.");
      }
    };
    loadBenefit();
  }, []);

  useEffect(() => {
    if (!shiftDate) {
      setDesiredShiftId("");
      return;
    }
    const loadSchedule = async () => {
      setScheduleLoading(true);
      try {
        const dateObj = new Date(`${shiftDate}T00:00:00`);
        const from = new Date(dateObj.getFullYear(), dateObj.getMonth(), 1);
        const to = new Date(dateObj.getFullYear(), dateObj.getMonth() + 1, 0);
        const fromParam = from.toISOString().slice(0, 10);
        const toParam = to.toISOString().slice(0, 10);
        const res = await fetch(`/api/lich-lam?from=${fromParam}&to=${toParam}`);
        if (!res.ok) throw new Error("Không tải được lịch làm.");
        const data = (await res.json()) as {
          items?: { date: string; name: string; startTime: string; endTime: string; workShiftId?: string };
        };
        const items = Array.isArray(data.items) ? data.items : [];
        const nextMap: Record<string, ScheduleItem> = {};
        items.forEach((item) => {
          if (!item.workShiftId) return;
          nextMap[item.date] = {
            date: item.date,
            shiftId: item.workShiftId,
            shiftName: item.name,
            shiftCode: item.startTime && item.endTime ? `${item.startTime}-${item.endTime}` : "Ca",
          };
        });
        setScheduleMap(nextMap);
        const schedule = nextMap[shiftDate];
        setDesiredShiftId((prev) => {
          if (!schedule) return "";
          return schedule.shiftId === prev ? "" : prev;
        });
      } catch (error) {
        console.error(error);
        toast.error("Không tải được lịch làm.");
        setScheduleMap({});
        setDesiredShiftId("");
      } finally {
        setScheduleLoading(false);
      }
    };
    loadSchedule();
  }, [shiftDate]);

  useEffect(() => {
    if (open !== "shift") return;
    if (!serverTomorrow) return;
    setShiftDate(serverTomorrow);
    setDesiredShiftId("");
  }, [open, serverTomorrow]);

  useEffect(() => {
    if (open !== "leave") return;
    if (!serverTomorrow) return;
    setLeaveMode("single");
    setLeaveFrom(serverTomorrow);
    setLeaveTo(serverTomorrow);
  }, [open, serverTomorrow]);

  async function submitShiftRequest() {
    if (!shiftDate || !desiredShiftId) {
      toast.error("Vui lòng nhập đủ thông tin đổi ca.");
      return;
    }
    if (serverTomorrow && shiftDate < serverTomorrow) {
      toast.error("Không thể yêu cầu đổi ca cho hôm nay hoặc ngày trong quá khứ.");
      setShiftDate(serverTomorrow);
      return;
    }
    if (!scheduleMap[shiftDate]) {
      toast.error("Ngày này chưa có ca làm.");
      return;
    }
    setSubmitting("shift");
    try {
      const res = await fetch("/api/yeu-cau/doi-ca", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date: shiftDate,
          desiredShiftId,
          reason: shiftReason || null,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => null);
        throw new Error(err?.message || "Không thể gửi yêu cầu đổi ca.");
      }
      toast.success("Đã gửi yêu cầu đổi ca.");
      setShiftDate("");
      setDesiredShiftId("");
      setShiftReason("");
      closeDialog();
    } catch (error) {
      console.error(error);
      toast.error(error instanceof Error ? error.message : "Không thể gửi yêu cầu đổi ca.");
    } finally {
      setSubmitting(null);
    }
  }

  async function submitProfileRequest() {
    if (!profileField || !profileValue) {
      toast.error("Vui lòng nhập đủ thông tin cập nhật.");
      return;
    }
    setSubmitting("profile");
    try {
      const res = await fetch("/api/yeu-cau/cap-nhat-thong-tin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          field: profileField,
          newValue: profileValue,
          reason: profileReason || null,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => null);
        throw new Error(err?.message || "Không thể gửi yêu cầu cập nhật.");
      }
      toast.success("Đã gửi yêu cầu cập nhật thông tin.");
      setProfileField("");
      setProfileValue("");
      setProfileReason("");
      setProfileCurrentValue("");
      closeDialog();
    } catch (error) {
      console.error(error);
      toast.error(error instanceof Error ? error.message : "Không thể gửi yêu cầu cập nhật.");
    } finally {
      setSubmitting(null);
    }
  }

  async function submitLeaveRequest() {
    const fromValue = leaveFrom;
    const toValue = leaveMode === "single" ? leaveFrom : leaveTo;
    if (!fromValue || !toValue || !leaveType) {
      toast.error("Vui lòng nhập đủ thông tin nghỉ phép.");
      return;
    }
    if (serverTomorrow && (fromValue < serverTomorrow || toValue < serverTomorrow)) {
      toast.error("Không thể chọn ngày hôm nay hoặc trong quá khứ.");
      return;
    }
    if (fromValue > toValue) {
      toast.error("Khoảng ngày không hợp lệ.");
      return;
    }
    setSubmitting("leave");
    try {
      const res = await fetch("/api/yeu-cau/nghi-phep", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          from: fromValue,
          to: toValue,
          type: leaveType,
          reason: leaveReason || null,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => null);
        throw new Error(err?.message || "Không thể gửi yêu cầu nghỉ phép.");
      }
      toast.success("Đã gửi yêu cầu nghỉ phép.");
      setLeaveFrom("");
      setLeaveTo("");
      setLeaveType("");
      setLeaveReason("");
      closeDialog();
    } catch (error) {
      console.error(error);
      toast.error(error instanceof Error ? error.message : "Không thể gửi yêu cầu nghỉ phép.");
    } finally {
      setSubmitting(null);
    }
  }

  async function submitAttendanceRequest() {
    if (!attendanceDate || !attendanceField || !attendanceValue) {
      toast.error("Vui lòng nhập đủ thông tin điều chỉnh chấm công.");
      return;
    }
    if (serverToday && attendanceDate >= serverToday) {
      toast.error("Không thể chọn ngày hôm nay hoặc tương lai.");
      setAttendanceDate(attendanceHistoryDates[attendanceHistoryDates.length - 1] || "");
      return;
    }
    if (attendanceHistoryDates.length === 0) {
      toast.error("Chưa có ca làm trong quá khứ để điều chỉnh.");
      return;
    }
    if (!attendanceHistoryDates.includes(attendanceDate)) {
      toast.error("Chỉ được chọn ngày đã có ca làm trong quá khứ.");
      return;
    }
    setSubmitting("attendance");
    try {
      const res = await fetch("/api/yeu-cau/dieu-chinh-cham-cong", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date: attendanceDate,
          field: attendanceField,
          newValue: attendanceValue,
          reason: attendanceReason || null,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => null);
        throw new Error(err?.message || "Không thể gửi yêu cầu điều chỉnh.");
      }
      toast.success("Đã gửi yêu cầu điều chỉnh chấm công.");
      setAttendanceDate("");
      setAttendanceField("");
      setAttendanceValue("");
      setAttendanceReason("");
      closeDialog();
    } catch (error) {
      console.error(error);
      toast.error(error instanceof Error ? error.message : "Không thể gửi yêu cầu điều chỉnh.");
    } finally {
      setSubmitting(null);
    }
  }

  return (
    <div className="space-y-5 w-full">
      <div>
        <h2 className="text-xl font-semibold">Yêu cầu của nhân viên</h2>
        <p className="text-sm text-muted-foreground">
          Tạo yêu cầu đổi ca, cập nhật thông tin cá nhân hoặc sử dụng ngày phép.
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-3 rounded-none border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600">
          <div>
            Lượt đổi ca:{" "}
            <span className="font-semibold text-slate-900">
              {Math.max(0, benefitTotal - benefitUsed)}
            </span>{" "}
            / <span className="font-semibold text-slate-900">{benefitTotal}</span>
          </div>
          <div className="text-slate-400">•</div>
          <Link href="/yeu-cau/lich-su" className="text-emerald-600 hover:text-emerald-700">
            Xem lịch sử yêu cầu
          </Link>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <RequestCard
          title="Yêu cầu đổi ca"
          description="Đổi ca theo ngày hoặc theo khoảng thời gian."
          icon={Shuffle}
          onCreate={() => setOpen("shift")}
        />
        <RequestCard
          title="Cập nhật thông tin"
          description="Đề xuất chỉnh sửa thông tin cá nhân cần duyệt."
          icon={FilePenLine}
          onCreate={() => setOpen("profile")}
        />
        <RequestCard
          title="Xin nghỉ phép"
          description="Đăng ký nghỉ phép có lương hoặc không lương."
          icon={CalendarClock}
          onCreate={() => setOpen("leave")}
        />
        <RequestCard
          title="Điều chỉnh chấm công"
          description="Yêu cầu chỉnh giờ vào/ra hoặc trạng thái."
          icon={ClipboardCheck}
          onCreate={() => setOpen("attendance")}
        />
      </div>

      <Dialog open={open === "shift"} onOpenChange={(value) => setOpen(value ? "shift" : null)}>
        <DialogContent className="rounded-none">
          <DialogHeader>
            <DialogTitle>Yêu cầu đổi ca</DialogTitle>
            <DialogDescription>Điền thông tin ca hiện tại và ca muốn đổi.</DialogDescription>
          </DialogHeader>
          <form
            className="space-y-4 text-sm text-slate-700"
            onSubmit={(event) => {
              event.preventDefault();
              submitShiftRequest();
            }}
          >
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="flex flex-col gap-2">
                Ngày làm
                <Input
                  type="date"
                  className="rounded-none"
                  value={shiftDate}
                  onChange={(e) => {
                    const value = e.target.value;
                    if (serverTomorrow && value && value < serverTomorrow) {
                      toast.error("Không thể chọn ngày hôm nay hoặc trong quá khứ.");
                      setShiftDate(serverTomorrow);
                      return;
                    }
                    setShiftDate(value);
                  }}
                  min={minShiftDate}
                  required
                />
              </label>
              <label className="flex flex-col gap-2">
                Ca hiện tại
                <Input
                  className="rounded-none"
                  value={
                    scheduleMap[shiftDate]
                      ? `${scheduleMap[shiftDate].shiftName} (${scheduleMap[shiftDate].shiftCode})`
                      : scheduleLoading
                        ? "Đang tải ca..."
                        : "Chưa có ca"
                  }
                  readOnly
                />
              </label>
            </div>
            <label className="flex flex-col gap-2">
              Ca mong muốn
              <select
                className="rounded-none border border-slate-300 bg-white px-3 py-2 text-sm"
                value={desiredShiftId}
                onChange={(e) => setDesiredShiftId(e.target.value)}
                disabled={!scheduleMap[shiftDate]}
                required
              >
                <option value="">-- Chọn ca --</option>
                {shiftOptions.map((item) => {
                  const current = scheduleMap[shiftDate]?.shiftId;
                  const disabled = current ? item.id === current : false;
                  return (
                    <option key={item.id} value={item.id} disabled={disabled}>
                      {item.name} ({item.code})
                    </option>
                  );
                })}
              </select>
            </label>
            <label className="flex flex-col gap-2">
              Lý do
              <textarea
                className="min-h-22.5 w-full rounded-none border border-slate-300 bg-white px-3 py-2 text-sm"
                placeholder="Nhập lý do đổi ca"
                value={shiftReason}
                onChange={(e) => setShiftReason(e.target.value)}
                required
              />
            </label>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" className="rounded-none" onClick={closeDialog}>
                Đóng
              </Button>
              <Button
                type="submit"
                className="rounded-none bg-emerald-500 text-white hover:bg-emerald-600"
                disabled={submitting === "shift"}
              >
                {submitting === "shift" ? "Đang gửi..." : "Gửi yêu cầu"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={open === "profile"} onOpenChange={(value) => setOpen(value ? "profile" : null)}>
        <DialogContent className="rounded-none">
          <DialogHeader>
            <DialogTitle>Yêu cầu cập nhật thông tin</DialogTitle>
            <DialogDescription>Thông tin sẽ được HR duyệt trước khi thay đổi.</DialogDescription>
          </DialogHeader>
          <form
            className="space-y-4 text-sm text-slate-700"
            onSubmit={(event) => {
              event.preventDefault();
              submitProfileRequest();
            }}
          >
            <label className="flex flex-col gap-2">
              Loại thông tin
              <select
                className="rounded-none border border-slate-300 bg-white px-3 py-2 text-sm"
                value={profileField}
                onChange={(e) => setProfileField(e.target.value)}
                required
              >
                <option value="">-- Chọn loại --</option>
                {profileOptions.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-2">
              Thông tin hiện tại
              <Input
                className="rounded-none"
                value={profileCurrentValue || "—"}
                readOnly
                disabled
              />
            </label>
            <label className="flex flex-col gap-2">
              Thông tin mới
              <Input
                placeholder="Nhập thông tin mới"
                className="rounded-none"
                value={profileValue}
                onChange={(e) => setProfileValue(e.target.value)}
                required
              />
            </label>
            <label className="flex flex-col gap-2">
              Lý do
              <textarea
                className="min-h-22.5 w-full rounded-none border border-slate-300 bg-white px-3 py-2 text-sm"
                placeholder="Nhập lý do cập nhật"
                value={profileReason}
                onChange={(e) => setProfileReason(e.target.value)}
                required
              />
            </label>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" className="rounded-none" onClick={closeDialog}>
                Đóng
              </Button>
              <Button
                type="submit"
                className="rounded-none bg-emerald-500 text-white hover:bg-emerald-600"
                disabled={submitting === "profile"}
              >
                {submitting === "profile" ? "Đang gửi..." : "Gửi yêu cầu"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={open === "leave"} onOpenChange={(value) => setOpen(value ? "leave" : null)}>
        <DialogContent className="rounded-none">
          <DialogHeader>
            <DialogTitle>Yêu cầu nghỉ phép</DialogTitle>
            <DialogDescription>Chọn thời gian nghỉ và loại nghỉ phép.</DialogDescription>
          </DialogHeader>
          <form
            className="space-y-4 text-sm text-slate-700"
            onSubmit={(event) => {
              event.preventDefault();
              submitLeaveRequest();
            }}
          >
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className={`rounded-none border px-3 py-1 text-xs font-semibold ${
                  leaveMode === "single"
                    ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                    : "border-slate-200 text-slate-600"
                }`}
                onClick={() => {
                  setLeaveMode("single");
                  if (leaveFrom) setLeaveTo(leaveFrom);
                }}
              >
                Theo ngày
              </button>
              <button
                type="button"
                className={`rounded-none border px-3 py-1 text-xs font-semibold ${
                  leaveMode === "range"
                    ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                    : "border-slate-200 text-slate-600"
                }`}
                onClick={() => setLeaveMode("range")}
              >
                Theo khoảng
              </button>
            </div>

            {leaveMode === "single" ? (
              <label className="flex flex-col gap-2">
                Ngày nghỉ
                <Input
                  type="date"
                  className="rounded-none"
                  value={leaveFrom}
                  onChange={(e) => {
                    const value = e.target.value;
                    if (serverTomorrow && value && value < serverTomorrow) {
                      toast.error("Không thể chọn ngày hôm nay hoặc trong quá khứ.");
                      setLeaveFrom(serverTomorrow);
                      setLeaveTo(serverTomorrow);
                      return;
                    }
                    setLeaveFrom(value);
                    setLeaveTo(value);
                  }}
                  min={serverTomorrow || undefined}
                  required
                />
              </label>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="flex flex-col gap-2">
                  Từ ngày
                  <Input
                    type="date"
                    className="rounded-none"
                    value={leaveFrom}
                    onChange={(e) => {
                      const value = e.target.value;
                      if (serverTomorrow && value && value < serverTomorrow) {
                        toast.error("Không thể chọn ngày hôm nay hoặc trong quá khứ.");
                        setLeaveFrom(serverTomorrow);
                        setLeaveTo(serverTomorrow);
                        return;
                      }
                      setLeaveFrom(value);
                      if (leaveTo && value > leaveTo) {
                        setLeaveTo(value);
                      }
                    }}
                    min={serverTomorrow || undefined}
                    required
                  />
                </label>
                <label className="flex flex-col gap-2">
                  Đến ngày
                  <Input
                    type="date"
                    className="rounded-none"
                    value={leaveTo}
                    onChange={(e) => {
                      const value = e.target.value;
                      if (serverTomorrow && value && value < serverTomorrow) {
                        toast.error("Không thể chọn ngày hôm nay hoặc trong quá khứ.");
                        setLeaveTo(serverTomorrow);
                        return;
                      }
                      if (leaveFrom && value < leaveFrom) {
                        toast.error("Ngày kết thúc phải >= ngày bắt đầu.");
                        setLeaveTo(leaveFrom);
                        return;
                      }
                      setLeaveTo(value);
                    }}
                    min={leaveFrom || serverTomorrow || undefined}
                    required
                  />
                </label>
              </div>
            )}
            <label className="flex flex-col gap-2">
              Loại nghỉ phép
              <select
                className="rounded-none border border-slate-300 bg-white px-3 py-2 text-sm"
                value={leaveType}
                onChange={(e) => setLeaveType(e.target.value)}
                required
              >
                <option value="">-- Chọn loại --</option>
                <option value="ANNUAL">Phép năm</option>
                <option value="SICK">Ốm</option>
                <option value="UNPAID">Nghỉ không lương</option>
                <option value="OTHER">Khác</option>
              </select>
            </label>
            <label className="flex flex-col gap-2">
              Lý do
              <textarea
                className="min-h-22.5 w-full rounded-none border border-slate-300 bg-white px-3 py-2 text-sm"
                placeholder="Nhập lý do nghỉ"
                value={leaveReason}
                onChange={(e) => setLeaveReason(e.target.value)}
                required
              />
            </label>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" className="rounded-none" onClick={closeDialog}>
                Đóng
              </Button>
              <Button
                type="submit"
                className="rounded-none bg-emerald-500 text-white hover:bg-emerald-600"
                disabled={submitting === "leave"}
              >
                {submitting === "leave" ? "Đang gửi..." : "Gửi yêu cầu"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={open === "attendance"} onOpenChange={(value) => setOpen(value ? "attendance" : null)}>
        <DialogContent className="rounded-none">
          <DialogHeader>
            <DialogTitle>Điều chỉnh chấm công</DialogTitle>
            <DialogDescription>Gửi yêu cầu chỉnh giờ vào/ra hoặc trạng thái.</DialogDescription>
          </DialogHeader>
          <form
            className="space-y-4 text-sm text-slate-700"
            onSubmit={(event) => {
              event.preventDefault();
              submitAttendanceRequest();
            }}
          >
            <label className="flex flex-col gap-2">
              Ngày chấm công
              <Input
                type="date"
                className="rounded-none"
                value={attendanceDate}
                onChange={(e) => {
                  const value = e.target.value;
                  if (!value) {
                    setAttendanceDate("");
                    return;
                  }
                  if (serverToday && value >= serverToday) {
                    toast.error("Không thể chọn ngày hôm nay hoặc tương lai.");
                    setAttendanceDate(attendanceHistoryDates[attendanceHistoryDates.length - 1] || "");
                    return;
                  }
                  if (!attendanceHistoryDates.includes(value)) {
                    toast.error("Chỉ được chọn ngày đã có ca làm trong quá khứ.");
                    setAttendanceDate(attendanceHistoryDates[attendanceHistoryDates.length - 1] || "");
                    return;
                  }
                  setAttendanceDate(value);
                }}
                min={attendanceHistoryDates[0] || undefined}
                max={attendanceHistoryDates[attendanceHistoryDates.length - 1] || undefined}
                required
                disabled={attendanceLoading || attendanceHistoryDates.length === 0}
              />
            </label>
            {attendanceLoading && <div className="text-xs text-slate-500">Đang tải ngày ca làm...</div>}
            {attendanceInfoLoading && <div className="text-xs text-slate-500">Đang tải chi tiết...</div>}
            {attendanceInfo && (
              <div className="rounded-none border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
                <div className="font-semibold text-slate-900 mb-2">Chi tiết ngày {attendanceDate}</div>
                <div className="grid gap-2 sm:grid-cols-2">
                  <div>
                    <div className="text-xs text-slate-500">Ca làm</div>
                    <div className="font-semibold">
                      {attendanceInfo.schedule
                        ? `${attendanceInfo.schedule.name} (${attendanceInfo.schedule.startTime} - ${attendanceInfo.schedule.endTime})`
                        : "Không có ca"}
                    </div>
                    <div className="text-xs text-slate-500">
                      Nghỉ: {attendanceInfo.schedule?.breakMinutes ?? 0} phút
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-slate-500">Chấm công</div>
                    <div className="font-semibold">
                      IN {formatDateTime(attendanceInfo.attendance?.checkInAt)} · OUT{" "}
                      {formatDateTime(attendanceInfo.attendance?.checkOutAt)}
                    </div>
                    <div className="text-xs text-slate-500">
                      {attendanceInfo.attendance?.status ?? "—"}
                    </div>
                  </div>
                </div>
              </div>
            )}
            <label className="flex flex-col gap-2">
              Loại điều chỉnh
              <select
                className="rounded-none border border-slate-300 bg-white px-3 py-2 text-sm"
                value={attendanceField}
                onChange={(e) => setAttendanceField(e.target.value)}
                required
              >
                <option value="">-- Chọn loại --</option>
                {attendanceOptions.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-2">
              Giá trị mới
              <Input
                type="time"
                className="rounded-none"
                value={attendanceValue}
                onChange={(e) => setAttendanceValue(e.target.value)}
                required
              />
            </label>
            <label className="flex flex-col gap-2">
              Lý do
              <textarea
                className="min-h-22.5 w-full rounded-none border border-slate-300 bg-white px-3 py-2 text-sm"
                placeholder="Nhập lý do điều chỉnh"
                value={attendanceReason}
                onChange={(e) => setAttendanceReason(e.target.value)}
                required
              />
            </label>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" className="rounded-none" onClick={closeDialog}>
                Đóng
              </Button>
              <Button
                type="submit"
                className="rounded-none bg-emerald-500 text-white hover:bg-emerald-600"
                disabled={submitting === "attendance"}
              >
                {submitting === "attendance" ? "Đang gửi..." : "Gửi yêu cầu"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
