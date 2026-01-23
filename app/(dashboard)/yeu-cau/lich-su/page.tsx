"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

type RequestItem = {
  id: string;
  type: "SHIFT_CHANGE" | "PROFILE_UPDATE" | "LEAVE" | "ATTENDANCE_ADJUSTMENT";
  status: string;
  submittedAt: string | null;
  summary: string;
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

export default function YeuCauHistoryPage() {
  const [items, setItems] = useState<RequestItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<RequestItem | null>(null);

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        const res = await fetch("/api/yeu-cau/lich-su");
        if (!res.ok) throw new Error("Không tải được lịch sử yêu cầu.");
        const data = (await res.json()) as { items?: RequestItem[] };
        setItems(data.items ?? []);
      } catch (error) {
        console.error(error);
        toast.error("Không tải được lịch sử yêu cầu.");
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, []);

  return (
    <div className="space-y-5 w-full">
      <div>
        <h2 className="text-xl font-semibold">Lịch sử yêu cầu</h2>
        <p className="text-sm text-muted-foreground">Theo dõi trạng thái và lịch sử xử lý yêu cầu.</p>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-100 text-slate-600">
            <tr>
              <th className="px-4 py-3 text-left">Loại</th>
              <th className="px-4 py-3 text-left">Nội dung</th>
              <th className="px-4 py-3 text-left">Trạng thái</th>
              <th className="px-4 py-3 text-left">Gửi lúc</th>
              <th className="px-4 py-3 text-right">Chi tiết</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td className="px-4 py-6 text-center text-slate-500" colSpan={5}>
                  Đang tải...
                </td>
              </tr>
            ) : items.length === 0 ? (
              <tr>
                <td className="px-4 py-6 text-center text-slate-500" colSpan={5}>
                  Chưa có yêu cầu nào.
                </td>
              </tr>
            ) : (
              items.map((item) => (
                <tr key={`${item.type}-${item.id}`} className="border-t border-slate-100">
                  <td className="px-4 py-3 font-medium text-slate-900">{mapType(item.type)}</td>
                  <td className="px-4 py-3 text-slate-700">{item.summary}</td>
                  <td className="px-4 py-3 text-slate-700">{mapStatus(item.status)}</td>
                  <td className="px-4 py-3 text-slate-700">{formatDateTime(item.submittedAt)}</td>
                  <td className="px-4 py-3 text-right">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="rounded-none"
                      onClick={() => setSelected(item)}
                    >
                      Xem lịch sử
                    </Button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <Dialog open={!!selected} onOpenChange={(value) => (!value ? setSelected(null) : null)}>
        <DialogContent className="rounded-none">
          <DialogHeader>
            <DialogTitle>Lịch sử xử lý</DialogTitle>
            <DialogDescription>{selected ? `${mapType(selected.type)} · ${selected.summary}` : ""}</DialogDescription>
          </DialogHeader>
          {selected && (
            <div className="space-y-3 text-sm text-slate-700">
              {selected.history.length === 0 ? (
                <div className="text-sm text-slate-500">Chưa có lịch sử xử lý.</div>
              ) : (
                selected.history.map((log, index) => (
                  <div key={`${log.createdAt}-${index}`} className="rounded-none border border-slate-100 bg-white p-3">
                    <div className="flex justify-between text-xs text-slate-500">
                      <span>{formatDateTime(log.createdAt)}</span>
                      <span>{log.handledByName ?? "Hệ thống"}</span>
                    </div>
                    <div className="mt-1 text-sm font-semibold text-slate-900">{mapStatus(log.status)}</div>
                    {log.note && <div className="text-xs text-slate-500 mt-1">{log.note}</div>}
                  </div>
                ))
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
