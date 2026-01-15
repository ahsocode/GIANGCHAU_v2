"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

type EmployeeItem = {
  id: string;
  code: string;
  fullName: string;
  departmentName: string | null;
  positionName: string | null;
  personalEmail?: string | null;
};

export default function TaiKhoanNhanVienPage() {
  const [items, setItems] = useState<EmployeeItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [q, setQ] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");
  const [sortField, setSortField] = useState<"createdAt" | "fullName" | "code">("createdAt");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [assignOpen, setAssignOpen] = useState(false);
  const [assignEmail, setAssignEmail] = useState("");
  const [assignPassword, setAssignPassword] = useState("");
  const [assignPassword2, setAssignPassword2] = useState("");
  const [assigning, setAssigning] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<EmployeeItem | null>(null);
  const pageSize = 50;

  const totalPages = useMemo(() => Math.max(1, Math.ceil(total / pageSize)), [total, pageSize]);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(q.trim()), 300);
    return () => clearTimeout(t);
  }, [q]);

  useEffect(() => {
    setPage(1);
  }, [debouncedQ, sortField, sortOrder]);

  const fetchEmployees = async (pageNumber: number) => {
    setLoading(true);
    try {
      const query = new URLSearchParams();
      if (debouncedQ) query.set("q", debouncedQ);
      query.set("sort", sortField);
      query.set("order", sortOrder);
      query.set("withoutAccount", "true");
      query.set("page", String(pageNumber));
      query.set("pageSize", String(pageSize));
      const res = await fetch(`/api/nhan-vien?${query.toString()}`);
      if (!res.ok) throw new Error("Không tải được danh sách");
      const data = (await res.json()) as { items?: EmployeeItem[]; total?: number };
      setItems(data.items ?? []);
      setTotal(data.total ?? 0);
    } catch (error) {
      console.error(error);
      toast.error("Không tải được danh sách nhân viên");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEmployees(page);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, debouncedQ, sortField, sortOrder]);

  const openAssign = (employee: EmployeeItem) => {
    setSelectedEmployee(employee);
    setAssignEmail(employee.personalEmail ?? "");
    setAssignPassword("");
    setAssignPassword2("");
    setAssignOpen(true);
  };

  const onAssign = async () => {
    if (!selectedEmployee) return;
    if (!assignEmail.trim()) {
      toast.error("Vui lòng nhập email tài khoản");
      return;
    }
    if (!assignPassword.trim()) {
      toast.error("Vui lòng nhập mật khẩu");
      return;
    }
    if (assignPassword !== assignPassword2) {
      toast.error("Mật khẩu không khớp");
      return;
    }
    setAssigning(true);
    try {
      const res = await fetch(`/api/nhan-vien/${selectedEmployee.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName: selectedEmployee.fullName,
          accountEmail: assignEmail.trim(),
          accountPassword: assignPassword.trim(),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || "Cấp tài khoản thất bại");
      toast.success("Đã cấp tài khoản");
      setAssignOpen(false);
      await fetchEmployees(page);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Cấp tài khoản thất bại";
      toast.error(message);
    } finally {
      setAssigning(false);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-semibold">Nhân viên chưa có tài khoản</h2>
        <p className="text-sm text-muted-foreground">
          Danh sách nhân viên chưa có tài khoản để cấp nhanh.
        </p>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <Input
          placeholder="Tìm theo mã / tên nhân viên..."
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="rounded-none w-full sm:max-w-xs focus-visible:ring-0 focus-visible:ring-offset-0 focus:border-slate-300"
        />
        <div className="flex flex-col sm:flex-row gap-2 sm:items-center w-full sm:w-auto">
          <label className="text-sm text-slate-600 whitespace-nowrap">Sắp xếp:</label>
          <select
            value={sortField}
            onChange={(e) => setSortField(e.target.value as typeof sortField)}
            className="rounded-none border border-slate-300 bg-white px-2 py-1.5 text-sm"
          >
            <option value="createdAt">Ngày tạo</option>
            <option value="fullName">Tên</option>
            <option value="code">Mã</option>
          </select>
          <select
            value={sortOrder}
            onChange={(e) => setSortOrder(e.target.value as typeof sortOrder)}
            className="rounded-none border border-slate-300 bg-white px-2 py-1.5 text-sm"
          >
            <option value="asc">Tăng dần</option>
            <option value="desc">Giảm dần</option>
          </select>
        </div>
      </div>

      <div className="border bg-white overflow-x-auto rounded-lg">
        <Table>
          <TableHeader>
            <TableRow className="bg-slate-100">
              <TableHead className="w-12 text-center bg-slate-100 whitespace-nowrap">STT</TableHead>
              <TableHead className="min-w-25 text-center bg-slate-100 whitespace-nowrap">Mã NV</TableHead>
              <TableHead className="min-w-45 text-center bg-slate-100 whitespace-nowrap">Họ tên</TableHead>
              <TableHead className="min-w-30 text-center bg-slate-100 whitespace-nowrap hidden md:table-cell">Bộ phận</TableHead>
              <TableHead className="min-w-30 text-center bg-slate-100 whitespace-nowrap hidden md:table-cell">Chức vụ</TableHead>
              <TableHead className="w-32 text-center bg-slate-100 whitespace-nowrap">Thao tác</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={6} className="py-10 text-center text-sm text-muted-foreground">
                  Đang tải...
                </TableCell>
              </TableRow>
            ) : items.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="py-10 text-center text-sm text-muted-foreground">
                  Không có nhân viên chưa có tài khoản
                </TableCell>
              </TableRow>
            ) : (
              items.map((item, idx) => (
                <TableRow key={item.id}>
                  <TableCell className="text-center text-sm text-slate-500">
                    {(page - 1) * pageSize + idx + 1}
                  </TableCell>
                  <TableCell className="text-center font-medium">{item.code}</TableCell>
                  <TableCell className="text-center">{item.fullName}</TableCell>
                  <TableCell className="text-center hidden md:table-cell">{item.departmentName ?? "—"}</TableCell>
                  <TableCell className="text-center hidden md:table-cell">{item.positionName ?? "—"}</TableCell>
                  <TableCell className="text-center">
                    <Button
                      type="button"
                      size="sm"
                      className="rounded-none bg-emerald-500 text-white hover:bg-emerald-600"
                      onClick={() => openAssign(item)}
                    >
                      Cấp tài khoản
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div className="text-sm text-slate-600">
          Tổng: <span className="font-medium text-slate-900">{total}</span> nhân viên
        </div>
        <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
          <Button
            type="button"
            variant="outline"
            className="rounded-none w-full sm:w-auto"
            onClick={() => setPage((prev) => Math.max(1, prev - 1))}
            disabled={page <= 1 || loading}
          >
            Trang trước
          </Button>
          <div className="text-sm text-slate-600">
            Trang <span className="font-medium text-slate-900">{page}</span> / {totalPages}
          </div>
          <Button
            type="button"
            variant="outline"
            className="rounded-none w-full sm:w-auto"
            onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
            disabled={page >= totalPages || loading}
          >
            Trang sau
          </Button>
        </div>
      </div>

      <Dialog open={assignOpen} onOpenChange={setAssignOpen}>
        <DialogContent className="rounded-none max-w-[calc(100vw-2rem)] sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Cấp tài khoản</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="text-sm text-slate-600">
              Nhân viên: <span className="font-semibold text-slate-900">{selectedEmployee?.fullName}</span>
            </div>
            <div className="space-y-1">
              <label className="text-sm text-slate-600">Email tài khoản</label>
              <Input
                value={assignEmail}
                onChange={(e) => setAssignEmail(e.target.value)}
                type="email"
                className="rounded-none"
              />
            </div>
            <div className="space-y-1">
              <label className="text-sm text-slate-600">Mật khẩu</label>
              <Input
                value={assignPassword}
                onChange={(e) => setAssignPassword(e.target.value)}
                type="password"
                className="rounded-none"
              />
            </div>
            <div className="space-y-1">
              <label className="text-sm text-slate-600">Nhập lại mật khẩu</label>
              <Input
                value={assignPassword2}
                onChange={(e) => setAssignPassword2(e.target.value)}
                type="password"
                className="rounded-none"
              />
            </div>
            <div className="flex flex-col-reverse sm:flex-row justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="destructive"
                className="rounded-none"
                onClick={() => setAssignOpen(false)}
                disabled={assigning}
              >
                Huỷ
              </Button>
              <Button
                type="button"
                className="rounded-none bg-emerald-500 text-white hover:bg-emerald-600"
                onClick={onAssign}
                disabled={assigning}
              >
                {assigning ? "Đang tạo..." : "Tạo tài khoản"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
