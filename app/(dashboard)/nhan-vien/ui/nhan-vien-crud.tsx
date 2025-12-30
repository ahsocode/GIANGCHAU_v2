"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { EmploymentType } from "@/lib/employee-code";

type Item = {
  id: string;
  code: string;
  fullName: string;
  employmentType: EmploymentType;
  departmentId: string | null;
  departmentName: string | null;
  positionId: string | null;
  positionName: string | null;
  positionCode: string | null;
  accountEmail: string | null;
  isActive: boolean;
  createdAt: string;
  avatarUrl?: string | null;
};

type Option = { id: string; name: string; code?: string };
type ApiItem = {
  id: string;
  code: string;
  fullName: string;
  employmentType: EmploymentType;
  departmentId: string | null;
  departmentName: string | null;
  positionId: string | null;
  positionName: string | null;
  positionCode: string | null;
  accountEmail: string | null;
  isActive: boolean;
  createdAt: string;
  avatarUrl?: string | null;
};
type ApiLookup = { id: string; code: string; name: string };

export function NhanVienCrud() {
  const [items, setItems] = useState<Item[]>([]);
  const [q, setQ] = useState<string>("");
  const [debouncedQ, setDebouncedQ] = useState<string>("");
  const [sortField, setSortField] = useState<"createdAt" | "code" | "fullName">("createdAt");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [openCreate, setOpenCreate] = useState(false);
  const [openEditId, setOpenEditId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Item | null>(null);
  const [loading, setLoading] = useState(false);
  const [departments, setDepartments] = useState<Option[]>([]);
  const [positions, setPositions] = useState<Option[]>([]);

  async function fetchLookups() {
    try {
      const [depsRes, posRes] = await Promise.all([fetch("/api/bo-phan"), fetch("/api/chuc-vu")]);
      if (depsRes.ok) {
        const data = (await depsRes.json()) as { items?: ApiLookup[] };
        setDepartments((data.items ?? []).map((d) => ({ id: d.id, name: d.name, code: d.code })));
      }
      if (posRes.ok) {
        const data = (await posRes.json()) as { items?: ApiLookup[] };
        setPositions((data.items ?? []).map((d) => ({ id: d.id, name: d.name, code: d.code })));
      }
    } catch (error: unknown) {
      console.error(error);
    }
  }

  async function fetchItems(params?: { q?: string; sort?: string; order?: string }) {
    setLoading(true);
    try {
      const query = new URLSearchParams();
      if (params?.q) query.set("q", params.q);
      if (params?.sort) query.set("sort", params.sort);
      if (params?.order) query.set("order", params.order);
      const res = await fetch(`/api/nhan-vien${query.toString() ? `?${query.toString()}` : ""}`);
      if (!res.ok) throw new Error("Lỗi tải danh sách");
      const data = (await res.json()) as { items?: ApiItem[] };
      setItems(
        (data.items ?? []).map((d) => ({
          id: d.id,
          code: d.code,
          fullName: d.fullName,
          employmentType: d.employmentType,
          departmentId: d.departmentId,
          departmentName: d.departmentName,
          positionId: d.positionId,
          positionName: d.positionName,
          positionCode: d.positionCode,
          accountEmail: d.accountEmail,
          isActive: d.isActive,
          createdAt: d.createdAt,
          avatarUrl: d.avatarUrl,
        }))
      );
    } catch (error: unknown) {
      console.error(error);
      toast.error("Không tải được danh sách");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(q), 300);
    return () => clearTimeout(t);
  }, [q]);

  useEffect(() => {
    fetchItems({ q: debouncedQ, sort: sortField, order: sortOrder });
  }, [debouncedQ, sortField, sortOrder]);

  useEffect(() => {
    fetchLookups();
  }, []);

  const filtered = useMemo(() => {
    const s = debouncedQ.trim().toLowerCase();
    if (!s) return items;
    return items.filter((d) => (`${d.code} ${d.fullName} ${d.departmentName ?? ""} ${d.positionName ?? ""}`).toLowerCase().includes(s));
  }, [items, debouncedQ]);

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
          <Input
            placeholder="Tìm theo mã / tên nhân viên..."
            value={q}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setQ(e.target.value)}
            className="sm:max-w-xs rounded-none"
          />
          <div className="flex items-center gap-2">
            <label className="text-sm text-slate-600">Sắp xếp:</label>
            <select
              value={sortField}
              onChange={(e) => setSortField(e.target.value as typeof sortField)}
              className="rounded-none border border-slate-300 bg-white px-2 py-1 text-sm"
            >
              <option value="createdAt">Ngày tạo</option>
              <option value="fullName">Tên</option>
              <option value="code">Mã</option>
            </select>
            <select
              value={sortOrder}
              onChange={(e) => setSortOrder(e.target.value as typeof sortOrder)}
              className="rounded-none border border-slate-300 bg-white px-2 py-1 text-sm"
            >
              <option value="asc">Tăng dần</option>
              <option value="desc">Giảm dần</option>
            </select>
          </div>
        </div>

        <Dialog open={openCreate} onOpenChange={setOpenCreate}>
          <DialogTrigger asChild>
            <Button className="rounded-none border-none bg-emerald-500 text-white shadow-sm transition hover:bg-emerald-600">
              Thêm nhân viên
            </Button>
          </DialogTrigger>
          <DialogContent className="rounded-none">
            <DialogHeader>
              <DialogTitle>Thêm nhân viên</DialogTitle>
            </DialogHeader>

            <NhanVienForm
              mode="create"
              departments={departments}
              positions={positions}
              onCancel={() => setOpenCreate(false)}
              onSubmit={async (data) => {
                try {
                  const res = await fetch("/api/nhan-vien", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(data),
                  });
                  if (!res.ok) throw new Error("Tạo thất bại");
                  await fetchItems({ q: debouncedQ, sort: sortField, order: sortOrder });
                  toast.success("Đã tạo nhân viên");
                  setOpenCreate(false);
                } catch (error: unknown) {
                  const message = error instanceof Error ? error.message : "Tạo thất bại";
                  toast.error(message);
                }
              }}
            />
          </DialogContent>
        </Dialog>
      </div>

      <div className="border bg-white overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="bg-slate-100">
              <TableHead className="w-12 text-center bg-slate-100 whitespace-nowrap">STT</TableHead>
              <TableHead className="w-20 text-center bg-slate-100 whitespace-nowrap">Ảnh</TableHead>
              <TableHead className="w-32 text-center bg-slate-100 whitespace-nowrap">Mã NV</TableHead>
              <TableHead className="text-center bg-slate-100 whitespace-nowrap">Họ tên</TableHead>
              <TableHead className="text-center bg-slate-100 whitespace-nowrap">Bộ phận</TableHead>
              <TableHead className="text-center bg-slate-100 whitespace-nowrap">Chức vụ</TableHead>
              <TableHead className="text-center bg-slate-100 whitespace-nowrap">Loại</TableHead>
              <TableHead className="text-center bg-slate-100 whitespace-nowrap">Tài khoản</TableHead>
              <TableHead className="w-52 text-center bg-slate-100 whitespace-nowrap">Thao tác</TableHead>
            </TableRow>
          </TableHeader>

          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={8} className="py-10 text-center text-sm text-muted-foreground">
                  Đang tải...
                </TableCell>
              </TableRow>
            ) : filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="py-10 text-center text-sm text-muted-foreground">
                  Không có dữ liệu
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((d, idx) => (
                <TableRow key={d.id}>
                  <TableCell className="text-sm text-slate-500 text-center">{idx + 1}</TableCell>
                  <TableCell className="text-center">
                    {d.avatarUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={d.avatarUrl}
                        alt={d.fullName}
                        className="mx-auto h-12 w-12 object-cover border border-slate-200"
                      />
                    ) : (
                      <div className="mx-auto h-12 w-12 bg-slate-100 border border-slate-200 flex items-center justify-center text-xs text-slate-400">
                        N/A
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="font-medium text-center">
                    <Link href={`/nhan-vien/${d.id}`} className="text-blue-600 hover:underline">
                      {d.code}
                    </Link>
                  </TableCell>
                  <TableCell className="text-center">
                    <Link href={`/nhan-vien/${d.id}`} className="text-blue-600 hover:underline">
                      {d.fullName}
                    </Link>
                  </TableCell>
                  <TableCell className="text-center">{d.departmentName ?? "—"}</TableCell>
                  <TableCell className="text-center">{d.positionName ?? "—"}</TableCell>
                  <TableCell className="text-center">
                    {d.employmentType === "TV" ? (
                      <span className="text-sm text-amber-600">Thời vụ</span>
                    ) : (
                      <span className="text-sm text-emerald-600">Chính thức</span>
                    )}
                  </TableCell>
                  <TableCell className="text-center">
                    {d.accountEmail ? <span className="text-sm text-slate-800">{d.accountEmail}</span> : "—"}
                  </TableCell>
                  <TableCell className="text-center">
                    <div className="flex items-center justify-center gap-2">
                      <Dialog open={openEditId === d.id} onOpenChange={(v) => setOpenEditId(v ? d.id : null)}>
                        <DialogTrigger asChild>
                          <Button
                            variant="outline"
                            size="sm"
                            className="rounded-none border-blue-500 text-blue-600 hover:bg-blue-50"
                          >
                            Sửa
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="rounded-none">
                          <DialogHeader>
                            <DialogTitle>Sửa nhân viên</DialogTitle>
                          </DialogHeader>

                          <NhanVienForm
                            mode="edit"
                            departments={departments}
                            positions={positions}
                            defaultValues={{
                              id: d.id,
                              ma: d.code,
                              ten: d.fullName,
                              employmentType: d.employmentType,
                              departmentId: d.departmentId ?? undefined,
                              positionId: d.positionId ?? undefined,
                            }}
                            onCancel={() => setOpenEditId(null)}
                            onSubmit={async (data) => {
                              try {
                                const res = await fetch(`/api/nhan-vien/${d.id}`, {
                                  method: "PATCH",
                                  headers: { "Content-Type": "application/json" },
                                  body: JSON.stringify(data),
                                });
                                if (!res.ok) throw new Error("Cập nhật thất bại");
                                await fetchItems({ q: debouncedQ, sort: sortField, order: sortOrder });
                                toast.success("Đã cập nhật nhân viên");
                                setOpenEditId(null);
                              } catch (error: unknown) {
                                const message = error instanceof Error ? error.message : "Cập nhật thất bại";
                                toast.error(message);
                              }
                            }}
                          />
                        </DialogContent>
                      </Dialog>

                      <Button
                        variant="destructive"
                        size="sm"
                        className="rounded-none bg-red-500 text-white hover:bg-red-600"
                        onClick={() => setDeleteTarget(d)}
                      >
                        Xoá
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={!!deleteTarget} onOpenChange={(v) => !v && setDeleteTarget(null)}>
        <DialogContent className="rounded-none max-w-sm">
          <DialogHeader>
            <DialogTitle>Xác nhận xoá</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-slate-600">
            Bạn chắc chắn xoá nhân viên <span className="font-semibold text-slate-900">{deleteTarget?.fullName}</span>{" "}
            (mã <span className="font-mono">{deleteTarget?.code}</span>)?
          </p>
          <div className="flex justify-end gap-2 pt-4">
            <Button
              type="button"
              variant="destructive"
              className="rounded-none bg-red-500 text-white hover:bg-red-600"
              onClick={() => setDeleteTarget(null)}
            >
              Huỷ
            </Button>
            <Button
              type="button"
              className="rounded-none bg-emerald-500 text-white hover:bg-emerald-600"
              onClick={async () => {
                if (!deleteTarget) return;
                try {
                  const res = await fetch(`/api/nhan-vien/${deleteTarget.id}`, { method: "DELETE" });
                  if (!res.ok) {
                    const err = await res.json().catch(() => null);
                    throw new Error(err?.message || "Xoá thất bại");
                  }
                  await fetchItems({ q: debouncedQ, sort: sortField, order: sortOrder });
                  toast.success("Đã xoá nhân viên");
                  setDeleteTarget(null);
                } catch (error: unknown) {
                  const message = error instanceof Error ? error.message : "Xoá thất bại";
                  toast.error(message);
                }
              }}
            >
              Xoá
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function NhanVienForm(props: {
  mode: "create" | "edit";
  defaultValues?: {
    id?: string;
    ma?: string;
    ten: string;
    employmentType: EmploymentType;
    departmentId?: string;
    positionId?: string;
  };
  departments: Option[];
  positions: Option[];
  onCancel: () => void;
    onSubmit: (data: {
      fullName: string;
      employmentType: EmploymentType;
      departmentId?: string | null;
      positionId?: string | null;
    }) => Promise<void>;
}) {
  const [ten, setTen] = useState(props.defaultValues?.ten ?? "");
  const [employmentType, setEmploymentType] = useState<EmploymentType>(
    props.defaultValues?.employmentType ?? "CT"
  );
  const [departmentId, setDepartmentId] = useState<string | undefined>(
    props.defaultValues?.departmentId
  );
  const [positionId, setPositionId] = useState<string | undefined>(
    props.defaultValues?.positionId
  );
  const [loading, setLoading] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const maAuto = useMemo(() => {
    if (props.mode === "edit") return props.defaultValues?.ma ?? "";
    // hiển thị preview mã dự kiến
    const now = new Date();
    const year = now.getFullYear();
    const month = (now.getMonth() + 1).toString().padStart(2, "0");
    const posCode = props.positions.find((p) => p.id === positionId)?.code || "NV";
    const suffix = employmentType === "TV" ? "TV" : "CT";
    return `GC${posCode}${year}${month}xxxx${suffix}`.toUpperCase();
  }, [employmentType, positionId, props.mode, props.positions, props.defaultValues?.ma]);

  return (
    <>
      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          if (!ten.trim()) {
            toast.error("Vui lòng nhập tên nhân viên");
            return;
          }
          setConfirmOpen(true);
        }}
      >
        <div className="space-y-2">
          <label className="text-sm font-medium">Mã nhân viên</label>
          <Input value={maAuto} disabled className="rounded-none text-slate-700" />
          {props.mode === "create" && (
            <p className="text-xs text-slate-500">Mã sẽ tự sinh khi lưu (theo chức vụ, thời gian, loại nhân viên).</p>
          )}
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">Họ tên</label>
          <Input
            value={ten}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setTen(e.target.value)}
            placeholder="VD: Nguyễn Văn A"
            className="rounded-none"
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">Loại nhân viên</label>
          <select
            value={employmentType}
            onChange={(e) => setEmploymentType(e.target.value as EmploymentType)}
            className="w-full rounded-none border border-slate-300 bg-white px-3 py-2 text-sm"
          >
            <option value="CT">Chính thức</option>
            <option value="TV">Thời vụ</option>
          </select>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">Bộ phận</label>
          <select
            value={departmentId || ""}
            onChange={(e) => setDepartmentId(e.target.value || undefined)}
            className="w-full rounded-none border border-slate-300 bg-white px-3 py-2 text-sm"
          >
            <option value="">-- Không chọn --</option>
            {props.departments.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">Chức vụ</label>
          <select
            value={positionId || ""}
            onChange={(e) => setPositionId(e.target.value || undefined)}
            className="w-full rounded-none border border-slate-300 bg-white px-3 py-2 text-sm"
          >
            <option value="">-- Không chọn --</option>
            {props.positions.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button
            type="button"
            variant="destructive"
            className="rounded-none bg-red-500 text-white hover:bg-red-600"
            onClick={props.onCancel}
            disabled={loading}
          >
            Huỷ
          </Button>
          <Button
            type="submit"
            className={
              props.mode === "create"
                ? "rounded-none bg-emerald-500 text-white hover:bg-emerald-600"
                : "rounded-none bg-blue-500 text-white hover:bg-blue-600"
            }
            disabled={loading}
          >
            {loading ? "Đang xử lý..." : props.mode === "create" ? "Tạo" : "Lưu"}
          </Button>
        </div>
      </form>

      <Dialog open={confirmOpen} onOpenChange={(v) => setConfirmOpen(v)}>
        <DialogContent className="rounded-none max-w-sm">
          <DialogHeader>
            <DialogTitle>Xác nhận {props.mode === "create" ? "tạo" : "cập nhật"} nhân viên</DialogTitle>
          </DialogHeader>
          <div className="text-sm text-slate-700 space-y-1">
            <div>
              Mã (dự kiến/hiện tại):{" "}
              <span className="font-mono font-semibold text-slate-900">{maAuto}</span>
            </div>
            <div>
              Tên: <span className="font-semibold text-slate-900">{ten}</span>
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-4">
            <Button
              type="button"
              variant="destructive"
              className="rounded-none bg-red-500 text-white hover:bg-red-600"
              onClick={() => setConfirmOpen(false)}
              disabled={loading}
            >
              Huỷ
            </Button>
            <Button
              type="button"
              className="rounded-none bg-emerald-500 text-white hover:bg-emerald-600"
            onClick={async () => {
              try {
                setLoading(true);
                await props.onSubmit({
                  fullName: ten.trim(),
                    employmentType,
                    departmentId: departmentId || null,
                    positionId: positionId || null,
                  });
                  setConfirmOpen(false);
                } finally {
                  setLoading(false);
                }
              }}
              disabled={loading}
            >
              Xác nhận
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
