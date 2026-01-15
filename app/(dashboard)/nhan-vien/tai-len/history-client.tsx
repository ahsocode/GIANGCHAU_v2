"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

type HistoryItem = {
  id: string;
  type: string;
  fileName: string;
  totalRows: number;
  successRows: number;
  failedRows: number;
  createdAt: string;
  createdBy: { id: string; name: string | null; email: string } | null;
};

export default function HistoryClient() {
  const [items, setItems] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchHistory = async () => {
      setLoading(true);
      try {
        const res = await fetch("/api/nhan-vien/import/history");
        if (!res.ok) throw new Error("Không tải được lịch sử");
        const data = (await res.json()) as { items?: HistoryItem[] };
        setItems(data.items ?? []);
      } catch (error) {
        console.error(error);
        toast.error("Không tải được lịch sử tải lên");
      } finally {
        setLoading(false);
      }
    };
    fetchHistory();
  }, []);

  return (
    <div className="space-y-3">
      <div>
        <h3 className="text-base font-semibold text-slate-900">Lịch sử tải lên</h3>
        <p className="text-sm text-slate-600">Theo dõi ai đã tải lên và thời điểm tải lên.</p>
      </div>

      <div className="border bg-white overflow-x-auto rounded-lg">
        <Table>
          <TableHeader>
            <TableRow className="bg-slate-100">
              <TableHead className="min-w-35 text-center bg-slate-100 whitespace-nowrap">Thời gian</TableHead>
              <TableHead className="min-w-30 text-center bg-slate-100 whitespace-nowrap">Người tải lên</TableHead>
              <TableHead className="min-w-40 text-center bg-slate-100 whitespace-nowrap">Email</TableHead>
              <TableHead className="min-w-40 text-center bg-slate-100 whitespace-nowrap">File</TableHead>
              <TableHead className="w-20 text-center bg-slate-100 whitespace-nowrap">Tổng</TableHead>
              <TableHead className="w-20 text-center bg-slate-100 whitespace-nowrap">Thành công</TableHead>
              <TableHead className="w-20 text-center bg-slate-100 whitespace-nowrap">Lỗi</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={7} className="py-10 text-center text-sm text-muted-foreground">
                  Đang tải...
                </TableCell>
              </TableRow>
            ) : items.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="py-10 text-center text-sm text-muted-foreground">
                  Chưa có lịch sử tải lên
                </TableCell>
              </TableRow>
            ) : (
              items.map((item) => {
                const createdAt = new Date(item.createdAt);
                const createdByName = item.createdBy?.name || "—";
                const createdByEmail = item.createdBy?.email || "—";
                return (
                  <TableRow key={item.id}>
                    <TableCell className="text-center text-sm text-slate-700">
                      {createdAt.toLocaleString("vi-VN")}
                    </TableCell>
                    <TableCell className="text-center text-sm text-slate-700">{createdByName}</TableCell>
                    <TableCell className="text-center text-sm text-slate-700">{createdByEmail}</TableCell>
                    <TableCell className="text-center text-sm text-slate-700">{item.fileName}</TableCell>
                    <TableCell className="text-center text-sm text-slate-700">{item.totalRows}</TableCell>
                    <TableCell className="text-center text-sm text-emerald-600 font-medium">
                      {item.successRows}
                    </TableCell>
                    <TableCell className="text-center text-sm text-red-600 font-medium">
                      {item.failedRows}
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
