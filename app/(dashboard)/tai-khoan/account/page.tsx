"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

type AccountItem = {
  id: string;
  email: string;
  roleKey: string;
  status: string;
  createdAt: string | Date;
  employeeId: string | null;
  employeeCode: string | null;
  employeeName: string | null;
};

type EmployeeOption = { id: string; name: string; code: string; hasAccount: boolean; accountEmail?: string | null };
type EmployeeApiItem = {
  id: string;
  fullName: string;
  code: string;
  accountEmail?: string | null;
  personalEmail?: string | null;
};
type EmployeeDetailForAssign = EmployeeOption & { personalEmail?: string | null };

export default function TaiKhoanPage() {
  const [items, setItems] = useState<AccountItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [employees, setEmployees] = useState<EmployeeDetailForAssign[]>([]);
  const [assignOpen, setAssignOpen] = useState(false);
  const [assignEmail, setAssignEmail] = useState("");
  const [assignPassword, setAssignPassword] = useState("");
  const [assignPassword2, setAssignPassword2] = useState("");
  const [assignEmployeeId, setAssignEmployeeId] = useState("");
  const [assignAccountId, setAssignAccountId] = useState("");
  const [assignMode, setAssignMode] = useState<"create" | "link">("create");
  const [assignEmployeeQuery, setAssignEmployeeQuery] = useState("");
  const [assignEmployeeQueryDebounced, setAssignEmployeeQueryDebounced] = useState("");
  const [assignEmployeeLoading, setAssignEmployeeLoading] = useState(false);
  const [savingAssign, setSavingAssign] = useState(false);
  const [unassigning, setUnassigning] = useState<string | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [selectedAcc, setSelectedAcc] = useState<AccountItem | null>(null);
  const [processingEdit, setProcessingEdit] = useState(false);
  const [editStatus, setEditStatus] = useState<"ACTIVE" | "DISABLED">("ACTIVE");
  const [editEmail, setEditEmail] = useState("");
  const [editPassword, setEditPassword] = useState("");
  const [editPassword2, setEditPassword2] = useState("");
  const [editRole, setEditRole] = useState<string>("EMPLOYEE");
  const [emailLocked, setEmailLocked] = useState(true);
  const [passwordLocked, setPasswordLocked] = useState(true);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [q, setQ] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");
  const [sortField, setSortField] = useState<"createdAt" | "email" | "employee" | "status">("createdAt");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [filterRole, setFilterRole] = useState<string>("");
  const [filterStatus, setFilterStatus] = useState<string>("");

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(q.trim()), 300);
    return () => clearTimeout(t);
  }, [q]);

  useEffect(() => {
    const t = setTimeout(() => setAssignEmployeeQueryDebounced(assignEmployeeQuery.trim()), 300);
    return () => clearTimeout(t);
  }, [assignEmployeeQuery]);

  const openEdit = (acc: AccountItem) => {
    setSelectedAcc(acc);
    setEditStatus(acc.status === "ACTIVE" ? "ACTIVE" : "DISABLED");
    setEditEmail(acc.email);
    setEditPassword("");
    setEditRole(acc.roleKey);
    setEmailLocked(true);
    setPasswordLocked(true);
    setEditOpen(true);
  };

  const fetchAccounts = async (params?: {
    q?: string;
    sort?: string;
    order?: string;
    roleKey?: string;
    status?: string;
  }) => {
    setLoading(true);
    try {
      const query = new URLSearchParams();
      if (params?.q) query.set("q", params.q);
      if (params?.sort) query.set("sort", params.sort);
      if (params?.order) query.set("order", params.order);
      if (params?.roleKey) query.set("roleKey", params.roleKey);
      if (params?.status) query.set("status", params.status);
      const res = await fetch(`/api/tai-khoan${query.toString() ? `?${query.toString()}` : ""}`);
      if (!res.ok) throw new Error("Không tải được tài khoản");
      const data = (await res.json()) as { items?: AccountItem[] };
      setItems(data.items ?? []);
    } catch (error) {
      console.error(error);
      toast.error("Không tải được danh sách tài khoản");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAccounts({
      q: debouncedQ,
      sort: sortField,
      order: sortOrder,
      roleKey: filterRole || undefined,
      status: filterStatus || undefined,
    });
  }, [debouncedQ, sortField, sortOrder, filterRole, filterStatus]);

  const fetchEmployees = async (query?: string) => {
    setAssignEmployeeLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("order", "asc");
      params.set("sort", "fullName");
      params.set("pageSize", "50");
      if (query) params.set("q", query);
      const res = await fetch(`/api/nhan-vien?${params.toString()}`);
      if (!res.ok) return;
      const data = (await res.json()) as { items?: EmployeeApiItem[] };
      const opts = (data.items ?? []).map((e) => ({
        id: e.id,
        name: e.fullName,
        code: e.code,
        personalEmail: e.personalEmail,
        hasAccount: !!e.accountEmail,
        accountEmail: e.accountEmail ?? null,
      }));
      setEmployees(opts);
    } catch (error) {
      console.error(error);
    } finally {
      setAssignEmployeeLoading(false);
    }
  };

  useEffect(() => {
    if (!assignOpen) return;
    fetchEmployees(assignEmployeeQueryDebounced || undefined);
  }, [assignOpen, assignEmployeeQueryDebounced]);

  const refreshAccounts = () =>
    fetchAccounts({
      q: debouncedQ,
      sort: sortField,
      order: sortOrder,
      roleKey: filterRole || undefined,
      status: filterStatus || undefined,
    });

  const saveAssign = async () => {
    if (!assignEmployeeId) {
      toast.error("Chọn nhân viên");
      return;
    }

    if (assignMode === "create") {
      if (!assignEmail.trim()) {
        toast.error("Nhập email");
        return;
      }
      if (!assignPassword.trim()) {
        toast.error("Nhập mật khẩu");
        return;
      }
      if (assignPassword !== assignPassword2) {
        toast.error("Mật khẩu nhập lại không khớp");
        return;
      }
      const alreadyHas = items.find((i) => i.employeeId === assignEmployeeId);
      if (alreadyHas) {
        toast.error("Nhân viên này đã có tài khoản");
        return;
      }
    } else {
      if (!assignAccountId) {
        toast.error("Chọn tài khoản để gán");
        return;
      }
      const acc = items.find((i) => i.id === assignAccountId);
      if (acc?.employeeId) {
        toast.error("Tài khoản này đã gắn nhân viên khác");
        return;
      }
      const alreadyHas = items.find((i) => i.employeeId === assignEmployeeId);
      if (alreadyHas) {
        toast.error("Nhân viên này đã có tài khoản");
        return;
      }
    }

    setSavingAssign(true);
    try {
      const emailToUse =
        assignMode === "create"
          ? assignEmail.trim()
          : items.find((i) => i.id === assignAccountId)?.email ?? "";

      const empName = employees.find((e) => e.id === assignEmployeeId)?.name || " ";

      const res = await fetch(`/api/nhan-vien/${assignEmployeeId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName: empName,
          accountEmail: emailToUse,
          accountPassword: assignPassword.trim() || undefined,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => null);
        throw new Error(err?.message || "Gán tài khoản thất bại");
      }
      toast.success("Đã gán / tạo tài khoản");
      setAssignOpen(false);
      setAssignEmail("");
      setAssignPassword("");
      setAssignPassword2("");
      setAssignEmployeeId("");
      setAssignAccountId("");
      refreshAccounts();
      fetchEmployees();
    } catch (error) {
      console.error(error);
      toast.error(error instanceof Error ? error.message : "Gán tài khoản thất bại");
    } finally {
      setSavingAssign(false);
    }
  };

  const unassign = async (acc: AccountItem) => {
    if (!acc.employeeId) return;
    setUnassigning(acc.id);
    try {
      const res = await fetch(`/api/nhan-vien/${acc.employeeId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fullName: acc.employeeName || " ", accountEmail: null }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => null);
        throw new Error(err?.message || "Bỏ gán thất bại");
      }
      toast.success("Đã bỏ gán tài khoản");
      refreshAccounts();
      fetchEmployees();
    } catch (error) {
      console.error(error);
      toast.error(error instanceof Error ? error.message : "Bỏ gán thất bại");
    } finally {
      setUnassigning(null);
    }
  };

  const deleteAccount = async (acc: AccountItem) => {
    setProcessingEdit(true);
    try {
      const res = await fetch(`/api/tai-khoan/${acc.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Xoá tài khoản thất bại");
      toast.success("Đã xoá tài khoản");
      setEditOpen(false);
      setSelectedAcc(null);
      refreshAccounts();
      fetchEmployees();
    } catch (error) {
      console.error(error);
      toast.error(error instanceof Error ? error.message : "Xoá tài khoản thất bại");
    } finally {
      setProcessingEdit(false);
    }
  };

  const updateStatus = async (acc: AccountItem) => {
    setProcessingEdit(true);
    try {
      const pwd = passwordLocked ? "" : editPassword.trim();
      const pwd2 = passwordLocked ? "" : editPassword2.trim();
      if (pwd || pwd2) {
        if (!pwd || !pwd2) {
          toast.error("Nhập đầy đủ mật khẩu và nhập lại");
          setConfirmOpen(false);
          setProcessingEdit(false);
          return;
        }
        if (pwd !== pwd2) {
          toast.error("Mật khẩu nhập lại không khớp");
          setConfirmOpen(false);
          setProcessingEdit(false);
          return;
        }
      }

      const res = await fetch(`/api/tai-khoan/${acc.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: editStatus,
          email: editEmail,
          password: pwd || undefined,
          roleKey: editRole,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => null);
        throw new Error(err?.message || "Cập nhật thất bại");
      }
      toast.success("Đã cập nhật trạng thái");
      await refreshAccounts();
      setEditOpen(false);
      setSelectedAcc(null);
      setEditPassword("");
      setEditPassword2("");
      setPasswordLocked(true);
    } catch (error) {
      console.error(error);
      toast.error(error instanceof Error ? error.message : "Cập nhật thất bại");
    } finally {
      setProcessingEdit(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="space-y-3">
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-3">
          <div className="space-y-1">
            <h2 className="text-xl font-semibold">Danh sách tài khoản</h2>
            <p className="text-sm text-muted-foreground leading-snug">
              Tài khoản gắn với nhân viên để đăng nhập. Bạn có thể sửa email trong trang chỉnh sửa nhân viên.
            </p>
          </div>
         <div className="w-full lg:w-auto flex flex-col sm:flex-row gap-2 sm:items-center">
           <div className="flex flex-col sm:flex-row gap-2 sm:items-center w-full sm:w-auto">
             <Input
               value={q}
               onChange={(e) => setQ(e.target.value)}
               placeholder="Tìm email / nhân viên..."
               className="rounded-none w-full sm:w-64 focus-visible:ring-0 focus-visible:ring-offset-0 focus:border-slate-300"
             />
             <div className="flex gap-2">
               <select
                 value={sortField}
                 onChange={(e) => setSortField(e.target.value as typeof sortField)}
                 className="rounded-none border border-slate-300 bg-white px-2 py-2 text-sm"
               >
                 <option value="createdAt">Ngày tạo</option>
                 <option value="email">Email</option>
                 <option value="employee">Nhân viên</option>
                 <option value="status">Trạng thái</option>
               </select>
               <select
                 value={sortOrder}
                 onChange={(e) => setSortOrder(e.target.value as typeof sortOrder)}
                 className="rounded-none border border-slate-300 bg-white px-2 py-2 text-sm"
               >
                 <option value="asc">Tăng dần</option>
                 <option value="desc">Giảm dần</option>
               </select>
             </div>
           </div>
            <div className="flex flex-col sm:flex-row gap-2 sm:items-center w-full sm:w-auto">
              <label className="text-sm text-slate-600 whitespace-nowrap">Bộ lọc:</label>
              <select
                value={filterRole}
                onChange={(e) => setFilterRole(e.target.value)}
                className="rounded-none border border-slate-300 bg-white px-2 py-2 text-sm min-w-32"
              >
                <option value="">Tất cả quyền</option>
                <option value="ADMIN">Quản trị</option>
                <option value="DIRECTOR">Giám đốc</option>
                <option value="STAFF">Nhân sự</option>
                <option value="EMPLOYEE">Nhân viên</option>
              </select>
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="rounded-none border border-slate-300 bg-white px-2 py-2 text-sm min-w-28"
              >
                <option value="">Tất cả trạng thái</option>
                <option value="ACTIVE">Hoạt động</option>
                <option value="DISABLED">Khoá</option>
              </select>
            </div>
            <Button
              type="button"
              className="w-full sm:w-auto rounded-none bg-emerald-500 text-white hover:bg-emerald-600"
              onClick={() => setAssignOpen(true)}
            >
              Gán / tạo tài khoản
            </Button>
          </div>
        </div>
      </div>

      <div className="overflow-x-auto border bg-white rounded">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-100">
            <tr>
              <th className="px-3 py-2 text-left text-xs font-semibold text-slate-600 whitespace-nowrap hidden sm:table-cell">
                STT
              </th>
              <th className="px-3 py-2 text-left text-xs font-semibold text-slate-600 whitespace-nowrap">Email</th>
              <th className="px-3 py-2 text-left text-xs font-semibold text-slate-600 whitespace-nowrap">Nhân viên</th>
              <th className="px-3 py-2 text-left text-xs font-semibold text-slate-600 whitespace-nowrap hidden md:table-cell">
                Quyền
              </th>
              <th className="px-3 py-2 text-left text-xs font-semibold text-slate-600 whitespace-nowrap hidden lg:table-cell">
                Trạng thái
              </th>
              <th className="px-3 py-2 text-left text-xs font-semibold text-slate-600 whitespace-nowrap hidden lg:table-cell">
                Tạo lúc
              </th>
              <th className="px-3 py-2 text-left text-xs font-semibold text-slate-600 whitespace-nowrap hidden sm:table-cell">
                Thao tác
              </th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={7} className="px-3 py-6 text-center text-sm text-slate-500">
                  Đang tải...
                </td>
              </tr>
            ) : items.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-3 py-6 text-center text-sm text-slate-500">
                  Chưa có tài khoản nào
                </td>
              </tr>
            ) : (
              items.map((acc, idx) => (
                <tr key={acc.id} className="border-t">
                  <td className="px-3 py-2 text-slate-600 hidden sm:table-cell">{idx + 1}</td>
                  <td className="px-3 py-2 font-medium text-slate-900">
                    <button
                      type="button"
                      className="text-left w-full hover:underline text-blue-700"
                      onClick={() => openEdit(acc)}
                    >
                      {acc.email}
                    </button>
                  </td>
                  <td className="px-3 py-2">
                    {acc.employeeId ? (
                      <div className="flex flex-col">
                        <Link href={`/nhan-vien/${acc.employeeId}`} className="text-blue-600 hover:underline">
                          {acc.employeeName}
                        </Link>
                        <span className="text-xs text-slate-500">{acc.employeeCode}</span>
                      </div>
                    ) : (
                      <span className="text-slate-500">—</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-slate-700 hidden md:table-cell">
                    {acc.roleKey === "ADMIN"
                      ? "Quản trị"
                      : acc.roleKey === "DIRECTOR"
                        ? "Giám đốc"
                        : acc.roleKey === "STAFF"
                          ? "Nhân sự"
                          : "Nhân viên"}
                  </td>
                  <td className="px-3 py-2 hidden lg:table-cell">
                    {acc.status === "ACTIVE" ? (
                      <span className="text-emerald-600 font-semibold text-xs bg-emerald-50 border border-emerald-100 px-2 py-1 rounded">
                        Hoạt động
                      </span>
                    ) : (
                      <span className="text-slate-500 text-xs bg-slate-50 border border-slate-200 px-2 py-1 rounded">
                        Khóa
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-slate-600 hidden lg:table-cell">
                    {acc.createdAt ? new Intl.DateTimeFormat("vi-VN").format(new Date(acc.createdAt)) : "—"}
                  </td>
                  <td className="px-3 py-2 hidden sm:table-cell">
                    {acc.roleKey === "ADMIN" ? (
                      <span className="text-xs text-slate-500">—</span>
                    ) : (
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          className="rounded-none text-blue-600 border-blue-500"
                          onClick={() => openEdit(acc)}
                        >
                          Sửa
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          className="rounded-none bg-red-500 text-white hover:bg-red-600"
                          onClick={() => deleteAccount(acc)}
                          disabled={processingEdit}
                        >
                          Xoá
                        </Button>
                      </div>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <Dialog open={assignOpen} onOpenChange={setAssignOpen}>
        <DialogContent className="rounded-none max-w-lg w-full max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Gán / tạo tài khoản</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="radio"
                  name="assignMode"
                  value="create"
                  checked={assignMode === "create"}
                  onChange={() => setAssignMode("create")}
                />
                Tạo mới theo email
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="radio"
                  name="assignMode"
                  value="link"
                  checked={assignMode === "link"}
                  onChange={() => setAssignMode("link")}
                />
                Gán tài khoản có sẵn
              </label>
            </div>
            <div>
              <label className="text-sm text-slate-600">Tìm nhân viên</label>
              <div className="flex gap-2">
                <Input
                  value={assignEmployeeQuery}
                  onChange={(e) => setAssignEmployeeQuery(e.target.value)}
                  placeholder="Nhập tên hoặc mã nhân viên"
                  className="rounded-none"
                />
                <Button
                  type="button"
                  variant="outline"
                  className="rounded-none"
                  onClick={() => fetchEmployees(assignEmployeeQuery.trim() || undefined)}
                  disabled={assignEmployeeLoading}
                >
                  {assignEmployeeLoading ? "Đang tìm..." : "Tìm"}
                </Button>
              </div>
              <div className="mt-2 max-h-56 overflow-y-auto rounded-none border border-slate-300 bg-white text-sm">
                {assignEmployeeLoading ? (
                  <div className="px-3 py-2 text-slate-500">Đang tải...</div>
                ) : employees.length === 0 ? (
                  <div className="px-3 py-2 text-slate-500">Không có nhân viên phù hợp.</div>
                ) : (
                  employees.map((e) => (
                    <button
                      key={e.id}
                      type="button"
                      className="flex w-full items-center justify-between border-b border-slate-200 px-3 py-2 text-left last:border-b-0 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                      onClick={() => {
                        setAssignEmployeeId(e.id);
                        if (assignMode === "create" && e.personalEmail) {
                          setAssignEmail(e.personalEmail);
                        }
                      }}
                      disabled={e.hasAccount}
                    >
                      <div>
                        <div className="font-medium">{e.name}</div>
                        <div className="text-xs text-slate-500">{e.code}</div>
                      </div>
                      {assignEmployeeId === e.id ? (
                        <span className="text-xs text-emerald-600">Đã chọn</span>
                      ) : e.hasAccount ? (
                        <span className="text-xs text-slate-400">Đã có tài khoản</span>
                      ) : null}
                    </button>
                  ))
                )}
              </div>
              <p className="text-xs text-slate-500 mt-1">Nhân viên đã có tài khoản sẽ bị khoá chọn.</p>
            </div>
            {assignMode === "create" ? (
              <div>
                <label className="text-sm text-slate-600">Email</label>
                <Input
                  type="email"
                  value={assignEmail}
                  onChange={(e) => setAssignEmail(e.target.value)}
                  placeholder="user@example.com"
                  className="rounded-none"
                />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2">
                  <div className="space-y-1">
                    <label className="text-sm text-slate-600">Mật khẩu</label>
                    <Input
                      type="password"
                      value={assignPassword}
                      onChange={(e) => setAssignPassword(e.target.value)}
                      className="rounded-none"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-sm text-slate-600">Nhập lại mật khẩu</label>
                    <Input
                      type="password"
                      value={assignPassword2}
                      onChange={(e) => setAssignPassword2(e.target.value)}
                      className="rounded-none"
                    />
                  </div>
                </div>
                <p className="text-xs text-slate-500">
                  Email chưa có tài khoản sẽ được tạo mới; nếu email đã có tài khoản chưa gắn ai sẽ gán vào nhân viên này.
                </p>
              </div>
            ) : (
              <div>
                <label className="text-sm text-slate-600">Chọn tài khoản chưa gắn nhân viên</label>
                <select
                  value={assignAccountId}
                  onChange={(e) => setAssignAccountId(e.target.value)}
                  className="w-full rounded-none border border-slate-300 bg-white px-3 py-2 text-sm"
                >
                  <option value="">-- Chọn tài khoản --</option>
                  {items
                    .filter((i) => !i.employeeId)
                    .map((i) => (
                      <option key={i.id} value={i.id}>
                        {i.email}
                      </option>
                    ))}
                </select>
                <p className="text-xs text-slate-500">Chỉ liệt kê tài khoản chưa gắn nhân viên.</p>
              </div>
            )}
            <div className="flex justify-end gap-2">
              <Button variant="destructive" className="rounded-none" onClick={() => setAssignOpen(false)} disabled={savingAssign}>
                Huỷ
              </Button>
              <Button
                className="rounded-none bg-emerald-500 text-white hover:bg-emerald-600"
                onClick={saveAssign}
                disabled={savingAssign}
              >
                {savingAssign ? "Đang lưu..." : "Lưu"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="rounded-none max-w-lg w-full max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Sửa tài khoản</DialogTitle>
          </DialogHeader>
          {selectedAcc ? (
            <div className="space-y-3">
              <div className="text-sm">
                <div className="font-semibold text-slate-900">{selectedAcc.email}</div>
                <div className="text-slate-600 text-xs">
                  {selectedAcc.employeeId ? (
                    <>
                      Gắn với: <Link href={`/nhan-vien/${selectedAcc.employeeId}`} className="text-blue-600 hover:underline">{selectedAcc.employeeName}</Link>{" "}
                      ({selectedAcc.employeeCode})
                    </>
                  ) : (
                    "Chưa gắn nhân viên"
                  )}
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-sm text-slate-600">Email</label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="rounded-none text-blue-600 border-blue-500"
                    onClick={() => setEmailLocked((v) => !v)}
                  >
                    {emailLocked ? "Sửa" : "Khoá"}
                  </Button>
                </div>
                <Input
                  type="email"
                  value={editEmail}
                  onChange={(e) => setEditEmail(e.target.value)}
                  className="rounded-none"
                  disabled={processingEdit || emailLocked}
                />
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-sm text-slate-600">Mật khẩu mới (tuỳ chọn)</label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="rounded-none text-blue-600 border-blue-500"
                    onClick={() => setPasswordLocked((v) => !v)}
                  >
                    {passwordLocked ? "Sửa" : "Khoá"}
                  </Button>
                </div>
                <Input
                  type="password"
                  value={editPassword}
                  onChange={(e) => setEditPassword(e.target.value)}
                  placeholder="Nhập để reset mật khẩu"
                  className="rounded-none"
                  disabled={processingEdit || passwordLocked}
                />
                <Input
                  type="password"
                  value={editPassword2}
                  onChange={(e) => setEditPassword2(e.target.value)}
                  placeholder="Nhập lại mật khẩu"
                  className="rounded-none"
                  disabled={processingEdit || passwordLocked}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm text-slate-600">Trạng thái</label>
                <select
                  value={editStatus}
                  onChange={(e) => setEditStatus(e.target.value as "ACTIVE" | "DISABLED")}
                  className="w-full rounded-none border border-slate-300 bg-white px-3 py-2 text-sm"
                  disabled={processingEdit}
                >
                  <option value="ACTIVE">Hoạt động</option>
                  <option value="DISABLED">Khóa</option>
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-sm text-slate-600">Quyền</label>
                <select
                  value={editRole}
                  onChange={(e) => setEditRole(e.target.value)}
                  className="w-full rounded-none border border-slate-300 bg-white px-3 py-2 text-sm"
                  disabled={processingEdit}
                >
                  <option value="ADMIN">Quản trị</option>
                  <option value="DIRECTOR">Giám đốc</option>
                  <option value="STAFF">Nhân sự</option>
                  <option value="EMPLOYEE">Nhân viên</option>
                </select>
              </div>
              <div className="space-y-2">
                {selectedAcc.employeeId && (
                  <Button
                    variant="outline"
                    className="rounded-none w-full"
                    onClick={() => unassign(selectedAcc)}
                    disabled={unassigning === selectedAcc.id || processingEdit}
                  >
                    {unassigning === selectedAcc.id ? "Đang bỏ gán..." : "Bỏ gán nhân viên"}
                  </Button>
                )}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <Button
                    variant="outline"
                    className="rounded-none w-full bg-blue-500 text-white hover:bg-blue-600"
                    onClick={() => setConfirmOpen(true)}
                    disabled={processingEdit}
                  >
                    {processingEdit ? "Đang lưu..." : "Lưu thay đổi"}
                  </Button>
                  <Button
                    variant="destructive"
                    className="rounded-none w-full bg-red-500 text-white hover:bg-red-600 border border-red-600"
                    onClick={() => setConfirmDeleteOpen(true)}
                    disabled={processingEdit}
                  >
                    Xoá tài khoản
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-sm text-slate-500">Chọn tài khoản để sửa</div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="rounded-none max-w-sm w-full">
          <DialogHeader>
            <DialogTitle>Xác nhận lưu thay đổi</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 text-sm text-slate-700">
            <div>Email: <span className="font-semibold">{editEmail}</span></div>
            <div>Quyền: <span className="font-semibold">{editRole}</span></div>
            <div>Trạng thái: <span className="font-semibold">{editStatus === "ACTIVE" ? "Hoạt động" : "Khóa"}</span></div>
            {editPassword && <div>Mật khẩu: <span className="font-semibold">Sẽ đặt lại</span></div>}
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="destructive" className="rounded-none" onClick={() => setConfirmOpen(false)} disabled={processingEdit}>
              Huỷ
            </Button>
            <Button
              className="rounded-none bg-emerald-500 text-white hover:bg-emerald-600"
              onClick={() => {
                setConfirmOpen(false);
                if (selectedAcc) updateStatus(selectedAcc);
              }}
              disabled={processingEdit}
            >
              Xác nhận lưu
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={confirmDeleteOpen} onOpenChange={setConfirmDeleteOpen}>
        <DialogContent className="rounded-none max-w-sm w-full">
          <DialogHeader>
            <DialogTitle>Xác nhận xoá tài khoản</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 text-sm text-slate-700">
            <p>Bạn chắc chắn muốn xoá tài khoản này? Thao tác không thể hoàn tác.</p>
            {selectedAcc && <p className="font-semibold">{selectedAcc.email}</p>}
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" className="rounded-none" onClick={() => setConfirmDeleteOpen(false)} disabled={processingEdit}>
              Huỷ
            </Button>
            <Button
              variant="destructive"
              className="rounded-none bg-red-500 text-white hover:bg-red-600 border border-red-600"
              onClick={() => {
                setConfirmDeleteOpen(false);
                if (selectedAcc) deleteAccount(selectedAcc);
              }}
              disabled={processingEdit}
            >
              Xác nhận xoá
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
