"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

type WorkShiftItem = {
  id: string;
  code: string;
  name: string;
  startTime: string;
  endTime: string;
  breakMinutes: number;
  lateGraceMinutes: number;
  earlyGraceMinutes: number;
  overtimeThresholdMinutes: number;
  status: "ACTIVE" | "ARCHIVED";
  employeeCount?: number;
};

function formatMinutes(value: number) {
  return `${value} phút`;
}

function calcShiftDurationMinutes(startTime: string, endTime: string) {
  const toMinutes = (value: string) => {
    const [h, m] = value.split(":").map(Number);
    if (Number.isNaN(h) || Number.isNaN(m)) return null;
    return h * 60 + m;
  };
  const start = toMinutes(startTime);
  const end = toMinutes(endTime);
  if (start === null || end === null) return null;
  let diff = end - start;
  if (diff < 0) diff += 24 * 60;
  return diff;
}

function formatDuration(value: number | null) {
  if (value === null) return "—";
  const hours = Math.floor(value / 60);
  const minutes = value % 60;
  return `${hours}h${minutes.toString().padStart(2, "0")}`;
}

function formatStatus(value: WorkShiftItem["status"]) {
  return value === "ACTIVE" ? "Đang áp dụng" : "Ngừng áp dụng";
}

export function CaLamList() {
  const [items, setItems] = useState<WorkShiftItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);

  const fetchItems = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/ca-lam");
      if (!res.ok) throw new Error("Không tải được danh sách ca làm.");
      const data = (await res.json()) as { items?: WorkShiftItem[] };
      setItems(data.items ?? []);
    } catch (error: unknown) {
      console.error(error);
      toast.error("Không tải được danh sách ca làm.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  async function handleStatusChange(item: WorkShiftItem, nextStatus: WorkShiftItem["status"]) {
    if (item.employeeCount && item.employeeCount > 0) {
      toast.error("Không thể đổi trạng thái vì đã có nhân viên thuộc ca này.");
      return;
    }
    if (item.status === nextStatus) return;
    try {
      setSavingId(item.id);
      const res = await fetch(`/api/ca-lam/${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: item.code,
          name: item.name,
          startTime: item.startTime,
          endTime: item.endTime,
          breakMinutes: item.breakMinutes,
          lateGraceMinutes: item.lateGraceMinutes,
          earlyGraceMinutes: item.earlyGraceMinutes,
          overtimeThresholdMinutes: item.overtimeThresholdMinutes,
          status: nextStatus,
        }),
      });
      if (!res.ok) {
        const data = (await res.json()) as { message?: string };
        throw new Error(data.message ?? "Không thể cập nhật trạng thái.");
      }
      setItems((prev) =>
        prev.map((row) => (row.id === item.id ? { ...row, status: nextStatus } : row))
      );
      toast.success("Đã cập nhật trạng thái ca làm.");
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Không thể cập nhật trạng thái.";
      toast.error(message);
    } finally {
      setSavingId(null);
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted-foreground">
          Tổng cộng: <span className="font-semibold text-slate-900">{items.length}</span> ca làm.
        </p>
        <Button asChild className="rounded-none bg-emerald-500 text-white hover:bg-emerald-600 w-full sm:w-auto">
          <Link href="/ca-lam/tao-moi">Tạo ca làm mới</Link>
        </Button>
      </div>

      <div className="border bg-white overflow-x-auto rounded-lg">
        <Table>
          <TableHeader>
            <TableRow className="bg-slate-100">
              <TableHead className="w-14 text-center bg-slate-100 whitespace-nowrap">STT</TableHead>
              <TableHead className="w-32 text-center bg-slate-100 whitespace-nowrap">Mã ca</TableHead>
              <TableHead className="min-w-48 text-center bg-slate-100 whitespace-nowrap">Tên ca</TableHead>
              <TableHead className="min-w-36 text-center bg-slate-100 whitespace-nowrap">Giờ làm</TableHead>
              <TableHead className="min-w-24 text-center bg-slate-100 whitespace-nowrap">Độ dài</TableHead>
              <TableHead className="min-w-24 text-center bg-slate-100 whitespace-nowrap">Nghỉ</TableHead>
              <TableHead className="min-w-24 text-center bg-slate-100 whitespace-nowrap">Trễ</TableHead>
              <TableHead className="min-w-24 text-center bg-slate-100 whitespace-nowrap">Sớm</TableHead>
              <TableHead className="min-w-24 text-center bg-slate-100 whitespace-nowrap">Tăng ca</TableHead>
              <TableHead className="min-w-36 text-center bg-slate-100 whitespace-nowrap">Trạng thái</TableHead>
              <TableHead className="w-28 text-center bg-slate-100 whitespace-nowrap">Tổng ca</TableHead>
              <TableHead className="w-32 text-center bg-slate-100 whitespace-nowrap">Thao tác</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={10} className="py-10 text-center text-sm text-muted-foreground">
                  Đang tải...
                </TableCell>
              </TableRow>
            ) : items.length === 0 ? (
              <TableRow>
                <TableCell colSpan={10} className="py-10 text-center text-sm text-muted-foreground">
                  Chưa có ca làm nào.
                </TableCell>
              </TableRow>
            ) : (
              items.map((item, index) => (
                <TableRow key={item.id}>
                  <TableCell className="text-center text-sm text-slate-500">{index + 1}</TableCell>
                  <TableCell className="text-center font-medium">{item.code}</TableCell>
                  <TableCell className="text-center">{item.name}</TableCell>
                  <TableCell className="text-center">
                    {item.startTime} - {item.endTime}
                  </TableCell>
                  <TableCell className="text-center">
                    {formatDuration(calcShiftDurationMinutes(item.startTime, item.endTime))}
                  </TableCell>
                  <TableCell className="text-center">{formatMinutes(item.breakMinutes)}</TableCell>
                  <TableCell className="text-center">{formatMinutes(item.lateGraceMinutes)}</TableCell>
                  <TableCell className="text-center">{formatMinutes(item.earlyGraceMinutes)}</TableCell>
                  <TableCell className="text-center">{formatMinutes(item.overtimeThresholdMinutes)}</TableCell>
                  <TableCell className="text-center">
                    <select
                      value={item.status}
                      disabled={savingId === item.id || (item.employeeCount ?? 0) > 0}
                      onChange={(event) =>
                        handleStatusChange(item, event.target.value as WorkShiftItem["status"])
                      }
                      title={
                        (item.employeeCount ?? 0) > 0
                          ? "Không thể đổi trạng thái vì đã có nhân viên thuộc ca này."
                          : "Đổi trạng thái ca làm"
                      }
                      className="rounded-none border border-slate-300 bg-white px-2 py-1.5 text-sm"
                    >
                      <option value="ACTIVE">{formatStatus("ACTIVE")}</option>
                      <option value="ARCHIVED">{formatStatus("ARCHIVED")}</option>
                    </select>
                  </TableCell>
                  <TableCell className="text-center">{item.employeeCount ?? 0}</TableCell>
                  <TableCell className="text-center">
                    <Button
                      asChild
                      variant="outline"
                      size="sm"
                      className="rounded-none border-blue-500 text-blue-600 hover:bg-blue-50"
                    >
                      <Link href={`/ca-lam/${item.id}/chinh-sua`}>Sửa</Link>
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
