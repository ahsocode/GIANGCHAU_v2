"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

type EmploymentType = "CT" | "TV";
type Option = { id: string; name: string; code?: string };

type EmployeeDetail = {
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
  phone: string | null;
  gender: string | null;
  dob: string | null;
  address: string | null;
  avatarUrl: string | null;
  joinedAt: string | null;
  resignedAt: string | null;
  createdAt: string;
  updatedAt: string;
  socialInsuranceNumber: string | null;
  citizenIdNumber: string | null;
  isActive: boolean;
  personalEmail?: string | null;
  salary: number | null;
};

const CLOUDINARY_CLOUD_NAME = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
const CLOUDINARY_AVATAR_FOLDER =
  process.env.NEXT_PUBLIC_CLOUDINARY_AVATAR_FOLDER || "employee_avatar";

export default function EmployeeEditPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const id = params?.id;
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [employee, setEmployee] = useState<EmployeeDetail | null>(null);
  const [departments, setDepartments] = useState<Option[]>([]);
  const [positions, setPositions] = useState<Option[]>([]);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string>("");
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [accountModalOpen, setAccountModalOpen] = useState(false);
  const [accountEmailModal, setAccountEmailModal] = useState("");
  const [savingAccount, setSavingAccount] = useState(false);

  type FormState = {
    fullName: string;
    employmentType: EmploymentType;
    departmentId: string | null;
    positionId: string | null;
    accountEmail: string;
    phone: string;
    personalEmail: string;
    gender: string;
    dob: string;
    address: string;
    avatarUrl: string;
    joinedAt: string;
    resignedAt: string;
    socialInsuranceNumber: string;
    citizenIdNumber: string;
    salary: string;
    isActive: boolean;
  };

  const [form, setForm] = useState<FormState>({
    fullName: "",
    employmentType: "CT" as EmploymentType,
    departmentId: "" as string | null,
    positionId: "" as string | null,
    accountEmail: "",
    phone: "",
    personalEmail: "",
    gender: "",
    dob: "",
    address: "",
    avatarUrl: "",
    joinedAt: "",
    resignedAt: "",
    socialInsuranceNumber: "",
    citizenIdNumber: "",
    salary: "",
    isActive: true,
  });

  useEffect(() => {
    if (!id) return;
    (async () => {
      try {
        setLoading(true);
        const [empRes, depsRes, posRes] = await Promise.all([
          fetch(`/api/nhan-vien/${id}`),
          fetch("/api/bo-phan"),
          fetch("/api/chuc-vu"),
        ]);
        if (!empRes.ok) {
          toast.error("Không tải được thông tin nhân viên");
          router.push("/nhan-vien");
          return;
        }
        const empJson = (await empRes.json()) as { item: EmployeeDetail };
        const emp = empJson.item;
        setEmployee(emp);
        const initialForm = {
          fullName: emp.fullName,
          employmentType: emp.employmentType,
          departmentId: emp.departmentId ?? "",
          positionId: emp.positionId ?? "",
          accountEmail: emp.accountEmail ?? "",
          phone: emp.phone ?? "",
          personalEmail: emp.personalEmail ?? "",
          gender: emp.gender ?? "",
          dob: emp.dob ? emp.dob.slice(0, 10) : "",
          address: emp.address ?? "",
          avatarUrl: emp.avatarUrl ?? "",
          joinedAt: emp.joinedAt
            ? emp.joinedAt.slice(0, 10)
            : emp.createdAt
              ? emp.createdAt.slice(0, 10)
              : "",
          resignedAt: emp.resignedAt ? emp.resignedAt.slice(0, 10) : "",
          socialInsuranceNumber: emp.socialInsuranceNumber ?? "",
          citizenIdNumber: emp.citizenIdNumber ?? "",
          salary: emp.salary !== null && emp.salary !== undefined ? String(emp.salary) : "",
          isActive: emp.isActive,
        };
        setForm(initialForm);
        setAccountEmailModal(initialForm.accountEmail);
        setPreviewUrl(initialForm.avatarUrl || "");
        setPendingFile(null);

        if (depsRes.ok) {
          const data = (await depsRes.json()) as { items?: Option[] };
          setDepartments(data.items ?? []);
        }
        if (posRes.ok) {
          const data = (await posRes.json()) as { items?: Option[] };
          setPositions(data.items ?? []);
        }
      } catch (error) {
        console.error(error);
        toast.error("Không tải được dữ liệu");
      } finally {
        setLoading(false);
      }
    })();
  }, [id, router]);

  const typeLabel = form.employmentType === "TV" ? "Thời vụ" : "Chính thức";

  const uploadAvatar = async (file: File, code: string) => {
    if (!CLOUDINARY_CLOUD_NAME) {
      toast.error("Thiếu cấu hình Cloudinary (cloud name)");
      return null;
    }
    try {
      const signRes = await fetch("/api/cloudinary/sign-avatar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ publicId: code, folder: CLOUDINARY_AVATAR_FOLDER }),
      });
      if (!signRes.ok) {
        const err = await signRes.json().catch(() => null);
        throw new Error(err?.message || "Ký upload thất bại");
      }
      const sign = (await signRes.json()) as {
        cloudName: string;
        apiKey: string;
        timestamp: number;
        folder?: string;
        publicId: string;
        signature: string;
      };

      const formData = new FormData();
      formData.append("file", file);
      formData.append("api_key", sign.apiKey);
      formData.append("timestamp", String(sign.timestamp));
      formData.append("signature", sign.signature);
      formData.append("public_id", sign.publicId);
      formData.append("overwrite", "true");
      formData.append("unique_filename", "false");
      formData.append("invalidate", "true");
      if (sign.folder) formData.append("folder", sign.folder);

      const res = await fetch(`https://api.cloudinary.com/v1_1/${sign.cloudName}/auto/upload`, {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error?.message || "Upload thất bại");
      }
      return data.secure_url as string;
    } catch (error) {
      console.error(error);
      toast.error(error instanceof Error ? error.message : "Upload thất bại");
      return null;
    }
  };

  const onSubmit = async () => {
    if (!id) return;
    if (!form.fullName.trim()) {
      toast.error("Vui lòng nhập họ tên");
      return;
    }
    if (!employee) {
      toast.error("Không tìm thấy nhân viên");
      return;
    }
    setSaving(true);
    try {
      let avatarUrl = form.avatarUrl || null;
      // Upload ảnh trước, dùng mã hiện tại (code không đổi nếu chỉ chỉnh thông tin, nếu đổi vị trí/loại sẽ đổi trong cùng request dưới)
      if (pendingFile) {
        const fileForUpload = await convertFileToWebp(pendingFile);
        const url = await uploadAvatar(fileForUpload, employee.code);
        if (!url) {
          throw new Error("Upload ảnh thất bại");
        }
        avatarUrl = url;
      }

        const payload = {
          fullName: form.fullName.trim(),
          employmentType: form.employmentType,
          departmentId: form.departmentId || null,
          positionId: form.positionId || null,
          phone: form.phone || null,
          personalEmail: form.personalEmail || null,
          accountEmail: form.accountEmail || null,
          gender: form.gender || null,
          dob: form.dob || null,
          address: form.address || null,
          joinedAt: form.joinedAt || null,
          resignedAt: form.resignedAt || null,
          socialInsuranceNumber: form.socialInsuranceNumber || null,
          citizenIdNumber: form.citizenIdNumber || null,
          salary: form.salary ? Number(form.salary) : null,
          isActive: form.isActive,
          avatarUrl,
        } satisfies Record<string, unknown>;

      const res = await fetch(`/api/nhan-vien/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => null);
        throw new Error(err?.message || "Lưu thất bại");
      }
      const updated = (await res.json()).item as EmployeeDetail;

      setEmployee(updated);
      toast.success("Đã lưu thông tin");
      router.push(`/nhan-vien/${id}`);
    } catch (error) {
      console.error(error);
      toast.error(error instanceof Error ? error.message : "Lưu thất bại");
    } finally {
      setSaving(false);
    }
  };

  const saveAccountEmail = async () => {
    if (!id || !employee) return;
    if (!form.fullName.trim()) {
      toast.error("Vui lòng nhập họ tên trước");
      return;
    }
    setSavingAccount(true);
    try {
      const payload = {
        fullName: form.fullName.trim(),
        employmentType: form.employmentType,
        departmentId: form.departmentId || null,
        positionId: form.positionId || null,
        phone: form.phone || null,
        accountEmail: accountEmailModal || null,
        gender: form.gender || null,
        dob: form.dob || null,
        address: form.address || null,
        joinedAt: form.joinedAt || null,
        resignedAt: form.resignedAt || null,
        socialInsuranceNumber: form.socialInsuranceNumber || null,
        citizenIdNumber: form.citizenIdNumber || null,
        salary: form.salary ? Number(form.salary) : null,
        isActive: form.isActive,
      } satisfies Record<string, unknown>;

      const res = await fetch(`/api/nhan-vien/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => null);
        throw new Error(err?.message || "Lưu thất bại");
      }
      const data = (await res.json()).item as EmployeeDetail;
      setForm((prev) => ({ ...prev, accountEmail: data.accountEmail ?? "" }));
      setEmployee((prev) => (prev ? { ...prev, accountEmail: data.accountEmail ?? null } : prev));
      setAccountModalOpen(false);
      toast.success("Đã lưu tài khoản");
    } catch (error) {
      console.error(error);
      toast.error(error instanceof Error ? error.message : "Lưu thất bại");
    } finally {
      setSavingAccount(false);
    }
  };

  const currentAvatar = pendingFile
    ? previewUrl
    : form.avatarUrl || previewUrl || "";

  const triggerFile = () => {
    fileInputRef.current?.click();
  };

  useEffect(() => {
    if (!pendingFile) return;
    const url = URL.createObjectURL(pendingFile);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [pendingFile]);

  if (loading) {
    return <div className="text-sm text-slate-600">Đang tải...</div>;
  }
  if (!employee) {
    return <div className="text-sm text-red-600">Không tìm thấy nhân viên.</div>;
  }

  return (
    <div className="space-y-5 w-full">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <p className="text-sm text-slate-500">Chỉnh sửa nhân viên</p>
          <h1 className="text-2xl font-semibold text-slate-900">{employee.fullName}</h1>
          <p className="text-sm text-slate-500">Mã: {employee.code}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => router.push(`/nhan-vien/${employee.id}`)} className="rounded-none">
            ← Xem chi tiết
          </Button>
          <Button variant="outline" onClick={() => router.push("/nhan-vien")} className="rounded-none">
            Danh sách
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_3fr] xl:grid-cols-[1.2fr_2.8fr] gap-5">
        <div className="bg-white border border-slate-200 rounded-lg p-4 sm:p-6 space-y-4 h-full">
          <div className="w-full h-64 sm:h-72 bg-slate-50 border border-slate-200 rounded-lg flex items-center justify-center overflow-hidden">
            {currentAvatar ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={currentAvatar} alt={employee.fullName} className="h-full w-full object-cover" />
            ) : (
              <span className="text-slate-400 text-sm">Chưa có ảnh</span>
            )}
          </div>
          <div className="flex gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                setPendingFile(file);
              }}
            />
            <Button type="button" className="rounded-none bg-emerald-500 text-white hover:bg-emerald-600" onClick={triggerFile}>
              {currentAvatar ? "Đổi ảnh" : "Tải ảnh"}
            </Button>
            {currentAvatar && (
              <Button
                type="button"
                variant="destructive"
                className="rounded-none"
                onClick={() => {
                  setForm((prev) => ({ ...prev, avatarUrl: "" }));
                  setPendingFile(null);
                  setPreviewUrl("");
                }}
              >
                Xóa ảnh
              </Button>
            )}
          </div>
          <div className="space-y-2 text-sm text-slate-700">
            <div className="flex justify-between">
              <span className="text-slate-500">Loại</span>
              <span className="font-semibold">{typeLabel}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Chức vụ</span>
              <span className="font-semibold">{employee.positionName ?? "—"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Bộ phận</span>
              <span className="font-semibold">{employee.departmentName ?? "—"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Lương cơ bản</span>
              <span className="font-semibold">
                {employee.salary !== null && employee.salary !== undefined
                  ? `${new Intl.NumberFormat("vi-VN").format(employee.salary)} VND`
                  : "—"}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Mã vạch</span>
              <span className="font-semibold">{employee.code}</span>
            </div>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-lg p-4 sm:p-6 md:p-8">
          <div className="space-y-4">
            <div>
              <label className="text-sm text-slate-600">Họ và tên</label>
              <Input
                value={form.fullName}
                onChange={(e) => setForm((prev) => ({ ...prev, fullName: e.target.value }))}
                className="rounded-none"
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-sm text-slate-600">Loại nhân viên</label>
                <select
                  value={form.employmentType}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, employmentType: e.target.value as EmploymentType }))
                  }
                  className="w-full rounded-none border border-slate-300 bg-white px-3 py-2 text-sm"
                >
                  <option value="CT">Chính thức</option>
                  <option value="TV">Thời vụ</option>
                </select>
              </div>
              <div>
                <label className="text-sm text-slate-600">Số điện thoại</label>
                <Input
                  value={form.phone}
                  onChange={(e) => setForm((prev) => ({ ...prev, phone: e.target.value }))}
                  className="rounded-none"
                />
              </div>
            </div>

            <div>
              <label className="text-sm text-slate-600">Lương cơ bản (VND)</label>
              <Input
                type="number"
                min={0}
                value={form.salary}
                onChange={(e) => setForm((prev) => ({ ...prev, salary: e.target.value }))}
                className="rounded-none"
              />
            </div>

              <div>
                <label className="text-sm text-slate-600">Email liên hệ</label>
                <Input
                  type="email"
                  value={form.personalEmail ?? ""}
                  onChange={(e) => setForm((prev) => ({ ...prev, personalEmail: e.target.value }))}
                  className="rounded-none"
                />
              </div>

            <div>
              <label className="text-sm text-slate-600">Email tài khoản</label>
              <div className="flex gap-2 items-center">
                <Input
                  type="email"
                  value={form.accountEmail}
                  onChange={(e) => setForm((prev) => ({ ...prev, accountEmail: e.target.value }))}
                  placeholder="user@example.com"
                  className="rounded-none"
                  disabled
                />
                <Button
                  type="button"
                  variant="outline"
                  className="rounded-none"
                  onClick={() => {
                    setAccountEmailModal(form.accountEmail);
                    setAccountModalOpen(true);
                  }}
                >
                  Gán / tạo
                </Button>
                {form.accountEmail && (
                  <Button
                    type="button"
                    variant="destructive"
                    className="rounded-none"
                    onClick={() => {
                      setAccountEmailModal("");
                      saveAccountEmail();
                    }}
                    disabled={savingAccount}
                  >
                    Bỏ gán
                  </Button>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-sm text-slate-600">Trạng thái</label>
                <select
                  value={form.isActive ? "ACTIVE" : "INACTIVE"}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      isActive: e.target.value === "ACTIVE",
                      resignedAt: e.target.value === "ACTIVE" ? "" : prev.resignedAt,
                    }))
                  }
                  className="w-full rounded-none border border-slate-300 bg-white px-3 py-2 text-sm"
                >
                  <option value="ACTIVE">Đang làm</option>
                  <option value="INACTIVE">Đã nghỉ</option>
                </select>
              </div>
              <div />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-sm text-slate-600">Giới tính</label>
                <select
                  value={form.gender}
                  onChange={(e) => setForm((prev) => ({ ...prev, gender: e.target.value }))}
                  className="w-full rounded-none border border-slate-300 bg-white px-3 py-2 text-sm"
                >
                  <option value="">-- Chưa chọn --</option>
                  <option value="MALE">Nam</option>
                  <option value="FEMALE">Nữ</option>
                  <option value="OTHER">Khác</option>
                </select>
              </div>
              <div>
                <label className="text-sm text-slate-600">Ngày sinh</label>
                <Input
                  type="date"
                  value={form.dob}
                  onChange={(e) => setForm((prev) => ({ ...prev, dob: e.target.value }))}
                  className="rounded-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-sm text-slate-600">BHXH</label>
                <Input
                  value={form.socialInsuranceNumber}
                  onChange={(e) => setForm((prev) => ({ ...prev, socialInsuranceNumber: e.target.value }))}
                  className="rounded-none"
                />
              </div>
              <div>
                <label className="text-sm text-slate-600">CCCD/CMND</label>
                <Input
                  value={form.citizenIdNumber}
                  onChange={(e) => setForm((prev) => ({ ...prev, citizenIdNumber: e.target.value }))}
                  className="rounded-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-sm text-slate-600">Bộ phận</label>
                <select
                  value={form.departmentId || ""}
                  onChange={(e) => setForm((prev) => ({ ...prev, departmentId: e.target.value || "" }))}
                  className="w-full rounded-none border border-slate-300 bg-white px-3 py-2 text-sm"
                >
                  <option value="">-- Không chọn --</option>
                  {departments.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-sm text-slate-600">Chức vụ</label>
                <select
                  value={form.positionId || ""}
                  onChange={(e) => setForm((prev) => ({ ...prev, positionId: e.target.value || "" }))}
                  className="w-full rounded-none border border-slate-300 bg-white px-3 py-2 text-sm"
                >
                  <option value="">-- Không chọn --</option>
                  {positions.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="text-sm text-slate-600">Địa chỉ</label>
              <textarea
                value={form.address}
                onChange={(e) => setForm((prev) => ({ ...prev, address: e.target.value }))}
                className="w-full rounded-none border border-slate-300 bg-white px-3 py-2 text-sm min-h-[80px]"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-sm text-slate-600">Ngày vào làm</label>
                <Input
                  type="date"
                  value={form.joinedAt}
                  onChange={(e) => setForm((prev) => ({ ...prev, joinedAt: e.target.value }))}
                  className="rounded-none"
                />
              </div>
              {form.isActive ? null : (
                <div>
                  <label className="text-sm text-slate-600">Ngày nghỉ</label>
                  <Input
                    type="date"
                    value={form.resignedAt}
                    onChange={(e) => setForm((prev) => ({ ...prev, resignedAt: e.target.value }))}
                    className="rounded-none"
                  />
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="destructive"
                className="rounded-none"
                onClick={() => router.push(`/nhan-vien/${employee.id}`)}
                disabled={saving}
              >
                Huỷ
              </Button>
              <Button
                type="button"
                className="rounded-none bg-emerald-500 text-white hover:bg-emerald-600"
                onClick={onSubmit}
                disabled={saving}
              >
                {saving ? "Đang lưu..." : "Lưu thông tin"}
              </Button>
            </div>
          </div>
        </div>
      </div>

      <AccountModal
        open={accountModalOpen}
        onOpenChange={setAccountModalOpen}
        value={accountEmailModal}
        onChange={setAccountEmailModal}
        onSave={saveAccountEmail}
        saving={savingAccount}
      />
    </div>
  );
}

async function convertFileToWebp(file: File): Promise<File> {
  // Nếu đã là webp thì dùng luôn
  if (file.type === "image/webp") return file;

  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error("Không đọc được file ảnh"));
    reader.readAsDataURL(file);
  });

  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Không tải được ảnh để chuyển đổi"));
    image.src = dataUrl;
  });

  const canvas = document.createElement("canvas");
  canvas.width = img.width;
  canvas.height = img.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return file;
  ctx.drawImage(img, 0, 0);

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob((b) => resolve(b), "image/webp", 0.9)
  );
  if (!blob) return file;

  const newName = file.name.replace(/\.[^.]+$/, "") + ".webp";
  return new File([blob], newName, { type: "image/webp" });
}

function AccountModal({
  open,
  onOpenChange,
  value,
  onChange,
  onSave,
  saving,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  value: string;
  onChange: (v: string) => void;
  onSave: () => void;
  saving: boolean;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-none max-w-md">
        <DialogHeader>
          <DialogTitle>Gán / tạo tài khoản</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1">
            <label className="text-sm text-slate-600">Email tài khoản</label>
            <Input
              type="email"
              value={value}
              onChange={(e) => onChange(e.target.value)}
              placeholder="user@example.com"
              className="rounded-none"
            />
            <p className="text-xs text-slate-500">
              Nhập email để gán vào nhân viên này. Nếu email chưa có tài khoản, hệ thống sẽ tạo mới.
            </p>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="destructive" className="rounded-none" onClick={() => onOpenChange(false)} disabled={saving}>
              Huỷ
            </Button>
            <Button className="rounded-none bg-emerald-500 text-white hover:bg-emerald-600" onClick={onSave} disabled={saving}>
              {saving ? "Đang lưu..." : "Lưu"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
