"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

type RequestItem = {
  id: string;
  type: "SHIFT_CHANGE" | "PROFILE_UPDATE" | "LEAVE" | "ATTENDANCE_ADJUSTMENT";
  status: string;
  submittedAt: string | null;
  employee: { name: string; code: string; positionName: string | null; departmentName: string | null };
  summary: string;
  leaveType?: "ANNUAL" | "SICK" | "UNPAID" | "OTHER" | null;
  history: {
    status: string;
    note: string | null;
    handledByName: string | null;
    createdAt: string;
  }[];
};

function formatDateTime(value: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(value));
}

function mapType(value: RequestItem["type"]) {
  if (value === "SHIFT_CHANGE") return "Đổi ca";
  if (value === "PROFILE_UPDATE") return "Cập nhật thông tin";
  if (value === "LEAVE") return "Nghỉ phép";
  return "Điều chỉnh chấm công";
}

function mapStatus(value: string) {
  if (value === "SUBMITTED") return "Chờ xử lý";
  if (value === "APPROVED") return "Đã duyệt";
  if (value === "REJECTED") return "Từ chối";
  if (value === "CANCELLED") return "Đã hủy";
  if (value === "DRAFT") return "Nháp";
  return value;
}

export default function AdminRequestsClient() {
  const [items, setItems] = useState<RequestItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [actionTarget, setActionTarget] = useState<RequestItem | null>(null);
  const [actionStatus, setActionStatus] = useState<"APPROVED" | "REJECTED">("APPROVED");
  const [actionNote, setActionNote] = useState("");
  const [actionHolidayTypeId, setActionHolidayTypeId] = useState("");
  const [saving, setSaving] = useState(false);
  const [typeFilter, setTypeFilter] = useState<"ALL" | RequestItem["type"]>("ALL");
  const [statusFilter, setStatusFilter] = useState<"ALL" | "DRAFT" | "SUBMITTED" | "APPROVED" | "REJECTED" | "CANCELLED">("ALL");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [holidayTypes, setHolidayTypes] = useState<
    { id: string; name: string; payPolicy: "PAID" | "UNPAID" | "LEAVE" }[]
  >([]);

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        if (typeFilter !== "ALL") params.set("type", typeFilter);
        if (statusFilter !== "ALL") params.set("status", statusFilter);
        params.set("page", String(page));
        const res = await fetch(`/api/yeu-cau/quan-ly${params.toString() ? `?${params.toString()}` : ""}`);
        if (!res.ok) throw new Error("Không tải được danh sách yêu cầu.");
        const data = (await res.json()) as { items?: RequestItem[]; totalPages?: number; page?: number };
        setItems(data.items ?? []);
        setTotalPages(data.totalPages ?? 1);
        setPage(data.page ?? page);
      } catch (error) {
        console.error(error);
        toast.error("Không tải được danh sách yêu cầu.");
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, [typeFilter, statusFilter, page]);

  useEffect(() => {
    const loadHolidayTypes = async () => {
      try {
        const res = await fetch("/api/ngay-nghi/loai");
        if (!res.ok) throw new Error("Không tải được loại ngày nghỉ.");
        const data = (await res.json()) as { items?: { id: string; name: string; payPolicy: "PAID" | "UNPAID" | "LEAVE" }[] };
        setHolidayTypes(data.items ?? []);
      } catch (error) {
        console.error(error);
        toast.error("Không tải được loại ngày nghỉ.");
      }
    };
    loadHolidayTypes();
  }, []);

  async function reload() {
    setLoading(true);
    try {
    const params = new URLSearchParams();
    if (typeFilter !== "ALL") params.set("type", typeFilter);
    if (statusFilter !== "ALL") params.set("status", statusFilter);
    params.set("page", String(page));
    const res = await fetch(`/api/yeu-cau/quan-ly${params.toString() ? `?${params.toString()}` : ""}`);
    if (!res.ok) throw new Error("Không tải được danh sách yêu cầu.");
    const data = (await res.json()) as { items?: RequestItem[]; totalPages?: number; page?: number };
    setItems(data.items ?? []);
    setTotalPages(data.totalPages ?? 1);
    setPage(data.page ?? page);
  } catch (error) {
      console.error(error);
      toast.error("Không tải được danh sách yêu cầu.");
    } finally {
      setLoading(false);
    }
  }

  const latestHistory = useMemo(() => {
    const map = new Map<string, RequestItem["history"][number] | null>();
    items.forEach((item) => {
      const last = item.history[item.history.length - 1] ?? null;
      map.set(`${item.type}:${item.id}`, last);
    });
    return map;
  }, [items]);

  return (
    <div className="space-y-5 w-full">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold">Xử lý yêu cầu</h2>
          <p className="text-sm text-muted-foreground">
            Danh sách yêu cầu đã gửi, theo dõi lịch sử xử lý và người xử lý.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-sm text-slate-600">
          <div className="flex items-center gap-2">
            <span>Loại</span>
            <select
              className="rounded-none border border-slate-300 bg-white px-3 py-2 text-sm"
              value={typeFilter}
              onChange={(e) => {
                setPage(1);
                setTypeFilter(e.target.value as "ALL" | RequestItem["type"]);
              }}
            >
              <option value="ALL">Tất cả</option>
              <option value="SHIFT_CHANGE">Đổi ca</option>
              <option value="PROFILE_UPDATE">Cập nhật thông tin</option>
              <option value="LEAVE">Nghỉ phép</option>
              <option value="ATTENDANCE_ADJUSTMENT">Điều chỉnh chấm công</option>
            </select>
          </div>
          <div className="flex items-center gap-2">
            <span>Trạng thái</span>
            <select
              className="rounded-none border border-slate-300 bg-white px-3 py-2 text-sm"
              value={statusFilter}
              onChange={(e) => {
                setPage(1);
                setStatusFilter(
                  e.target.value as "ALL" | "DRAFT" | "SUBMITTED" | "APPROVED" | "REJECTED" | "CANCELLED"
                );
              }}
            >
              <option value="ALL">Tất cả</option>
              <option value="SUBMITTED">Chờ xử lý</option>
              <option value="APPROVED">Đã duyệt</option>
              <option value="REJECTED">Từ chối</option>
              <option value="CANCELLED">Đã hủy</option>
              <option value="DRAFT">Nháp</option>
            </select>
          </div>
        </div>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-100 text-slate-600">
            <tr>
              <th className="px-4 py-3 text-left">STT</th>
              <th className="px-4 py-3 text-left">Loại</th>
              <th className="px-4 py-3 text-left">Nhân viên</th>
              <th className="px-4 py-3 text-left">Chức vụ</th>
              <th className="px-4 py-3 text-left">Bộ phận</th>
              <th className="px-4 py-3 text-left">Nội dung</th>
              <th className="px-4 py-3 text-left">Trạng thái</th>
              <th className="px-4 py-3 text-left">Gửi lúc</th>
              <th className="px-4 py-3 text-left">Xử lý gần nhất</th>
              <th className="px-4 py-3 text-right">Chi tiết</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td className="px-4 py-6 text-center text-slate-500" colSpan={10}>
                  Đang tải...
                </td>
              </tr>
            ) : items.length === 0 ? (
              <tr>
                <td className="px-4 py-6 text-center text-slate-500" colSpan={10}>
                  Chưa có yêu cầu nào.
                </td>
              </tr>
            ) : (
              items.map((item, index) => {
                const last = latestHistory.get(`${item.type}:${item.id}`);
                const rowClass =
                  item.status === "APPROVED"
                    ? "bg-emerald-50"
                    : item.status === "REJECTED"
                      ? "bg-rose-50"
                      : item.status === "SUBMITTED"
                        ? "bg-blue-50"
                        : "bg-white";
                return (
                  <tr key={`${item.type}-${item.id}`} className={`border-t border-slate-100 ${rowClass}`}>
                    <td className="px-4 py-3 text-slate-500">{index + 1}</td>
                    <td className="px-4 py-3 font-medium text-slate-900">{mapType(item.type)}</td>
                    <td className="px-4 py-3 text-slate-700">
                      <div className="font-medium text-slate-900">{item.employee.name}</div>
                      <div className="text-xs text-slate-500">Mã: {item.employee.code}</div>
                    </td>
                    <td className="px-4 py-3 text-slate-700">{item.employee.positionName ?? "—"}</td>
                    <td className="px-4 py-3 text-slate-700">{item.employee.departmentName ?? "—"}</td>
                    <td className="px-4 py-3 text-slate-700">{item.summary}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${
                          item.status === "APPROVED"
                            ? "bg-emerald-100 text-emerald-700"
                            : item.status === "REJECTED"
                              ? "bg-rose-100 text-rose-700"
                              : item.status === "CANCELLED"
                                ? "bg-slate-100 text-slate-600"
                                : "bg-amber-100 text-amber-700"
                        }`}
                      >
                        {mapStatus(item.status)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-700">{formatDateTime(item.submittedAt)}</td>
                    <td className="px-4 py-3 text-slate-700">
                      {last
                        ? `${mapStatus(last.status)}${last.handledByName ? ` · ${last.handledByName}` : ""}`
                        : "—"}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex justify-end gap-2">
                        {item.status !== "APPROVED" && item.status !== "REJECTED" && item.status !== "CANCELLED" ? (
                          <>
                            <Button
                              type="button"
                              size="sm"
                              className="rounded-none bg-emerald-500 text-white hover:bg-emerald-600"
                              onClick={() => {
                                setActionTarget(item);
                                setActionStatus("APPROVED");
                                setActionNote("");
                                setActionHolidayTypeId("");
                              }}
                            >
                              Duyệt
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              className="rounded-none border-rose-300 text-rose-600 hover:bg-rose-50"
                              onClick={() => {
                                setActionTarget(item);
                                setActionStatus("REJECTED");
                                setActionNote("");
                                setActionHolidayTypeId("");
                              }}
                            >
                              Từ chối
                            </Button>
                          </>
                        ) : (
                          <span className="text-xs text-slate-400">Đã xử lý</span>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between text-sm text-slate-600">
        <div>
          Trang {page} / {totalPages}
        </div>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            className="rounded-none"
            disabled={page <= 1 || loading}
            onClick={() => setPage((prev) => Math.max(1, prev - 1))}
          >
            Trước
          </Button>
          <Button
            type="button"
            variant="outline"
            className="rounded-none"
            disabled={page >= totalPages || loading}
            onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
          >
            Sau
          </Button>
        </div>
      </div>

      <Dialog open={!!actionTarget} onOpenChange={(value) => (!value ? setActionTarget(null) : null)}>
        <DialogContent className="rounded-none">
          <DialogHeader>
            <DialogTitle>
              {actionStatus === "APPROVED" ? "Xác nhận duyệt" : "Xác nhận từ chối"}
            </DialogTitle>
            <DialogDescription>
              {actionTarget ? `${mapType(actionTarget.type)} · ${actionTarget.employee.name}` : ""}
            </DialogDescription>
          </DialogHeader>
          {actionTarget && (
            <form
              className="space-y-4 text-sm text-slate-700"
              onSubmit={async (event) => {
                event.preventDefault();
                setSaving(true);
                try {
                  const res = await fetch("/api/yeu-cau/quan-ly", {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      type: actionTarget.type,
                      id: actionTarget.id,
                      status: actionStatus,
                      note: actionNote || null,
                      holidayTypeId: actionTarget.type === "LEAVE" ? actionHolidayTypeId || null : undefined,
                    }),
                  });
                  if (!res.ok) {
                    const err = await res.json().catch(() => null);
                    throw new Error(err?.message || "Không thể xử lý yêu cầu.");
                  }
                  toast.success("Đã cập nhật trạng thái yêu cầu.");
                  setActionTarget(null);
                  setActionNote("");
                  setActionHolidayTypeId("");
                  await reload();
                } catch (error) {
                  console.error(error);
                  toast.error(error instanceof Error ? error.message : "Không thể xử lý yêu cầu.");
                } finally {
                  setSaving(false);
                }
              }}
            >
              <div className="rounded-none border border-slate-200 bg-slate-50 p-3">
                <div className="text-xs text-slate-500">Nội dung</div>
                <div className="font-semibold text-slate-900">{actionTarget.summary}</div>
              </div>
              {actionTarget.type === "LEAVE" && actionStatus === "APPROVED" && (
                <label className="flex flex-col gap-2">
                  Loại ngày nghỉ
                  <select
                    className="rounded-none border border-slate-300 bg-white px-3 py-2 text-sm"
                    value={actionHolidayTypeId}
                    onChange={(e) => setActionHolidayTypeId(e.target.value)}
                    required
                  >
                    <option value="">-- Chọn loại --</option>
                    {holidayTypes.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              <label className="flex flex-col gap-2">
                Ghi chú
                <textarea
                  className="min-h-[90px] w-full rounded-none border border-slate-300 bg-white px-3 py-2 text-sm"
                  placeholder="Nhập ghi chú xử lý (nếu có)"
                  value={actionNote}
                  onChange={(e) => setActionNote(e.target.value)}
                />
              </label>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" className="rounded-none" onClick={() => setActionTarget(null)}>
                  Đóng
                </Button>
                <Button
                  type="submit"
                  className={`rounded-none ${
                    actionStatus === "REJECTED"
                      ? "bg-rose-500 text-white hover:bg-rose-600"
                      : "bg-emerald-500 text-white hover:bg-emerald-600"
                  }`}
                  disabled={
                    saving ||
                    (actionTarget.type === "LEAVE" && actionStatus === "APPROVED" && !actionHolidayTypeId)
                  }
                >
                  {saving ? "Đang lưu..." : actionStatus === "REJECTED" ? "Từ chối" : "Duyệt"}
                </Button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
