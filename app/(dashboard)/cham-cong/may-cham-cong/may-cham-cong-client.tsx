"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

type MachineEventItem = {
  id: string;
  deviceCode: string;
  machineId: number | null;
  deviceUserCode: string;
  userSn: number | null;
  epochMs: string;
  occurredAt: string | Date;
  createdAt: string | Date;
};

type ApiResponse = {
  ok: boolean;
  items?: MachineEventItem[];
  nextCursor?: string | null;
};

const dateTimeFormatter = new Intl.DateTimeFormat("vi-VN", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
});

function formatDateTime(value: string | Date) {
  const d = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return "—";
  return dateTimeFormatter.format(d);
}


export default function MayChamCongClient() {
  const [items, setItems] = useState<MachineEventItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [take, setTake] = useState("50");

  const queryParams = useMemo(() => {
    const params = new URLSearchParams();
    if (from.trim()) params.set("from", from.trim());
    if (to.trim()) params.set("to", to.trim());
    if (take.trim()) params.set("take", take.trim());
    return params;
  }, [from, to, take]);

  const fetchEvents = async (cursor?: string | null, mode: "replace" | "append" = "replace") => {
    const params = new URLSearchParams(queryParams);
    if (cursor) params.set("cursor", cursor);

    if (mode === "append") setLoadingMore(true);
    else setLoading(true);

    try {
      const res = await fetch(`/api/cham-cong/may-cham-cong?${params.toString()}`);
      if (!res.ok) {
        let message = `Không tải được dữ liệu (HTTP ${res.status})`;
        try {
          const payload = (await res.json()) as { error?: string; message?: string };
          if (payload.error || payload.message) {
            message = payload.error ?? payload.message ?? message;
          }
        } catch {
          // ignore parse errors
        }
        throw new Error(message);
      }
      const data = (await res.json()) as ApiResponse;
      setItems((prev) => (mode === "append" ? [...prev, ...(data.items ?? [])] : data.items ?? []));
      setNextCursor(data.nextCursor ?? null);
    } catch (error) {
      console.error(error);
      toast.error(error instanceof Error ? error.message : "Không tải được dữ liệu");
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  useEffect(() => {
    fetchEvents(null, "replace");
  }, []);

  const handleSearch = () => {
    fetchEvents(null, "replace");
  };

  const handleLoadMore = () => {
    if (!nextCursor) return;
    fetchEvents(nextCursor, "append");
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg sm:text-xl font-semibold">Dữ liệu máy chấm công</h1>
        <p className="text-sm text-muted-foreground">Lịch sử log từ máy chấm công đã được map.</p>
      </div>

      <div className="flex flex-col gap-3 rounded-lg border bg-white p-4">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <div className="space-y-1">
            <label className="text-sm text-slate-600">Từ ngày</label>
            <Input value={from} onChange={(e) => setFrom(e.target.value)} placeholder="YYYY-MM-DD" />
          </div>
          <div className="space-y-1">
            <label className="text-sm text-slate-600">Đến ngày</label>
            <Input value={to} onChange={(e) => setTo(e.target.value)} placeholder="YYYY-MM-DD" />
          </div>
          <div className="space-y-1">
            <label className="text-sm text-slate-600">Số dòng</label>
            <Input value={take} onChange={(e) => setTake(e.target.value)} placeholder="50" />
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button onClick={handleSearch} disabled={loading}>
            {loading ? "Đang tải..." : "Tìm"}
          </Button>
        </div>
      </div>

      <div className="rounded-lg border bg-white">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-100">
                <TableHead className="w-14 text-center bg-slate-100 whitespace-nowrap">STT</TableHead>
                <TableHead className="min-w-40 text-center bg-slate-100 whitespace-nowrap">Thời gian</TableHead>
                <TableHead className="min-w-28 text-center bg-slate-100 whitespace-nowrap">Device</TableHead>
                <TableHead className="min-w-24 text-center bg-slate-100 whitespace-nowrap">User</TableHead>
                <TableHead className="min-w-24 text-center bg-slate-100 whitespace-nowrap">Máy</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={5} className="py-10 text-center text-sm text-muted-foreground">
                    Đang tải dữ liệu...
                  </TableCell>
                </TableRow>
              ) : items.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="py-10 text-center text-sm text-muted-foreground">
                    Không có dữ liệu.
                  </TableCell>
                </TableRow>
              ) : (
                items.map((item, index) => {
                  return (
                    <TableRow key={item.id}>
                      <TableCell className="text-center text-sm text-slate-500">{index + 1}</TableCell>
                      <TableCell className="text-center text-sm">{formatDateTime(item.occurredAt)}</TableCell>
                      <TableCell className="text-center font-medium">{item.deviceCode}</TableCell>
                      <TableCell className="text-center">{item.deviceUserCode}</TableCell>
                      <TableCell className="text-center text-sm">{item.machineId ?? "—"}</TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>

        <div className="flex items-center justify-between p-4">
          <div className="text-xs text-slate-500">Hiển thị {items.length} dòng</div>
          <Button variant="outline" onClick={handleLoadMore} disabled={!nextCursor || loadingMore}>
            {loadingMore ? "Đang tải..." : "Tải thêm"}
          </Button>
        </div>
      </div>
    </div>
  );
}
