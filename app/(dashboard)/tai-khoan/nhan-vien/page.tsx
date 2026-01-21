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
  departmentId?: string | null;
  positionId?: string | null;
};

type DepartmentOption = {
  id: string;
  name: string;
};

type PositionOption = {
  id: string;
  name: string;
};

function isValidEmail(value: string | null | undefined) {
  if (!value) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export default function TaiKhoanNhanVienPage() {
  const [items, setItems] = useState<EmployeeItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [q, setQ] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");
  const [sortField, setSortField] = useState<"createdAt" | "fullName" | "code">("createdAt");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [departments, setDepartments] = useState<DepartmentOption[]>([]);
  const [positions, setPositions] = useState<PositionOption[]>([]);
  const [departmentFilter, setDepartmentFilter] = useState("");
  const [positionFilter, setPositionFilter] = useState("");
  const [assignOpen, setAssignOpen] = useState(false);
  const [assignEmail, setAssignEmail] = useState("");
  const [assignPassword, setAssignPassword] = useState("");
  const [assignPassword2, setAssignPassword2] = useState("");
  const [assigning, setAssigning] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<EmployeeItem | null>(null);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkPassword, setBulkPassword] = useState("");
  const [bulkPassword2, setBulkPassword2] = useState("");
  const [bulkAssigning, setBulkAssigning] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const pageSize = 50;

  const totalPages = useMemo(() => Math.max(1, Math.ceil(total / pageSize)), [total, pageSize]);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(q.trim()), 300);
    return () => clearTimeout(t);
  }, [q]);

  useEffect(() => {
    setPage(1);
  }, [debouncedQ, sortField, sortOrder, departmentFilter, positionFilter]);

  useEffect(() => {
    let active = true;
    async function fetchMeta() {
      try {
        const [deptRes, posRes] = await Promise.all([fetch("/api/bo-phan"), fetch("/api/chuc-vu")]);
        const deptData = deptRes.ok ? ((await deptRes.json()) as { items?: DepartmentOption[] }) : { items: [] };
        const posData = posRes.ok ? ((await posRes.json()) as { items?: PositionOption[] }) : { items: [] };
        if (!active) return;
        setDepartments(deptData.items ?? []);
        setPositions(posData.items ?? []);
      } catch (error) {
        console.error(error);
        toast.error("Không tải được bộ phận/chức vụ.");
      }
    }
    fetchMeta();
    return () => {
      active = false;
    };
  }, []);

  const fetchEmployees = async (pageNumber: number) => {
    setLoading(true);
    try {
      const query = new URLSearchParams();
      if (debouncedQ) query.set("q", debouncedQ);
      query.set("sort", sortField);
      query.set("order", sortOrder);
      query.set("withoutAccount", "true");
      if (departmentFilter) query.set("departmentId", departmentFilter);
      if (positionFilter) query.set("positionId", positionFilter);
      query.set("page", String(pageNumber));
      query.set("pageSize", String(pageSize));
      const res = await fetch(`/api/nhan-vien?${query.toString()}`);
      if (!res.ok) throw new Error("Không tải được danh sách");
      const data = (await res.json()) as { items?: EmployeeItem[]; total?: number };
      setItems(data.items ?? []);
      setTotal(data.total ?? 0);
      setSelectedIds(new Set());
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

  const toggleSelect = (employee: EmployeeItem) => {
    if (!isValidEmail(employee.personalEmail)) return;
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(employee.id)) next.delete(employee.id);
      else next.add(employee.id);
      return next;
    });
  };

  const selectAllValid = () => {
    const next = new Set<string>();
    items.forEach((item) => {
      if (isValidEmail(item.personalEmail)) next.add(item.id);
    });
    setSelectedIds(next);
  };

  const clearSelected = () => setSelectedIds(new Set());

  const openBulkAssign = () => {
    if (selectedIds.size === 0) {
      toast.error("Vui lòng chọn nhân viên có email hợp lệ.");
      return;
    }
    setBulkPassword("");
    setBulkPassword2("");
    setBulkOpen(true);
  };

  const onBulkAssign = async () => {
    if (!bulkPassword.trim()) {
      toast.error("Vui lòng nhập mật khẩu.");
      return;
    }
    if (bulkPassword !== bulkPassword2) {
      toast.error("Mật khẩu không khớp.");
      return;
    }
    const targets = items.filter((item) => selectedIds.has(item.id));
    const invalid = targets.filter((item) => !isValidEmail(item.personalEmail));
    if (invalid.length > 0) {
      toast.error("Có nhân viên chưa có email hợp lệ.");
      return;
    }
    setBulkAssigning(true);
    try {
      for (const item of targets) {
        const res = await fetch(`/api/nhan-vien/${item.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            fullName: item.fullName,
            accountEmail: item.personalEmail,
            accountPassword: bulkPassword.trim(),
          }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.message || "Cấp tài khoản thất bại");
      }
      toast.success(`Đã cấp tài khoản cho ${targets.length} nhân viên.`);
      setBulkOpen(false);
      await fetchEmployees(page);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Cấp tài khoản thất bại";
      toast.error(message);
    } finally {
      setBulkAssigning(false);
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
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:flex-1">
          <Input
            placeholder="Tìm theo mã / tên nhân viên..."
            value={q}
            onChange={(e) => setQ(e.target.value)}
            name="employee-search"
            autoComplete="off"
            className="rounded-none w-full sm:max-w-xs focus-visible:ring-0 focus-visible:ring-offset-0 focus:border-slate-300"
          />
          <select
            value={departmentFilter}
            onChange={(event) => setDepartmentFilter(event.target.value)}
            className="rounded-none border border-slate-300 bg-white px-2 py-1.5 text-sm w-full sm:w-auto"
          >
            <option value="">Tất cả bộ phận</option>
            {departments.map((dept) => (
              <option key={dept.id} value={dept.id}>
                {dept.name}
              </option>
            ))}
          </select>
          <select
            value={positionFilter}
            onChange={(event) => setPositionFilter(event.target.value)}
            className="rounded-none border border-slate-300 bg-white px-2 py-1.5 text-sm w-full sm:w-auto"
          >
            <option value="">Tất cả chức vụ</option>
            {positions.map((pos) => (
              <option key={pos.id} value={pos.id}>
                {pos.name}
              </option>
            ))}
          </select>
        </div>
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

      <div className="flex flex-wrap items-center gap-2 text-sm">
        <Button
          type="button"
          variant="outline"
          className="rounded-none"
          onClick={selectAllValid}
          disabled={loading}
        >
          Chọn email hợp lệ
        </Button>
        <Button type="button" variant="outline" className="rounded-none" onClick={clearSelected} disabled={loading}>
          Bỏ chọn
        </Button>
        <Button
          type="button"
          className="rounded-none bg-emerald-500 text-white hover:bg-emerald-600"
          onClick={openBulkAssign}
          disabled={selectedIds.size === 0 || loading}
        >
          Cấp cho {selectedIds.size} nhân viên đã chọn
        </Button>
      </div>

      <div className="border bg-white overflow-x-auto rounded-lg">
        <Table>
          <TableHeader>
            <TableRow className="bg-slate-100">
              <TableHead className="w-12 text-center bg-slate-100 whitespace-nowrap">Chọn</TableHead>
              <TableHead className="w-12 text-center bg-slate-100 whitespace-nowrap">STT</TableHead>
              <TableHead className="min-w-25 text-center bg-slate-100 whitespace-nowrap">Mã NV</TableHead>
              <TableHead className="min-w-45 text-center bg-slate-100 whitespace-nowrap">Họ tên</TableHead>
              <TableHead className="min-w-45 text-center bg-slate-100 whitespace-nowrap hidden md:table-cell">
                Email
              </TableHead>
              <TableHead className="min-w-30 text-center bg-slate-100 whitespace-nowrap hidden md:table-cell">Bộ phận</TableHead>
              <TableHead className="min-w-30 text-center bg-slate-100 whitespace-nowrap hidden md:table-cell">Chức vụ</TableHead>
              <TableHead className="w-32 text-center bg-slate-100 whitespace-nowrap">Thao tác</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={8} className="py-10 text-center text-sm text-muted-foreground">
                  Đang tải...
                </TableCell>
              </TableRow>
            ) : items.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="py-10 text-center text-sm text-muted-foreground">
                  Không có nhân viên chưa có tài khoản
                </TableCell>
              </TableRow>
            ) : (
              items.map((item, idx) => (
                <TableRow key={item.id}>
                  <TableCell className="text-center">
                    <input
                      type="checkbox"
                      className="h-4 w-4 accent-emerald-600"
                      checked={selectedIds.has(item.id)}
                      disabled={!isValidEmail(item.personalEmail)}
                      onChange={() => toggleSelect(item)}
                    />
                  </TableCell>
                  <TableCell className="text-center text-sm text-slate-500">
                    {(page - 1) * pageSize + idx + 1}
                  </TableCell>
                  <TableCell className="text-center font-medium">{item.code}</TableCell>
                  <TableCell className="text-center">{item.fullName}</TableCell>
                  <TableCell className="text-center hidden md:table-cell">
                    {item.personalEmail ?? "—"}
                  </TableCell>
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

      <Dialog open={bulkOpen} onOpenChange={setBulkOpen}>
        <DialogContent className="rounded-none max-w-[calc(100vw-2rem)] sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Cấp tài khoản hàng loạt</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="text-sm text-slate-600">
              Số nhân viên: <span className="font-semibold text-slate-900">{selectedIds.size}</span>
            </div>
            <div className="space-y-1">
              <label className="text-sm text-slate-600">Mật khẩu dùng chung</label>
              <Input
                value={bulkPassword}
                onChange={(e) => setBulkPassword(e.target.value)}
                type="password"
                name="bulk-password"
                autoComplete="new-password"
                className="rounded-none"
              />
            </div>
            <div className="space-y-1">
              <label className="text-sm text-slate-600">Nhập lại mật khẩu</label>
              <Input
                value={bulkPassword2}
                onChange={(e) => setBulkPassword2(e.target.value)}
                type="password"
                name="bulk-password-confirm"
                autoComplete="new-password"
                className="rounded-none"
              />
            </div>
            <div className="flex flex-col-reverse sm:flex-row justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="destructive"
                className="rounded-none"
                onClick={() => setBulkOpen(false)}
                disabled={bulkAssigning}
              >
                Huỷ
              </Button>
              <Button
                type="button"
                className="rounded-none bg-emerald-500 text-white hover:bg-emerald-600"
                onClick={onBulkAssign}
                disabled={bulkAssigning}
              >
                {bulkAssigning ? "Đang tạo..." : "Cấp tài khoản"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
