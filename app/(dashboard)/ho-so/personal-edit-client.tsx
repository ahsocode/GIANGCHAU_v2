"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

type Props = {
  personalEmail: string;
  dob: string;
  address: string;
  gender: string;
  phone: string;
  socialInsuranceNumber: string;
  citizenIdNumber: string;
};

export default function PersonalEditClient(props: Props) {
  const [email, setEmail] = useState(props.personalEmail);
  const [dobValue, setDobValue] = useState(props.dob);
  const [addr, setAddr] = useState(props.address);
  const [genderValue, setGenderValue] = useState(props.gender);
  const [saving, setSaving] = useState(false);

  const onSave = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/ho-so", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          personalEmail: email || null,
          dob: dobValue || null,
          address: addr || null,
          gender: genderValue || null,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => null);
        throw new Error(err?.message || "Cập nhật thất bại");
      }
      toast.success("Đã cập nhật thông tin cá nhân");
    } catch (error) {
      console.error(error);
      toast.error(error instanceof Error ? error.message : "Cập nhật thất bại");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div className="space-y-2">
        <label className="text-sm text-slate-600">Email cá nhân</label>
        <Input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="rounded-none focus-visible:ring-0 focus-visible:ring-offset-0"
        />
      </div>
      <div className="space-y-2">
        <label className="text-sm text-slate-600">Ngày sinh</label>
        <Input
          type="date"
          value={dobValue}
          onChange={(e) => setDobValue(e.target.value)}
          className="rounded-none focus-visible:ring-0 focus-visible:ring-offset-0"
        />
      </div>
      <div className="space-y-2">
        <label className="text-sm text-slate-600">Giới tính</label>
        <select
          value={genderValue}
          onChange={(e) => setGenderValue(e.target.value)}
          className="w-full rounded-none border border-slate-300 bg-white px-3 py-2 text-sm"
        >
          <option value="">-- Chưa chọn --</option>
          <option value="MALE">Nam</option>
          <option value="FEMALE">Nữ</option>
          <option value="OTHER">Khác</option>
        </select>
      </div>
      <div className="space-y-2 md:col-span-2">
        <label className="text-sm text-slate-600">Địa chỉ</label>
        <textarea
          value={addr}
          onChange={(e) => setAddr(e.target.value)}
          className="w-full rounded-none border border-slate-300 bg-white px-3 py-2 text-sm min-h-[80px] focus-visible:ring-0 focus-visible:ring-offset-0"
        />
      </div>
      <div className="space-y-1 text-sm text-slate-600 md:col-span-2">
        <div>Số điện thoại: {props.phone || "—"} (liên hệ HR để thay đổi)</div>
        <div>CCCD/CMND: {props.citizenIdNumber || "—"} (liên hệ HR để thay đổi)</div>
        <div>BHXH: {props.socialInsuranceNumber || "—"} (liên hệ HR để thay đổi)</div>
      </div>
      <div className="flex justify-end md:col-span-2">
        <Button
          type="button"
          className="rounded-none bg-emerald-500 text-white hover:bg-emerald-600"
          onClick={onSave}
          disabled={saving}
        >
          {saving ? "Đang lưu..." : "Lưu thay đổi"}
        </Button>
      </div>
    </div>
  );
}
