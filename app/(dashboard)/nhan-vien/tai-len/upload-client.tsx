"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

type CreatedItem = {
  id: string;
  code: string;
  fullName: string;
  phone: string | null;
  email: string | null;
  departmentName: string | null;
  positionName: string | null;
  employmentType: string;
};

type RowError = {
  row: number;
  messages: string[];
};

type PreviewRow = {
  rowNumber: number;
  fullName: string;
  gender: string;
  employmentType: string;
  departmentCode: string;
  positionCode: string;
  phone: string;
  email: string;
  salary: string;
  dob: string;
  address: string;
  socialInsuranceNumber: string;
  citizenIdNumber: string;
  joinedAt: string;
};

type CodeOption = {
  id: string;
  code: string;
  name: string;
};

export default function UploadClient() {
  const [file, setFile] = useState<File | null>(null);
  const [previewRows, setPreviewRows] = useState<PreviewRow[]>([]);
  const [importId, setImportId] = useState<string | null>(null);
  const [createdItems, setCreatedItems] = useState<CreatedItem[]>([]);
  const [errors, setErrors] = useState<RowError[]>([]);
  const [uploading, setUploading] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmMode, setConfirmMode] = useState<"all" | "selected">("all");
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [rechecking, setRechecking] = useState(false);
  const [departmentOptions, setDepartmentOptions] = useState<CodeOption[]>([]);
  const [positionOptions, setPositionOptions] = useState<CodeOption[]>([]);
  const [selectedRows, setSelectedRows] = useState<Set<number>>(new Set());

  const departmentCodeSet = useMemo(
    () => new Set(departmentOptions.map((dept) => dept.code.toUpperCase())),
    [departmentOptions]
  );
  const positionCodeSet = useMemo(
    () => new Set(positionOptions.map((pos) => pos.code.toUpperCase())),
    [positionOptions]
  );

  const duplicateMaps = useMemo(() => {
    const counts = {
      phone: new Map<string, number>(),
      email: new Map<string, number>(),
      si: new Map<string, number>(),
      cccd: new Map<string, number>(),
    };
    const bump = (map: Map<string, number>, value: string) => {
      if (!value) return;
      map.set(value, (map.get(value) ?? 0) + 1);
    };
    previewRows.forEach((row) => {
      bump(counts.phone, row.phone.trim());
      bump(counts.email, row.email.trim().toLowerCase());
      bump(counts.si, row.socialInsuranceNumber.trim());
      bump(counts.cccd, row.citizenIdNumber.trim());
    });
    return counts;
  }, [previewRows]);

  const errorMap = useMemo(() => {
    const map = new Map<number, string[]>();
    errors.forEach((err) => {
      map.set(err.row, err.messages);
    });
    return map;
  }, [errors]);

  const getRowStatus = useCallback((row: PreviewRow) => {
    const serverErrors = errorMap.get(row.rowNumber);
    if (serverErrors && serverErrors.length > 0) {
      const hasDuplicate = serverErrors.some((message) => message.toLowerCase().includes("trùng"));
      return hasDuplicate ? "warning" : "error";
    }

    const missingRequired =
      !row.fullName.trim() ||
      !row.gender.trim() ||
      !row.employmentType.trim() ||
      !row.positionCode.trim() ||
      !row.phone.trim() ||
      !row.email.trim();
    if (missingRequired) return "error";

    const genderValue = row.gender.trim().toLowerCase();
    if (genderValue !== "nam" && genderValue !== "nữ" && genderValue !== "nu") return "error";
    const employmentValue = row.employmentType.trim().toUpperCase();
    if (employmentValue !== "CT" && employmentValue !== "TV") return "error";

    const positionCode = row.positionCode.trim().toUpperCase();
    if (!positionCodeSet.has(positionCode)) return "error";

    const departmentCode = row.departmentCode.trim().toUpperCase();
    if (departmentCode && !departmentCodeSet.has(departmentCode)) return "error";

    const hasDuplicate =
      (row.phone && (duplicateMaps.phone.get(row.phone.trim()) ?? 0) > 1) ||
      (row.email && (duplicateMaps.email.get(row.email.trim().toLowerCase()) ?? 0) > 1) ||
      (row.socialInsuranceNumber &&
        (duplicateMaps.si.get(row.socialInsuranceNumber.trim()) ?? 0) > 1) ||
      (row.citizenIdNumber &&
        (duplicateMaps.cccd.get(row.citizenIdNumber.trim()) ?? 0) > 1);

    if (hasDuplicate) return "warning";
    return "ok";
  }, [errorMap, departmentCodeSet, positionCodeSet, duplicateMaps]);

  const okRowNumbers = useMemo(() => {
    const ok = new Set<number>();
    previewRows.forEach((row) => {
      if (getRowStatus(row) === "ok") ok.add(row.rowNumber);
    });
    return ok;
  }, [previewRows, getRowStatus]);

  const hasBlockingRows = useMemo(
    () => previewRows.some((row) => getRowStatus(row) !== "ok"),
    [previewRows, getRowStatus]
  );

  useEffect(() => {
    setSelectedRows((prev) => {
      if (prev.size === 0) return prev;
      const next = new Set<number>();
      prev.forEach((rowNumber) => {
        if (okRowNumbers.has(rowNumber)) next.add(rowNumber);
      });
      return next;
    });
  }, [okRowNumbers]);

  useEffect(() => {
    const fetchOptions = async () => {
      try {
        const [departmentsRes, positionsRes] = await Promise.all([
          fetch("/api/bo-phan"),
          fetch("/api/chuc-vu"),
        ]);
        const departmentsData = await departmentsRes.json().catch(() => ({}));
        const positionsData = await positionsRes.json().catch(() => ({}));
        setDepartmentOptions(departmentsData.items ?? []);
        setPositionOptions(positionsData.items ?? []);
      } catch (error) {
        console.error(error);
      }
    };
    void fetchOptions();
  }, []);

  const onUpload = async () => {
    if (!file) {
      toast.error("Vui lòng chọn file Excel");
      return;
    }
    setUploading(true);
    setErrors([]);
    setPreviewRows([]);
    setCreatedItems([]);
    setImportId(null);
    setSelectedRows(new Set());
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/nhan-vien/import", {
        method: "POST",
        body: formData,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.message || "Upload thất bại");
      }
      setPreviewRows(data.rows ?? []);
      setErrors(data.errors ?? []);
      setImportId(data.importId ?? null);
      if (data.errors?.length > 0) {
        toast.error("Có lỗi trong dữ liệu, vui lòng chỉnh sửa");
      } else {
        toast.success("Đã tải dữ liệu, vui lòng xác nhận");
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Upload thất bại";
      toast.error(message);
    } finally {
      setUploading(false);
    }
  };

  const onConfirm = async () => {
    const rowsToConfirm =
      confirmMode === "selected"
        ? previewRows.filter((row) => selectedRows.has(row.rowNumber))
        : previewRows;
    if (rowsToConfirm.length === 0) {
      toast.error("Không có dữ liệu để xác nhận");
      return;
    }
    setConfirming(true);
    setErrors([]);
    try {
      const res = await fetch("/api/nhan-vien/import/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ importId, rows: rowsToConfirm }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErrors(data.errors ?? []);
        throw new Error(data.message || "Xác nhận thất bại");
      }
      setCreatedItems(data.items ?? []);
      if (confirmMode === "selected") {
        setPreviewRows((prev) => prev.filter((row) => !selectedRows.has(row.rowNumber)));
        setSelectedRows(new Set());
      } else {
        setPreviewRows([]);
        setSelectedRows(new Set());
      }
      toast.success("Đã tạo nhân viên từ dữ liệu đã xác nhận");
      setConfirmOpen(false);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Xác nhận thất bại";
      toast.error(message);
    } finally {
      setConfirming(false);
    }
  };

  const updateRow = (rowNumber: number, key: keyof PreviewRow, value: string) => {
    setPreviewRows((prev) =>
      prev.map((row) => (row.rowNumber === rowNumber ? { ...row, [key]: value } : row))
    );
    setErrors((prev) => prev.filter((err) => err.row !== rowNumber));
  };

  const onRecheck = async () => {
    if (previewRows.length === 0) {
      toast.error("Không có dữ liệu để kiểm tra");
      return;
    }
    setRechecking(true);
    try {
      const res = await fetch("/api/nhan-vien/import/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rows: previewRows }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.message || "Kiểm tra thất bại");
      }
      setErrors(data.errors ?? []);
      if (data.errors?.length > 0) {
        toast.error("Vẫn còn lỗi trong dữ liệu");
      } else {
        toast.success("Dữ liệu hợp lệ");
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Kiểm tra thất bại";
      toast.error(message);
    } finally {
      setRechecking(false);
    }
  };

  const toggleRow = (rowNumber: number) => {
    if (!okRowNumbers.has(rowNumber)) return;
    setSelectedRows((prev) => {
      const next = new Set(prev);
      if (next.has(rowNumber)) next.delete(rowNumber);
      else next.add(rowNumber);
      return next;
    });
  };

  const toggleAll = () => {
    if (selectedRows.size === okRowNumbers.size) {
      setSelectedRows(new Set());
      return;
    }
    setSelectedRows(new Set(okRowNumbers));
  };

  const removeSelected = () => {
    if (selectedRows.size === 0) {
      toast.error("Chưa chọn dòng nào để xoá");
      return;
    }
    setPreviewRows((prev) => prev.filter((row) => !selectedRows.has(row.rowNumber)));
    setSelectedRows(new Set());
  };

  return (
    <>
      <Card className="rounded-none">
        <CardHeader>
          <CardTitle>Chuẩn bị & tải lên</CardTitle>
          <CardDescription>
            Tải file mẫu, điền dữ liệu theo đúng cột và định dạng, sau đó upload để tạo nhân viên.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 lg:grid-cols-2 items-stretch">
          <div className="rounded-none border border-slate-200 bg-white p-4 space-y-3 flex flex-col h-full">
            <div>
              <h3 className="text-base font-semibold text-slate-900">Tải file mẫu</h3>
              <p className="text-sm text-slate-600">
                File mẫu Excel có sẵn danh sách chức vụ và bộ phận để bạn điền mã chính xác.
              </p>
            </div>
            <div className="mt-auto">
              <Button
                asChild
                className="rounded-none bg-emerald-500 text-white shadow-sm transition hover:bg-emerald-600 hover:shadow-md w-full sm:w-auto"
              >
                <Link href="/api/nhan-vien/template">Tải file mẫu Excel</Link>
              </Button>
            </div>
          </div>

          <div className="rounded-none border border-slate-200 bg-white p-4 space-y-3 flex flex-col h-full">
            <div>
              <h3 className="text-base font-semibold text-slate-900">Upload file</h3>
              <p className="text-sm text-slate-600">Chọn file Excel theo mẫu để tải lên và kiểm tra dữ liệu.</p>
            </div>
            <label className="flex flex-col gap-2 rounded-none border border-dashed border-slate-300 bg-slate-50 px-3 py-3 text-sm cursor-pointer">
              <span className="text-slate-600">Chọn file Excel (.xlsx)</span>
              <input
                type="file"
                accept=".xlsx"
                onChange={(event) => setFile(event.target.files?.[0] ?? null)}
                className="block w-full text-sm"
              />
            </label>
            <div className="mt-auto">
              <Button
                type="button"
                onClick={onUpload}
                disabled={uploading}
                className="rounded-none bg-emerald-500 text-white shadow-sm transition hover:bg-emerald-600 hover:shadow-md w-full sm:w-auto cursor-pointer"
              >
                {uploading ? "Đang tải lên..." : "Tải lên"}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {errors.length > 0 && (
        <Card className="rounded-none border-red-200">
          <CardHeader>
            <CardTitle>Lỗi nhập liệu</CardTitle>
            <CardDescription>Vui lòng kiểm tra lại các dòng bị lỗi.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-red-600">
            {errors.map((err) => (
              <div key={`${err.row}-${err.messages.join("-")}`}>
                Dòng {err.row}: {err.messages.join(", ")}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {previewRows.length > 0 && (
        <div className="space-y-3">
          <div>
            <h3 className="text-base font-semibold text-slate-900">Preview dữ liệu</h3>
            <p className="text-sm text-slate-600">
              Chỉnh sửa dữ liệu nếu cần, sau đó bấm xác nhận để lưu.
            </p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2 text-sm">
              <label className="inline-flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={okRowNumbers.size > 0 && selectedRows.size === okRowNumbers.size}
                  onChange={toggleAll}
                  disabled={okRowNumbers.size === 0}
                  className="h-4 w-4 accent-blue-600"
                />
                Chọn tất cả
              </label>
              <span className="text-slate-500">({selectedRows.size}/{okRowNumbers.size})</span>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <Button
                type="button"
                variant="outline"
                className="rounded-none w-full sm:w-auto"
                onClick={onRecheck}
                disabled={rechecking}
              >
                {rechecking ? "Đang kiểm tra..." : "Kiểm tra lại"}
              </Button>
              <Button
                type="button"
                className="rounded-none bg-blue-600 text-white shadow-sm transition hover:bg-blue-700 hover:shadow-md w-full sm:w-auto"
                onClick={() => {
                  if (selectedRows.size === 0) {
                    toast.error("Chưa chọn dòng nào để nhập");
                    return;
                  }
                  setConfirmMode("selected");
                  setConfirmOpen(true);
                }}
              >
                Nhập đã chọn
              </Button>
              <Button
                type="button"
                className="rounded-none bg-red-500 text-white hover:bg-red-600 w-full sm:w-auto"
                onClick={() => {
                  if (selectedRows.size === 0) {
                    toast.error("Chưa chọn dòng nào để xoá");
                    return;
                  }
                  setDeleteOpen(true);
                }}
              >
                Xoá đã chọn
              </Button>
            </div>
          </div>
          <div className="w-full overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10 text-center">
                    <input
                      type="checkbox"
                      checked={okRowNumbers.size > 0 && selectedRows.size === okRowNumbers.size}
                      onChange={toggleAll}
                      disabled={okRowNumbers.size === 0}
                      className="h-4 w-4 accent-blue-600"
                    />
                  </TableHead>
                  <TableHead>STT</TableHead>
                  <TableHead>
                    Họ tên<span className="ml-1 text-red-500 cursor-pointer" title="Trường bắt buộc">*</span>
                  </TableHead>
                  <TableHead>
                    Giới tính<span className="ml-1 text-red-500 cursor-pointer" title="Trường bắt buộc">*</span>
                  </TableHead>
                  <TableHead>
                    Loại<span className="ml-1 text-red-500 cursor-pointer" title="Trường bắt buộc">*</span>
                  </TableHead>
                  <TableHead>Mã bộ phận</TableHead>
                  <TableHead>
                    Mã chức vụ<span className="ml-1 text-red-500 cursor-pointer" title="Trường bắt buộc">*</span>
                  </TableHead>
                  <TableHead>
                    SĐT<span className="ml-1 text-red-500 cursor-pointer" title="Trường bắt buộc">*</span>
                    <span
                      className="ml-1 text-amber-500 cursor-pointer"
                      title="Số điện thoại không được trùng."
                    >
                      !
                    </span>
                  </TableHead>
                  <TableHead>
                    Email<span className="ml-1 text-red-500 cursor-pointer" title="Trường bắt buộc">*</span>
                    <span className="ml-1 text-amber-500 cursor-pointer" title="Email không được trùng.">!</span>
                  </TableHead>
                  <TableHead>Lương cơ bản</TableHead>
                  <TableHead>Ngày sinh</TableHead>
                  <TableHead>Địa chỉ</TableHead>
                  <TableHead>
                    Mã BHXH
                    <span className="ml-1 text-amber-500 cursor-pointer" title="Mã BHXH không được trùng.">!</span>
                  </TableHead>
                  <TableHead>
                    CCCD/CMND
                    <span className="ml-1 text-amber-500 cursor-pointer" title="CCCD/CMND không được trùng.">!</span>
                  </TableHead>
                  <TableHead>Ngày vào làm</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {previewRows.map((row, index) => {
                  const rowStatus = getRowStatus(row);
                  const rowClass =
                    rowStatus === "warning"
                      ? "bg-amber-50"
                      : rowStatus === "error"
                        ? "bg-red-50"
                        : "";
                  return (
                    <TableRow key={row.rowNumber} className={rowClass}>
                    <TableCell className="text-center">
                      <input
                        type="checkbox"
                        checked={selectedRows.has(row.rowNumber)}
                        onChange={() => toggleRow(row.rowNumber)}
                        disabled={rowStatus !== "ok"}
                        className="h-4 w-4 accent-blue-600"
                      />
                    </TableCell>
                    <TableCell>{index + 1}</TableCell>
                    <TableCell>
                      <input
                        value={row.fullName}
                        onChange={(e) => updateRow(row.rowNumber, "fullName", e.target.value)}
                        className="w-40 border border-slate-300 px-2 py-1 text-sm"
                      />
                    </TableCell>
                    <TableCell>
                      <select
                        value={row.gender}
                        onChange={(e) => updateRow(row.rowNumber, "gender", e.target.value)}
                        className="border border-slate-300 px-2 py-1 text-sm"
                      >
                        <option value="">--</option>
                        <option value="Nam">Nam</option>
                        <option value="Nữ">Nữ</option>
                      </select>
                    </TableCell>
                    <TableCell>
                      <select
                        value={row.employmentType}
                        onChange={(e) => updateRow(row.rowNumber, "employmentType", e.target.value)}
                        className="border border-slate-300 px-2 py-1 text-sm"
                      >
                        <option value="">--</option>
                        <option value="CT">CT</option>
                        <option value="TV">TV</option>
                      </select>
                    </TableCell>
                    <TableCell>
                      <select
                        value={row.departmentCode}
                        onChange={(e) => updateRow(row.rowNumber, "departmentCode", e.target.value)}
                        className="w-28 border border-slate-300 px-2 py-1 text-sm"
                      >
                        <option value="">--</option>
                        {departmentOptions.map((dept) => (
                          <option key={dept.id} value={dept.code}>
                            {dept.code} - {dept.name}
                          </option>
                        ))}
                        {row.departmentCode &&
                          !departmentOptions.some((dept) => dept.code === row.departmentCode) && (
                            <option value={row.departmentCode}>{row.departmentCode}</option>
                          )}
                      </select>
                    </TableCell>
                    <TableCell>
                      <select
                        value={row.positionCode}
                        onChange={(e) => updateRow(row.rowNumber, "positionCode", e.target.value)}
                        className="w-28 border border-slate-300 px-2 py-1 text-sm"
                      >
                        <option value="">--</option>
                        {positionOptions.map((pos) => (
                          <option key={pos.id} value={pos.code}>
                            {pos.code} - {pos.name}
                          </option>
                        ))}
                        {row.positionCode &&
                          !positionOptions.some((pos) => pos.code === row.positionCode) && (
                            <option value={row.positionCode}>{row.positionCode}</option>
                          )}
                      </select>
                    </TableCell>
                    <TableCell>
                      <input
                        value={row.phone}
                        onChange={(e) => updateRow(row.rowNumber, "phone", e.target.value)}
                        className="w-32 border border-slate-300 px-2 py-1 text-sm"
                      />
                    </TableCell>
                    <TableCell>
                      <input
                        value={row.email}
                        onChange={(e) => updateRow(row.rowNumber, "email", e.target.value)}
                        className="w-48 border border-slate-300 px-2 py-1 text-sm"
                      />
                    </TableCell>
                    <TableCell>
                      <input
                        value={row.salary}
                        onChange={(e) => updateRow(row.rowNumber, "salary", e.target.value)}
                        className="w-28 border border-slate-300 px-2 py-1 text-sm"
                        placeholder="VND"
                      />
                    </TableCell>
                    <TableCell>
                      <input
                        type="date"
                        value={row.dob}
                        onChange={(e) => updateRow(row.rowNumber, "dob", e.target.value)}
                        className="w-32 border border-slate-300 px-2 py-1 text-sm"
                      />
                    </TableCell>
                    <TableCell>
                      <input
                        value={row.address}
                        onChange={(e) => updateRow(row.rowNumber, "address", e.target.value)}
                        className="w-48 border border-slate-300 px-2 py-1 text-sm"
                      />
                    </TableCell>
                    <TableCell>
                      <input
                        value={row.socialInsuranceNumber}
                        onChange={(e) => updateRow(row.rowNumber, "socialInsuranceNumber", e.target.value)}
                        className="w-32 border border-slate-300 px-2 py-1 text-sm"
                      />
                    </TableCell>
                    <TableCell>
                      <input
                        value={row.citizenIdNumber}
                        onChange={(e) => updateRow(row.rowNumber, "citizenIdNumber", e.target.value)}
                        className="w-32 border border-slate-300 px-2 py-1 text-sm"
                      />
                    </TableCell>
                    <TableCell>
                      <input
                        type="date"
                        value={row.joinedAt}
                        onChange={(e) => updateRow(row.rowNumber, "joinedAt", e.target.value)}
                        className="w-32 border border-slate-300 px-2 py-1 text-sm"
                      />
                    </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
          <Button
            type="button"
            onClick={() => {
              setConfirmMode("all");
              setConfirmOpen(true);
            }}
            disabled={confirming || hasBlockingRows}
            className="rounded-none bg-blue-600 text-white shadow-sm transition hover:bg-blue-700 hover:shadow-md"
          >
            {confirming ? "Đang xác nhận..." : "Xác nhận"}
          </Button>
        </div>
      )}

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="rounded-none max-w-[calc(100vw-2rem)] sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Xác nhận nhập dữ liệu</DialogTitle>
            <DialogDescription>
              {confirmMode === "selected"
                ? "Hệ thống sẽ tạo nhân viên từ các dòng đã chọn. Bạn có chắc muốn tiếp tục?"
                : "Hệ thống sẽ tạo nhân viên từ toàn bộ dữ liệu đã preview. Bạn có chắc muốn tiếp tục?"}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="destructive"
              className="rounded-none"
              onClick={() => setConfirmOpen(false)}
              disabled={confirming}
            >
              Huỷ
            </Button>
            <Button
              type="button"
              className="rounded-none bg-blue-600 text-white hover:bg-blue-700"
              onClick={onConfirm}
              disabled={confirming}
            >
              {confirming ? "Đang xác nhận..." : "Xác nhận"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent className="rounded-none max-w-[calc(100vw-2rem)] sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Xoá dòng đã chọn</DialogTitle>
            <DialogDescription>
              Các dòng đã chọn sẽ bị xoá khỏi danh sách preview. Bạn có chắc muốn tiếp tục?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="destructive"
              className="rounded-none"
              onClick={() => setDeleteOpen(false)}
            >
              Huỷ
            </Button>
            <Button
              type="button"
              className="rounded-none bg-amber-500 text-white hover:bg-amber-600"
              onClick={() => {
                removeSelected();
                setDeleteOpen(false);
              }}
            >
              Xoá đã chọn
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {createdItems.length > 0 && (
        <Card className="rounded-none">
          <CardHeader>
            <CardTitle>Danh sách vừa nhập</CardTitle>
            <CardDescription>Nhân viên được tạo thành công từ file vừa tải lên.</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Mã</TableHead>
                  <TableHead>Họ tên</TableHead>
                  <TableHead>Chức vụ</TableHead>
                  <TableHead>Bộ phận</TableHead>
                  <TableHead>Loại</TableHead>
                  <TableHead>SĐT</TableHead>
                  <TableHead>Email</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {createdItems.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="font-medium">{item.code}</TableCell>
                    <TableCell>{item.fullName}</TableCell>
                    <TableCell>{item.positionName ?? "—"}</TableCell>
                    <TableCell>{item.departmentName ?? "—"}</TableCell>
                    <TableCell>{item.employmentType}</TableCell>
                    <TableCell>{item.phone ?? "—"}</TableCell>
                    <TableCell>{item.email ?? "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </>
  );
}
