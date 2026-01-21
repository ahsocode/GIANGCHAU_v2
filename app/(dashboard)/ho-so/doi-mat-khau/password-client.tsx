"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

export default function DoiMatKhauClient() {
  const [currentPassword, setCurrentPassword] = useState("");
  const [nextPassword, setNextPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!currentPassword || !nextPassword || !confirmPassword) {
      toast.error("Vui lòng nhập đầy đủ thông tin.");
      return;
    }
    if (nextPassword.length < 6) {
      toast.error("Mật khẩu mới tối thiểu 6 ký tự.");
      return;
    }
    if (nextPassword !== confirmPassword) {
      toast.error("Mật khẩu xác nhận không khớp.");
      return;
    }

    try {
      setSubmitting(true);
      const res = await fetch("/api/ho-so/doi-mat-khau", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currentPassword,
          nextPassword,
        }),
      });
      const data = (await res.json()) as { message?: string };
      if (!res.ok) {
        toast.error(data.message ?? "Không thể đổi mật khẩu.");
        return;
      }
      toast.success("Đổi mật khẩu thành công.");
      setCurrentPassword("");
      setNextPassword("");
      setConfirmPassword("");
    } catch (error: unknown) {
      console.error(error);
      toast.error("Không thể đổi mật khẩu.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-4 max-w-xl">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Đổi mật khẩu</h1>
        <p className="text-sm text-muted-foreground">Cập nhật mật khẩu tài khoản của bạn.</p>
      </div>

      <form onSubmit={handleSubmit} className="rounded-lg border border-slate-200 bg-white p-5 space-y-4">
        <div className="space-y-2">
          <label className="text-sm font-medium text-slate-700" htmlFor="currentPassword">
            Mật khẩu hiện tại
          </label>
          <Input
            id="currentPassword"
            type="password"
            value={currentPassword}
            onChange={(event) => setCurrentPassword(event.target.value)}
            placeholder="Nhập mật khẩu hiện tại"
          />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium text-slate-700" htmlFor="nextPassword">
            Mật khẩu mới
          </label>
          <Input
            id="nextPassword"
            type="password"
            value={nextPassword}
            onChange={(event) => setNextPassword(event.target.value)}
            placeholder="Nhập mật khẩu mới"
          />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium text-slate-700" htmlFor="confirmPassword">
            Xác nhận mật khẩu mới
          </label>
          <Input
            id="confirmPassword"
            type="password"
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            placeholder="Nhập lại mật khẩu mới"
          />
        </div>
        <div className="flex justify-end">
          <Button className="rounded-none bg-emerald-500 text-white hover:bg-emerald-600" disabled={submitting}>
            Cập nhật mật khẩu
          </Button>
        </div>
      </form>
    </div>
  );
}
