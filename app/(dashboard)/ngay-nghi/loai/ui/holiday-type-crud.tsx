"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

type ApiItem = {
  id: string;
  name: string;
  color: string;
  payPolicy: "PAID" | "UNPAID" | "LEAVE";
  createdAt: string;
};

type Item = {
  id: string;
  ten: string;
  mau: string;
  cheDoLuong: "PAID" | "UNPAID" | "LEAVE";
  createdAt: string;
};

type FormData = {
  name: string;
  color: string;
  payPolicy: "PAID" | "UNPAID" | "LEAVE";
};

function isValidHexColor(value: string) {
  return /^#([0-9a-fA-F]{6}|[0-9a-fA-F]{3})$/.test(value.trim());
}

function normalizeColorInput(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return "";
  if (!trimmed.startsWith("#")) return `#${trimmed}`.toUpperCase();
  return trimmed.toUpperCase();
}

function mapApiItem(item: ApiItem): Item {
  return {
    id: item.id,
    ten: item.name,
    mau: item.color,
    cheDoLuong: item.payPolicy,
    createdAt: item.createdAt,
  };
}

function PayPolicyLabel({ value }: { value: Item["cheDoLuong"] }) {
  if (value === "UNPAID") return "Không tính lương";
  if (value === "LEAVE") return "Ngày phép";
  return "Tính lương";
}

function HolidayTypeForm({
  mode,
  initial,
  onSubmit,
  onCancel,
}: {
  mode: "create" | "edit";
  initial?: Item;
  onSubmit: (data: FormData) => Promise<void>;
  onCancel: () => void;
}) {
  const [name, setName] = useState(initial?.ten ?? "");
  const [colorInput, setColorInput] = useState(normalizeColorInput(initial?.mau ?? "#F59E0B"));
  const [colorValue, setColorValue] = useState(normalizeColorInput(initial?.mau ?? "#F59E0B"));
  const [payPolicy, setPayPolicy] = useState<FormData["payPolicy"]>(initial?.cheDoLuong ?? "PAID");
  const [submitting, setSubmitting] = useState(false);

  const colorPreview = isValidHexColor(colorValue) ? colorValue : "#F59E0B";

  return (
    <form
      className="space-y-4"
      onSubmit={async (event) => {
        event.preventDefault();
        const normalized = normalizeColorInput(colorInput);
        if (!isValidHexColor(normalized)) {
          toast.error("Mã màu không hợp lệ. Ví dụ: #F59E0B");
          return;
        }
        try {
          setSubmitting(true);
          await onSubmit({ name: name.trim(), color: normalized, payPolicy });
        } finally {
          setSubmitting(false);
        }
      }}
    >
      <div className="space-y-2">
        <label className="text-sm font-medium">Tên loại ngày nghỉ</label>
        <Input
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="Ví dụ: Nghỉ Tết"
          className="rounded-none"
        />
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium">Màu hiển thị</label>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={colorPreview}
              onChange={(event) => {
                const next = normalizeColorInput(event.target.value);
                setColorInput(next);
                setColorValue(next);
              }}
              className="h-10 w-12 cursor-pointer rounded border border-slate-200 bg-white p-1"
            />
            <span className="text-xs text-slate-500">Chọn màu</span>
          </div>
          <Input
            value={colorInput}
            onChange={(event) => {
              const next = normalizeColorInput(event.target.value);
              setColorInput(next);
              if (isValidHexColor(next)) setColorValue(next);
            }}
            placeholder="#F59E0B"
            className="rounded-none w-40"
          />
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <span className="h-3 w-3 rounded-full" style={{ backgroundColor: colorPreview }} />
            Xem trước
          </div>
        </div>
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium">Chế độ tính lương</label>
        <select
          value={payPolicy}
          onChange={(event) => setPayPolicy(event.target.value as FormData["payPolicy"])}
          className="rounded-none border border-slate-300 bg-white px-2 py-2 text-sm"
        >
          <option value="PAID">Tính lương</option>
          <option value="UNPAID">Không tính lương</option>
          <option value="LEAVE">Ngày phép</option>
        </select>
      </div>

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button type="button" variant="outline" className="rounded-none" onClick={onCancel}>
          Hủy
        </Button>
        <Button type="submit" className="rounded-none bg-emerald-500 text-white hover:bg-emerald-600" disabled={submitting}>
          {mode === "create" ? "Tạo loại" : "Lưu thay đổi"}
        </Button>
      </div>
    </form>
  );
}

