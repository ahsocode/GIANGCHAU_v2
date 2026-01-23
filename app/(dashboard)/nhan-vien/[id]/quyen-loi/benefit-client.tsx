"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

type BenefitState = {
  totalAnnualLeaveDays: number;
  usedAnnualLeaveDays: number;
  usedShiftChangeCount: number;
};

type Props = {
  employee: { id: string; fullName: string; code: string };
  benefit: BenefitState;
  totalShiftChangeCount: number;
};

function formatNumber(value: number | null | undefined) {
  if (!Number.isFinite(value)) return "0";
  return new Intl.NumberFormat("vi-VN").format(value as number);
}

export default function EmployeeBenefitClient({ employee, benefit, totalShiftChangeCount }: Props) {
  const [form, setForm] = useState<BenefitState>(benefit);
  const [saving, setSaving] = useState(false);

  const remainAnnualLeaveDays = useMemo(
    () => Math.max(0, (form.totalAnnualLeaveDays ?? 0) - (form.usedAnnualLeaveDays ?? 0)),
    [form.totalAnnualLeaveDays, form.usedAnnualLeaveDays]
  );
  const remainShiftChangeCount = useMemo(
    () => Math.max(0, totalShiftChangeCount - (form.usedShiftChangeCount ?? 0)),
    [totalShiftChangeCount, form.usedShiftChangeCount]
  );

  async function handleSave() {
    const payload = {
      totalAnnualLeaveDays: Number(form.totalAnnualLeaveDays),
      usedAnnualLeaveDays: Number(form.usedAnnualLeaveDays),
      usedShiftChangeCount: Number(form.usedShiftChangeCount),
    };
    if (
      !Number.isFinite(payload.totalAnnualLeaveDays) ||
      !Number.isFinite(payload.usedAnnualLeaveDays) ||
      !Number.isFinite(payload.usedShiftChangeCount) ||
      payload.totalAnnualLeaveDays < 0 ||
      payload.usedAnnualLeaveDays < 0 ||
      payload.usedShiftChangeCount < 0
    ) {
      toast.error("Vui lòng nhập số hợp lệ (>= 0).");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/nhan-vien/${employee.id}/quyen-loi`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => null);
        throw new Error(err?.message || "Không thể cập nhật quyền lợi.");
      }
      toast.success("Đã cập nhật quyền lợi.");
    } catch (error) {
      console.error(error);
      toast.error(error instanceof Error ? error.message : "Không thể cập nhật quyền lợi.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-5 w-full">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <p className="text-sm text-slate-500">Quyền lợi nhân viên</p>
          <h1 className="text-2xl font-semibold text-slate-900">{employee.fullName}</h1>
          <p className="text-sm text-slate-500">Mã: {employee.code}</p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href={`/nhan-vien/${employee.id}/edit`}
            className="px-3 py-2 text-sm font-semibold rounded-md border border-blue-200 text-blue-700 hover:bg-blue-50 transition"
          >
            Chỉnh sửa
          </Link>
          <Link
            href={`/nhan-vien/${employee.id}`}
            className="px-3 py-2 text-sm font-semibold rounded-md border border-slate-200 text-slate-700 hover:bg-slate-50 transition"
          >
            ← Quay lại hồ sơ
          </Link>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-lg border border-slate-200 bg-white p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-slate-900">Phép năm</h2>
            <Button
              type="button"
              className="rounded-none bg-emerald-500 text-white hover:bg-emerald-600"
              onClick={handleSave}
              disabled={saving}
            >
              {saving ? "Đang lưu..." : "Lưu thay đổi"}
            </Button>
          </div>
          <div className="grid gap-3 text-sm text-slate-700">
            <label className="flex flex-col gap-2">
              Tổng ngày phép
              <input
                type="number"
                min={0}
                value={form.totalAnnualLeaveDays}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, totalAnnualLeaveDays: Number(e.target.value) }))
                }
                className="rounded-none border border-slate-300 bg-white px-3 py-2 text-sm"
              />
            </label>
            <label className="flex flex-col gap-2">
              Đã dùng
              <input
                type="number"
                min={0}
                value={form.usedAnnualLeaveDays}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, usedAnnualLeaveDays: Number(e.target.value) }))
                }
                className="rounded-none border border-slate-300 bg-white px-3 py-2 text-sm"
              />
            </label>
            <div className="flex justify-between text-sm">
              <span className="text-slate-500">Còn lại</span>
              <span className="font-semibold text-slate-900">{formatNumber(remainAnnualLeaveDays)}</span>
            </div>
          </div>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-6 space-y-4">
          <h2 className="text-base font-semibold text-slate-900">Đổi ca</h2>
          <div className="grid gap-3 text-sm text-slate-700">
            <div className="flex justify-between">
              <span className="text-slate-500">Tổng lượt được đổi</span>
              <span className="font-semibold">{formatNumber(totalShiftChangeCount)}</span>
            </div>
            <label className="flex flex-col gap-2">
              Đã dùng
              <input
                type="number"
                min={0}
                value={form.usedShiftChangeCount}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, usedShiftChangeCount: Number(e.target.value) }))
                }
                className="rounded-none border border-slate-300 bg-white px-3 py-2 text-sm"
              />
            </label>
            <div className="flex justify-between text-sm">
              <span className="text-slate-500">Còn lại</span>
              <span className="font-semibold text-slate-900">{formatNumber(remainShiftChangeCount)}</span>
            </div>
          </div>
          <div className="text-xs text-slate-500">
            Tổng lượt đổi ca lấy theo cấu hình hệ thống hiện hành.
          </div>
        </div>
      </div>
    </div>
  );
}
