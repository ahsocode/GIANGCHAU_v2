"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

type Item = {
  id: string;
  ma: string;
  ten: string;
  createdAt: string;
  soLuong: number;
};

type ApiItem = {
  id: string;
  code: string;
  name: string;
  employeeCount?: number;
  createdAt: string;
};

export function BoPhanCrud() {
  const [items, setItems] = useState<Item[]>([]);
  const [q, setQ] = useState<string>("");
  const [debouncedQ, setDebouncedQ] = useState<string>("");
  const [sortField, setSortField] = useState<"name" | "code" | "employeeCount" | "createdAt">("createdAt");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [openCreate, setOpenCreate] = useState(false);
  const [openEditId, setOpenEditId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Item | null>(null);
  const [loading, setLoading] = useState(false);

  async function fetchItems(params?: { q?: string; sort?: string; order?: string }) {
    setLoading(true);
    try {
      const query = new URLSearchParams();
      if (params?.q) query.set("q", params.q);
      if (params?.sort) query.set("sort", params.sort);
      if (params?.order) query.set("order", params.order);
      const res = await fetch(`/api/bo-phan${query.toString() ? `?${query.toString()}` : ""}`);
      if (!res.ok) throw new Error("Lỗi tải danh sách");
      const data = (await res.json()) as { items?: ApiItem[] };
      setItems(
        (data.items ?? []).map((d) => ({
          id: d.id,
          ma: d.code,
          ten: d.name,
          soLuong: d.employeeCount ?? 0,
          createdAt: d.createdAt,
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

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return items;
    return items.filter((d) => (`${d.ma} ${d.ten}`).toLowerCase().includes(s));
  }, [items, q]);

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
          <Input
            placeholder="Tìm theo mã / tên bộ phận..."
            value={q}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setQ(e.target.value)}
            className="sm:max-w-xs rounded-none"
          />
          <div className="flex items-center gap-2">
            <label className="text-sm text-slate-600">Sắp xếp:</label>
            <select
              value={sortField}
              onChange={(e) => {
                const value = e.target.value as typeof sortField;
                setSortField(value);
              }}
              className="rounded-none border border-slate-300 bg-white px-2 py-1 text-sm"
            >
              <option value="createdAt">Ngày tạo</option>
              <option value="name">Tên</option>
              <option value="code">Mã</option>
              <option value="employeeCount">Số nhân viên</option>
            </select>
            <select
              value={sortOrder}
              onChange={(e) => {
                const value = e.target.value as typeof sortOrder;
                setSortOrder(value);
              }}
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
              Thêm bộ phận
            </Button>
          </DialogTrigger>
          <DialogContent className="rounded-none">
            <DialogHeader>
              <DialogTitle>Thêm bộ phận</DialogTitle>
            </DialogHeader>

            <BoPhanForm
              mode="create"
              onCancel={() => setOpenCreate(false)}
              onSubmit={async (data) => {
                try {
                  const res = await fetch("/api/bo-phan", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(data),
                  });
                  if (!res.ok) throw new Error("Tạo thất bại");
                  await fetchItems();
                  toast.success("Đã tạo bộ phận");
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

      <div className="border bg-white">
        <Table>
          <TableHeader>
            <TableRow className="bg-slate-100">
              <TableHead className="w-12 text-center bg-slate-100">STT</TableHead>
              <TableHead className="w-40 text-center bg-slate-100">Mã</TableHead>
              <TableHead className="text-center bg-slate-100">Tên bộ phận</TableHead>
              <TableHead className="w-32 text-center bg-slate-100">Số nhân viên</TableHead>
              <TableHead className="w-52 text-center bg-slate-100">Thao tác</TableHead>
            </TableRow>
          </TableHeader>

          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={4} className="py-10 text-center text-sm text-muted-foreground">
                  Đang tải...
                </TableCell>
              </TableRow>
            ) : filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="py-10 text-center text-sm text-muted-foreground">
                  Không có dữ liệu
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((d, idx) => (
                <TableRow key={d.id}>
                  <TableCell className="text-sm text-slate-500 text-center">{idx + 1}</TableCell>
                  <TableCell className="font-medium text-center">{d.ma}</TableCell>
                  <TableCell className="text-center">{d.ten}</TableCell>
                  <TableCell className="text-center text-sm text-slate-600">{d.soLuong}</TableCell>
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
                          <DialogTitle>Sửa bộ phận</DialogTitle>
                        </DialogHeader>

                          <BoPhanForm
                            mode="edit"
                            defaultValues={{ ma: d.ma, ten: d.ten }}
                            onCancel={() => setOpenEditId(null)}
                            onSubmit={async (data) => {
                              try {
                                const res = await fetch(`/api/bo-phan/${d.id}`, {
                                  method: "PATCH",
                                  headers: { "Content-Type": "application/json" },
                                  body: JSON.stringify(data),
                                });
                                if (!res.ok) throw new Error("Cập nhật thất bại");
                                await fetchItems();
                                toast.success("Đã cập nhật bộ phận");
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
            Bạn chắc chắn xoá bộ phận{" "}
            <span className="font-semibold text-slate-900">{deleteTarget?.ten}</span> (mã{" "}
            <span className="font-mono">{deleteTarget?.ma}</span>)?
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
                  const res = await fetch(`/api/bo-phan/${deleteTarget.id}`, { method: "DELETE" });
                  if (!res.ok) throw new Error("Xoá thất bại");
                  await fetchItems();
                  toast.success("Đã xoá bộ phận");
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

function toCodeFromName(name: string) {
  const cleaned = name
    .toLowerCase()
    .replace(/đ/g, "d")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!cleaned) return "";
  const initials = cleaned
    .split(" ")
    .filter(Boolean)
    .map((w) => w[0])
    .join("");
  return initials.toUpperCase();
}

function BoPhanForm(props: {
  mode: "create" | "edit";
  defaultValues?: { ma?: string; ten: string };
  onCancel: () => void;
  onSubmit: (data: { ma: string; ten: string }) => Promise<void>;
}) {
  const [ten, setTen] = useState(props.defaultValues?.ten ?? "");
  const [maCustom, setMaCustom] = useState(props.defaultValues?.ma ?? "");
  const [loading, setLoading] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const maAuto = useMemo(() => toCodeFromName(ten), [ten]);
  const ma = props.mode === "edit" ? maCustom : maAuto;

  return (
    <>
      <form
        className="space-y-3"
        onSubmit={async (e) => {
          e.preventDefault();
          if (!ten.trim()) {
            toast.error("Vui lòng nhập tên bộ phận");
            return;
          }
          if (!ma || !ma.trim()) {
            toast.error("Vui lòng nhập mã bộ phận");
            return;
          }
          setConfirmOpen(true);
        }}
      >
        <div className="space-y-2">
          <label className="text-sm font-medium">Mã bộ phận</label>
          <Input
            value={ma}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
              props.mode === "edit" ? setMaCustom(e.target.value) : setMaCustom("")
            }
            placeholder="VD: BP-01"
            className="rounded-none"
            disabled={props.mode === "create"}
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">Tên bộ phận</label>
          <Input
            value={ten}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setTen(e.target.value)}
            placeholder="VD: Kế toán"
            className="rounded-none"
          />
        </div>

        {props.mode === "create" && (
          <div className="text-sm text-slate-600">
            Mã tự sinh: <span className="font-semibold text-slate-900">{maAuto || "—"}</span>
          </div>
        )}

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
            <DialogTitle>Xác nhận {props.mode === "create" ? "tạo" : "cập nhật"} bộ phận</DialogTitle>
          </DialogHeader>
          <div className="text-sm text-slate-700 space-y-1">
            <div>
              Mã: <span className="font-mono font-semibold text-slate-900">{ma}</span>
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
                await props.onSubmit({ ma: ma.trim(), ten });
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