export function HolidayTypeCrud() {
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(false);
  const [openCreate, setOpenCreate] = useState(false);
  const [openEditId, setOpenEditId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Item | null>(null);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [q, setQ] = useState("");

  async function fetchItems() {
    setLoading(true);
    try {
      const res = await fetch("/api/ngay-nghi/loai");
      if (!res.ok) throw new Error("Không tải được dữ liệu.");
      const data = (await res.json()) as { items?: ApiItem[] };
      setItems((data.items ?? []).map(mapApiItem));
    } catch (error: unknown) {
      console.error(error);
      toast.error("Không tải được danh sách.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchItems();
  }, []);

  const filtered = useMemo(() => {
    const keyword = q.trim().toLowerCase();
    if (!keyword) return items;
    return items.filter((item) => item.ten.toLowerCase().includes(keyword));
  }, [items, q]);

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Input
          placeholder="Tìm theo tên loại ngày nghỉ..."
          value={q}
          onChange={(event) => setQ(event.target.value)}
          className="rounded-none w-full sm:max-w-xs"
        />

        <Dialog open={openCreate} onOpenChange={setOpenCreate}>
          <DialogTrigger asChild>
            <Button className="rounded-none border-none bg-emerald-500 text-white shadow-sm transition hover:bg-emerald-600 w-full sm:w-auto">
              Thêm loại ngày nghỉ
            </Button>
          </DialogTrigger>
          <DialogContent className="rounded-none max-w-[calc(100vw-2rem)] sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>Thêm loại ngày nghỉ</DialogTitle>
            </DialogHeader>
            <HolidayTypeForm
              mode="create"
              onCancel={() => setOpenCreate(false)}
              onSubmit={async (data) => {
                try {
                  const res = await fetch("/api/ngay-nghi/loai", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(data),
                  });
                  if (!res.ok) {
                    const payload = (await res.json()) as { message?: string };
                    throw new Error(payload.message ?? "Không thể tạo loại ngày nghỉ.");
                  }
                  await fetchItems();
                  toast.success("Đã tạo loại ngày nghỉ.");
                  setOpenCreate(false);
                } catch (error: unknown) {
                  const message = error instanceof Error ? error.message : "Không thể tạo loại ngày nghỉ.";
                  toast.error(message);
                }
              }}
            />
          </DialogContent>
        </Dialog>
      </div>

      <div className="border bg-white overflow-x-auto rounded-lg">
        <Table>
          <TableHeader>
            <TableRow className="bg-slate-100">
              <TableHead className="w-12 text-center bg-slate-100 whitespace-nowrap hidden sm:table-cell">STT</TableHead>
              <TableHead className="min-w-60 text-center bg-slate-100 whitespace-nowrap">Tên loại</TableHead>
              <TableHead className="w-32 text-center bg-slate-100 whitespace-nowrap">Màu</TableHead>
              <TableHead className="w-40 text-center bg-slate-100 whitespace-nowrap">Chế độ lương</TableHead>
              <TableHead className="w-36 text-center bg-slate-100 whitespace-nowrap">Thao tác</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={5} className="py-10 text-center text-sm text-muted-foreground">
                  Đang tải...
                </TableCell>
              </TableRow>
            ) : filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="py-10 text-center text-sm text-muted-foreground">
                  Không có dữ liệu
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((item, idx) => (
                <TableRow key={item.id}>
                  <TableCell className="text-sm text-slate-500 text-center hidden sm:table-cell">
                    {idx + 1}
                  </TableCell>
                  <TableCell className="text-center">{item.ten}</TableCell>
                  <TableCell className="text-center">
                    <div className="flex items-center justify-center gap-2">
                      <span className="h-3 w-3 rounded-full" style={{ backgroundColor: item.mau }} />
                      <span className="text-xs text-slate-500">{item.mau}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-center text-sm text-slate-600">
                    <PayPolicyLabel value={item.cheDoLuong} />
                  </TableCell>
                  <TableCell className="text-center">
                    <div className="flex items-center justify-center gap-2 flex-wrap">
                      <Dialog open={openEditId === item.id} onOpenChange={(v) => setOpenEditId(v ? item.id : null)}>
                        <DialogTrigger asChild>
                          <Button
                            variant="outline"
                            size="sm"
                            className="rounded-none border-blue-500 text-blue-600 hover:bg-blue-50"
                          >
                            Sửa
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="rounded-none max-w-[calc(100vw-2rem)] sm:max-w-lg">
                          <DialogHeader>
                            <DialogTitle>Chỉnh sửa loại ngày nghỉ</DialogTitle>
                          </DialogHeader>
                          <HolidayTypeForm
                            mode="edit"
                            initial={item}
                            onCancel={() => setOpenEditId(null)}
                            onSubmit={async (data) => {
                              try {
                                const res = await fetch(`/api/ngay-nghi/loai/${item.id}`, {
                                  method: "PATCH",
                                  headers: { "Content-Type": "application/json" },
                                  body: JSON.stringify(data),
                                });
                                if (!res.ok) {
                                  const payload = (await res.json()) as { message?: string };
                                  throw new Error(payload.message ?? "Không thể cập nhật.");
                                }
                                await fetchItems();
                                toast.success("Đã cập nhật loại ngày nghỉ.");
                                setOpenEditId(null);
                              } catch (error: unknown) {
                                const message = error instanceof Error ? error.message : "Không thể cập nhật.";
                                toast.error(message);
                              }
                            }}
                          />
                        </DialogContent>
                      </Dialog>

                      <Button
                        variant="outline"
                        size="sm"
                        className="rounded-none border-red-500 text-red-600 hover:bg-red-50"
                        onClick={() => {
                          setDeleteTarget(item);
                          setConfirmDeleteOpen(true);
                        }}
                      >
                        Xóa
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={confirmDeleteOpen} onOpenChange={setConfirmDeleteOpen}>
        <DialogContent className="rounded-none max-w-[calc(100vw-2rem)] sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Xóa loại ngày nghỉ</DialogTitle>
          </DialogHeader>
          <div className="text-sm text-slate-600">
            Bạn có chắc muốn xóa{" "}
            <span className="font-semibold text-slate-900">{deleteTarget?.ten ?? "loại ngày nghỉ"}</span>?
          </div>
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button
              variant="outline"
              className="rounded-none"
              onClick={() => {
                setConfirmDeleteOpen(false);
                setDeleteTarget(null);
              }}
            >
              Hủy
            </Button>
            <Button
              className="rounded-none bg-red-500 text-white hover:bg-red-600"
              onClick={async () => {
                if (!deleteTarget) return;
                try {
                  const res = await fetch(`/api/ngay-nghi/loai/${deleteTarget.id}`, { method: "DELETE" });
                  if (!res.ok) {
                    const payload = (await res.json()) as { message?: string };
                    throw new Error(payload.message ?? "Không thể xóa.");
                  }
                  await fetchItems();
                  toast.success("Đã xóa loại ngày nghỉ.");
                  setConfirmDeleteOpen(false);
                  setDeleteTarget(null);
                } catch (error: unknown) {
                  const message = error instanceof Error ? error.message : "Không thể xóa.";
                  toast.error(message);
                }
              }}
            >
              Xóa
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
