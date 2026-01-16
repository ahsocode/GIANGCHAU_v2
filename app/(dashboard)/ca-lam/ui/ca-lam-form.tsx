"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type WorkShiftStatus = "ACTIVE" | "ARCHIVED";

type FormValues = {
  code: string;
  name: string;
  startTime: string;
  endTime: string;
  breakMinutes: number;
  lateGraceMinutes: number;
  earlyGraceMinutes: number;
  overtimeThresholdMinutes: number;
  status: WorkShiftStatus;
};

type CaLamFormProps = {
  mode: "create" | "edit";
  initialValues?: FormValues;
  shiftId?: string;
};

function toCodeFromName(name: string) {
  const cleaned = name
    .toLowerCase()
    .replace(/đ/g, "d")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return cleaned.replace(/\s+/g, "");
}

export function CaLamForm({ mode, initialValues, shiftId }: CaLamFormProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [values, setValues] = useState<FormValues>(
    initialValues ?? {
      code: "",
      name: "",
      startTime: "08:00",
      endTime: "17:00",
      breakMinutes: 60,
      lateGraceMinutes: 15,
      earlyGraceMinutes: 0,
      overtimeThresholdMinutes: 60,
      status: "ACTIVE",
    }
  );
  const codeAuto = useMemo(() => toCodeFromName(values.name), [values.name]);

  function update<K extends keyof FormValues>(key: K, value: FormValues[K]) {
    setValues((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const finalCode = mode === "create" ? codeAuto : values.code;
    if (!finalCode.trim() || !values.name.trim()) {
      toast.error("Vui lòng nhập mã và tên ca làm.");
      return;
    }
    if (!values.startTime || !values.endTime) {
      toast.error("Vui lòng nhập giờ bắt đầu và giờ kết thúc.");
      return;
    }

    try {
      setLoading(true);
      const res = await fetch(mode === "create" ? "/api/ca-lam" : `/api/ca-lam/${shiftId}`, {
        method: mode === "create" ? "POST" : "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: finalCode.trim(),
          name: values.name.trim(),
          startTime: values.startTime,
          endTime: values.endTime,
          breakMinutes: Number(values.breakMinutes) || 0,
          lateGraceMinutes: Number(values.lateGraceMinutes) || 0,
          earlyGraceMinutes: Number(values.earlyGraceMinutes) || 0,
          overtimeThresholdMinutes: Number(values.overtimeThresholdMinutes) || 0,
          status: values.status,
        }),
      });
      if (!res.ok) {
        const data = (await res.json()) as { message?: string };
        throw new Error(data.message ?? "Không thể lưu ca làm.");
      }
      toast.success(mode === "create" ? "Đã tạo ca làm." : "Đã cập nhật ca làm.");
      router.push("/ca-lam/danh-sach");
      router.refresh();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Không thể lưu ca làm.";
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <form className="space-y-4" onSubmit={handleSubmit}>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <label className="text-sm font-medium">Mã ca làm</label>
          <Input
            value={mode === "create" ? codeAuto : values.code}
            onChange={(event) => update("code", event.target.value)}
            placeholder="VD: CA-SANG"
            className="rounded-none"
            disabled={mode === "create"}
          />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium">Tên ca làm</label>
          <Input
            value={values.name}
            onChange={(event) => update("name", event.target.value)}
            placeholder="VD: Ca sáng"
            className="rounded-none"
          />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium">Giờ bắt đầu</label>
          <Input
            type="time"
            value={values.startTime}
            onChange={(event) => update("startTime", event.target.value)}
            className="rounded-none"
          />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium">Giờ kết thúc</label>
          <Input
            type="time"
            value={values.endTime}
            onChange={(event) => update("endTime", event.target.value)}
            className="rounded-none"
          />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium">Nghỉ giữa ca (phút)</label>
          <Input
            type="number"
            min={0}
            value={values.breakMinutes}
            onChange={(event) => update("breakMinutes", Number(event.target.value))}
            className="rounded-none"
          />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium">Cho phép trễ (phút)</label>
          <Input
            type="number"
            min={0}
            value={values.lateGraceMinutes}
            onChange={(event) => update("lateGraceMinutes", Number(event.target.value))}
            className="rounded-none"
          />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium">Cho phép về sớm (phút)</label>
          <Input
            type="number"
            min={0}
            value={values.earlyGraceMinutes}
            onChange={(event) => update("earlyGraceMinutes", Number(event.target.value))}
            className="rounded-none"
          />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium">Ngưỡng tính tăng ca (phút)</label>
          <Input
            type="number"
            min={0}
            value={values.overtimeThresholdMinutes}
            onChange={(event) => update("overtimeThresholdMinutes", Number(event.target.value))}
            className="rounded-none"
          />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium">Trạng thái</label>
          <select
            value={values.status}
            onChange={(event) => update("status", event.target.value as WorkShiftStatus)}
            className="rounded-none border border-slate-300 bg-white px-2 py-2 text-sm"
          >
            <option value="ACTIVE">Đang áp dụng</option>
            <option value="ARCHIVED">Ngừng áp dụng</option>
          </select>
        </div>
      </div>

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button
          type="button"
          variant="outline"
          className="rounded-none w-full sm:w-auto"
          onClick={() => router.push("/ca-lam/danh-sach")}
          disabled={loading}
        >
          Quay lại
        </Button>
        <Button
          type="submit"
          className="rounded-none bg-emerald-500 text-white hover:bg-emerald-600 w-full sm:w-auto"
          disabled={loading}
        >
          {loading ? "Đang lưu..." : mode === "create" ? "Tạo ca làm" : "Lưu thay đổi"}
        </Button>
      </div>
    </form>
  );
}
