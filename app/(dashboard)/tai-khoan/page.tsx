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

type EmployeeOption = { id: string; name: string; code: string };
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

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const res = await fetch("/api/tai-khoan");
        if (!res.ok) throw new Error("Không tải được tài khoản");
        const data = (await res.json()) as { items?: AccountItem[] };
        setItems(data.items ?? []);
      } catch (error) {
        console.error(error);
        toast.error("Không tải được danh sách tài khoản");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const fetchEmployees = async () => {
    try {
      const res = await fetch("/api/nhan-vien?order=desc&sort=fullName");
      if (!res.ok) return;
      const data = (await res.json()) as { items?: EmployeeApiItem[] };
      const opts = (data.items ?? [])
        .filter((e) => !e.accountEmail) // chỉ nhân viên chưa có tài khoản
        .map((e) => ({
          id: e.id,
          name: e.fullName,
          code: e.code,
          personalEmail: e.personalEmail,
        }));
      setEmployees(opts);
    } catch (error) {
      console.error(error);
    }
  };

  useEffect(() => {
    fetchEmployees();
  }, []);

  const refreshAccounts = async () => {
    try {
      const res = await fetch("/api/tai-khoan");
      if (!res.ok) throw new Error();
      const data = (await res.json()) as { items?: AccountItem[] };
      setItems(data.items ?? []);
    } catch (error) {
      toast.error("Không tải được danh sách tài khoản");
    }
  };

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
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-semibold">Danh sách tài khoản</h2>
          <p className="text-sm text-muted-foreground">
            Tài khoản gắn với nhân viên để đăng nhập. Bạn có thể sửa email trong trang chỉnh sửa nhân viên.
          </p>
        </div>
        <Button
          type="button"
          className="rounded-none bg-emerald-500 text-white hover:bg-emerald-600"
          onClick={() => setAssignOpen(true)}
        >
          Gán / tạo tài khoản
        </Button>
      </div>

      <div className="overflow-x-auto border bg-white">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-100">
            <tr>
              <th className="px-3 py-2 text-left text-xs font-semibold text-slate-600 whitespace-nowrap">#</th>
              <th className="px-3 py-2 text-left text-xs font-semibold text-slate-600 whitespace-nowrap">Email</th>
              <th className="px-3 py-2 text-left text-xs font-semibold text-slate-600 whitespace-nowrap">Nhân viên</th>
              <th className="px-3 py-2 text-left text-xs font-semibold text-slate-600 whitespace-nowrap">Quyền</th>
              <th className="px-3 py-2 text-left text-xs font-semibold text-slate-600 whitespace-nowrap">Trạng thái</th>
              <th className="px-3 py-2 text-left text-xs font-semibold text-slate-600 whitespace-nowrap">Tạo lúc</th>
              <th className="px-3 py-2 text-left text-xs font-semibold text-slate-600 whitespace-nowrap">Thao tác</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={6} className="px-3 py-6 text-center text-sm text-slate-500">
                  Đang tải...
                </td>
              </tr>
            ) : items.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-3 py-6 text-center text-sm text-slate-500">
                  Chưa có tài khoản nào
                </td>
              </tr>
            ) : (
              items.map((acc, idx) => (
                <tr key={acc.id} className="border-t">
                  <td className="px-3 py-2 text-slate-600">{idx + 1}</td>
                  <td className="px-3 py-2 font-medium text-slate-900">{acc.email}</td>
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
                  <td className="px-3 py-2 text-slate-700">
                    {acc.roleKey === "ADMIN"
                      ? "Quản trị"
                      : acc.roleKey === "DIRECTOR"
                        ? "Giám đốc"
                        : acc.roleKey === "STAFF"
                          ? "Nhân sự"
                          : "Nhân viên"}
                  </td>
                  <td className="px-3 py-2">
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
                  <td className="px-3 py-2 text-slate-600">
                    {acc.createdAt ? new Intl.DateTimeFormat("vi-VN").format(new Date(acc.createdAt)) : "—"}
                  </td>
                  <td className="px-3 py-2">
                    {acc.roleKey === "ADMIN" ? (
                      <span className="text-xs text-slate-500">—</span>
                    ) : (
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          className="rounded-none text-blue-600 border-blue-500"
                          onClick={() => {
                            setSelectedAcc(acc);
                            setEditStatus(acc.status === "ACTIVE" ? "ACTIVE" : "DISABLED");
                            setEditEmail(acc.email);
                            setEditPassword("");
                            setEditRole(acc.roleKey);
                            setEmailLocked(true);
                            setPasswordLocked(true);
                            setEditOpen(true);
                          }}
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
        <DialogContent className="rounded-none max-w-md">
          <DialogHeader>
            <DialogTitle>Gán / tạo tài khoản</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="flex items-center gap-4">
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
              <label className="text-sm text-slate-600">Nhân viên</label>
              <select
                value={assignEmployeeId}
                onChange={(e) => {
                  const val = e.target.value;
                  setAssignEmployeeId(val);
                  if (assignMode === "create") {
                    const selected = employees.find((emp) => emp.id === val);
                    if (selected?.personalEmail) {
                      setAssignEmail(selected.personalEmail);
                    }
                  }
                }}
                className="w-full rounded-none border border-slate-300 bg-white px-3 py-2 text-sm"
              >
                <option value="">-- Chọn nhân viên --</option>
                {employees.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.name} ({e.code})
                  </option>
                ))}
              </select>
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
        <DialogContent className="rounded-none max-w-md">
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
                <Button
                  variant="outline"
                  className="rounded-none w-full"
                  onClick={() => setConfirmOpen(true)}
                  disabled={processingEdit}
                >
                  {processingEdit ? "Đang lưu..." : "Lưu thay đổi"}
                </Button>
              </div>
            </div>
          ) : (
            <div className="text-sm text-slate-500">Chọn tài khoản để sửa</div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="rounded-none max-w-sm">
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
    </div>
  );
}
