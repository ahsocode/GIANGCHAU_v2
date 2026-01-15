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
  const [sortField, setSortField] = useState<
    "createdAt" | "code" | "fullName" | "position" | "department" | "employmentType"
  >("createdAt");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [filterDepartmentId, setFilterDepartmentId] = useState<string>("");
  const [filterPositionId, setFilterPositionId] = useState<string>("");
  const [filterEmploymentType, setFilterEmploymentType] = useState<string>("");
  const [openCreate, setOpenCreate] = useState(false);
  const [openEditId, setOpenEditId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Item | null>(null);
  const [loading, setLoading] = useState(false);
  const [departments, setDepartments] = useState<Option[]>([]);
  const [positions, setPositions] = useState<Option[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const pageSize = 50;

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

  async function fetchItems(params?: {
    q?: string;
    sort?: string;
    order?: string;
    departmentId?: string;
    positionId?: string;
    employmentType?: string;
    page?: number;
  }) {
    setLoading(true);
    try {
      const query = new URLSearchParams();
      if (params?.q) query.set("q", params.q);
      if (params?.sort) query.set("sort", params.sort);
      if (params?.order) query.set("order", params.order);
      if (params?.departmentId) query.set("departmentId", params.departmentId);
      if (params?.positionId) query.set("positionId", params.positionId);
      if (params?.employmentType) query.set("employmentType", params.employmentType);
      query.set("page", String(params?.page ?? 1));
      query.set("pageSize", String(pageSize));
      const res = await fetch(`/api/nhan-vien${query.toString() ? `?${query.toString()}` : ""}`);
      if (!res.ok) throw new Error("Lỗi tải danh sách");
      const data = (await res.json()) as { items?: ApiItem[]; total?: number };
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
      setTotal(data.total ?? 0);
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
    setPage(1);
  }, [debouncedQ, sortField, sortOrder, filterDepartmentId, filterPositionId, filterEmploymentType]);

  useEffect(() => {
    fetchItems({
      q: debouncedQ,
      sort: sortField,
      order: sortOrder,
      departmentId: filterDepartmentId || undefined,
      positionId: filterPositionId || undefined,
      employmentType: filterEmploymentType || undefined,
      page,
    });
  }, [debouncedQ, sortField, sortOrder, filterDepartmentId, filterPositionId, filterEmploymentType, page]);

  useEffect(() => {
    fetchLookups();
  }, []);

  const filtered = items;
  const totalPages = useMemo(() => Math.max(1, Math.ceil(total / pageSize)), [total, pageSize]);

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-3">
        {/* Search and filters */}
        <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
          <Input
            placeholder="Tìm theo mã / tên nhân viên..."
            value={q}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setQ(e.target.value)}
            className="rounded-none w-full sm:max-w-xs focus-visible:ring-0 focus-visible:ring-offset-0 focus:border-slate-300"
          />
          <div className="flex flex-col lg:flex-row gap-2 lg:items-center w-full">
            <div className="flex flex-wrap items-center gap-2">
              <label className="text-sm text-slate-600 whitespace-nowrap">Sắp xếp:</label>
              <select
                value={sortField}
                onChange={(e) => setSortField(e.target.value as typeof sortField)}
                className="rounded-none border border-slate-300 bg-white px-2 py-1.5 text-sm flex-1 min-w-30"
              >
                <option value="createdAt">Ngày tạo</option>
                <option value="fullName">Tên</option>
                <option value="code">Mã</option>
                <option value="department">Bộ phận</option>
                <option value="position">Chức vụ</option>
                <option value="employmentType">Loại nhân viên</option>
              </select>
              <select
                value={sortOrder}
                onChange={(e) => setSortOrder(e.target.value as typeof sortOrder)}
                className="rounded-none border border-slate-300 bg-white px-2 py-1.5 text-sm flex-1 min-w-25"
              >
                <option value="asc">Tăng dần</option>
                <option value="desc">Giảm dần</option>
              </select>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <label className="text-sm text-slate-600 whitespace-nowrap">Bộ lọc:</label>
              <select
                value={filterDepartmentId}
                onChange={(e) => setFilterDepartmentId(e.target.value)}
                className="rounded-none border border-slate-300 bg-white px-2 py-1.5 text-sm min-w-32"
              >
                <option value="">Tất cả bộ phận</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
              <select
                value={filterPositionId}
                onChange={(e) => setFilterPositionId(e.target.value)}
                className="rounded-none border border-slate-300 bg-white px-2 py-1.5 text-sm min-w-32"
              >
                <option value="">Tất cả chức vụ</option>
                {positions.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
              <select
                value={filterEmploymentType}
                onChange={(e) => setFilterEmploymentType(e.target.value)}
                className="rounded-none border border-slate-300 bg-white px-2 py-1.5 text-sm min-w-28"
              >
                <option value="">Tất cả loại</option>
                <option value="CT">Chính thức</option>
                <option value="TV">Thời vụ</option>
              </select>
            </div>
          </div>
        </div>

        {/* Add button */}
        <Dialog open={openCreate} onOpenChange={setOpenCreate}>
          <DialogTrigger asChild>
            <Button className="rounded-none border-none bg-emerald-500 text-white shadow-sm transition hover:bg-emerald-600 w-full sm:w-auto sm:self-start">
              Thêm nhân viên
            </Button>
          </DialogTrigger>
          <DialogContent className="rounded-none max-w-[calc(100vw-2rem)] sm:max-w-lg">
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
                  await fetchItems({
                    q: debouncedQ,
                    sort: sortField,
                    order: sortOrder,
                    departmentId: filterDepartmentId || undefined,
                    positionId: filterPositionId || undefined,
                    employmentType: filterEmploymentType || undefined,
                    page,
                  });
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

      {/* Table with horizontal scroll */}
      <div className="border bg-white overflow-x-auto rounded-lg">
        <Table>
          <TableHeader>
            <TableRow className="bg-slate-100">
              <TableHead className="w-12 text-center bg-slate-100 whitespace-nowrap sticky left-0 z-10 hidden sm:table-cell">
                STT
              </TableHead>
              <TableHead className="w-20 text-center bg-slate-100 whitespace-nowrap hidden sm:table-cell">Ảnh</TableHead>
              <TableHead className="min-w-25 text-center bg-slate-100 whitespace-nowrap">Mã NV</TableHead>
              <TableHead className="min-w-45 text-center bg-slate-100 whitespace-nowrap">Họ tên</TableHead>
              <TableHead className="min-w-30 text-center bg-slate-100 whitespace-nowrap hidden md:table-cell">Bộ phận</TableHead>
              <TableHead className="min-w-30 text-center bg-slate-100 whitespace-nowrap hidden md:table-cell">Chức vụ</TableHead>
              <TableHead className="w-24 text-center bg-slate-100 whitespace-nowrap hidden md:table-cell">Loại</TableHead>
              <TableHead className="min-w-45 text-center bg-slate-100 whitespace-nowrap hidden md:table-cell">Tài khoản</TableHead>
              <TableHead className="w-48 text-center bg-slate-100 whitespace-nowrap sticky right-0 z-10 hidden sm:table-cell">
                Thao tác
              </TableHead>
            </TableRow>
          </TableHeader>

          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={9} className="py-10 text-center text-sm text-muted-foreground">
                  Đang tải...
                </TableCell>
              </TableRow>
            ) : filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="py-10 text-center text-sm text-muted-foreground">
                  Không có dữ liệu
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((d, idx) => (
                <TableRow key={d.id}>
                  <TableCell className="text-sm text-slate-500 text-center sticky left-0 bg-white hidden sm:table-cell">
                    {(page - 1) * pageSize + idx + 1}
                  </TableCell>
                  <TableCell className="text-center hidden sm:table-cell">
                    {d.avatarUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={d.avatarUrl}
                        alt={d.fullName}
                        className="mx-auto h-10 w-10 sm:h-12 sm:w-12 object-cover border border-slate-200 rounded"
                      />
                    ) : (
                      <div className="mx-auto h-10 w-10 sm:h-12 sm:w-12 bg-slate-100 border border-slate-200 rounded flex items-center justify-center text-xs text-slate-400">
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
                  <TableCell className="text-center text-sm hidden md:table-cell">{d.departmentName ?? "—"}</TableCell>
                  <TableCell className="text-center text-sm hidden md:table-cell">{d.positionName ?? "—"}</TableCell>
                  <TableCell className="text-center hidden md:table-cell">
                    {d.employmentType === "TV" ? (
                      <span className="text-xs sm:text-sm text-amber-600 font-medium">Thời vụ</span>
                    ) : (
                      <span className="text-xs sm:text-sm text-emerald-600 font-medium">Chính thức</span>
                    )}
                  </TableCell>
                  <TableCell className="text-center text-sm hidden md:table-cell">
                    {d.accountEmail ? (
                      <span className="text-slate-800 break-all">{d.accountEmail}</span>
                    ) : (
                      "—"
                    )}
                  </TableCell>
                  <TableCell className="text-center sticky right-0 bg-white hidden sm:table-cell sm:sticky sm:right-0">
                    <div className="flex items-center justify-center gap-1.5 flex-wrap">
                      <Dialog open={openEditId === d.id} onOpenChange={(v) => setOpenEditId(v ? d.id : null)}>
                        <DialogTrigger asChild>
                          <Button
                            variant="outline"
                            size="sm"
                            className="rounded-none border-blue-500 text-blue-600 hover:bg-blue-50 text-xs sm:text-sm"
                          >
                            Sửa
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="rounded-none max-w-[calc(100vw-2rem)] sm:max-w-lg">
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
                                await fetchItems({
                                  q: debouncedQ,
                                  sort: sortField,
                                  order: sortOrder,
                                  departmentId: filterDepartmentId || undefined,
                                  positionId: filterPositionId || undefined,
                                  employmentType: filterEmploymentType || undefined,
                                  page,
                                });
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
                        className="rounded-none bg-red-500 text-white hover:bg-red-600 text-xs sm:text-sm"
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

      <Dialog open={!!deleteTarget} onOpenChange={(v) => !v && setDeleteTarget(null)}>
        <DialogContent className="rounded-none max-w-[calc(100vw-2rem)] sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Xác nhận xoá</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-slate-600">
            Bạn chắc chắn xoá nhân viên <span className="font-semibold text-slate-900">{deleteTarget?.fullName}</span>{" "}
            (mã <span className="font-mono">{deleteTarget?.code}</span>)?
          </p>
          <div className="flex flex-col-reverse sm:flex-row justify-end gap-2 pt-4">
            <Button
              type="button"
              variant="destructive"
              className="rounded-none bg-red-500 text-white hover:bg-red-600 w-full sm:w-auto"
              onClick={() => setDeleteTarget(null)}
            >
              Huỷ
            </Button>
            <Button
              type="button"
              className="rounded-none bg-emerald-500 text-white hover:bg-emerald-600 w-full sm:w-auto"
              onClick={async () => {
                if (!deleteTarget) return;
                try {
                  const res = await fetch(`/api/nhan-vien/${deleteTarget.id}`, { method: "DELETE" });
                  if (!res.ok) {
                    const err = await res.json().catch(() => null);
                    throw new Error(err?.message || "Xoá thất bại");
                  }
                  await fetchItems({
                    q: debouncedQ,
                    sort: sortField,
                    order: sortOrder,
                    departmentId: filterDepartmentId || undefined,
                    positionId: filterPositionId || undefined,
                    employmentType: filterEmploymentType || undefined,
                    page,
                  });
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

        <div className="flex flex-col-reverse sm:flex-row justify-end gap-2 pt-2">
          <Button
            type="button"
            variant="destructive"
            className="rounded-none bg-red-500 text-white hover:bg-red-600 w-full sm:w-auto"
            onClick={props.onCancel}
            disabled={loading}
          >
            Huỷ
          </Button>
          <Button
            type="submit"
            className={
              props.mode === "create"
                ? "rounded-none bg-emerald-500 text-white hover:bg-emerald-600 w-full sm:w-auto"
                : "rounded-none bg-blue-500 text-white hover:bg-blue-600 w-full sm:w-auto"
            }
            disabled={loading}
          >
            {loading ? "Đang xử lý..." : props.mode === "create" ? "Tạo" : "Lưu"}
          </Button>
        </div>
      </form>

      <Dialog open={confirmOpen} onOpenChange={(v) => setConfirmOpen(v)}>
        <DialogContent className="rounded-none max-w-[calc(100vw-2rem)] sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Xác nhận {props.mode === "create" ? "tạo" : "cập nhật"} nhân viên</DialogTitle>
          </DialogHeader>
          <div className="text-sm text-slate-700 space-y-1">
            <div className="wrap-break-word">
              Mã (dự kiến/hiện tại):{" "}
              <span className="font-mono font-semibold text-slate-900">{maAuto}</span>
            </div>
            <div className="wrap-break-word">
              Tên: <span className="font-semibold text-slate-900">{ten}</span>
            </div>
          </div>
          <div className="flex flex-col-reverse sm:flex-row justify-end gap-2 pt-4">
            <Button
              type="button"
              variant="destructive"
              className="rounded-none bg-red-500 text-white hover:bg-red-600 w-full sm:w-auto"
              onClick={() => setConfirmOpen(false)}
              disabled={loading}
            >
              Huỷ
            </Button>
            <Button
              type="button"
              className="rounded-none bg-emerald-500 text-white hover:bg-emerald-600 w-full sm:w-auto"
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
