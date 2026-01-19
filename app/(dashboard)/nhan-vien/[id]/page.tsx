import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import type { Employee } from "@prisma/client";
import { Barcode } from "@/components/ui/barcode";

type EmployeeDetail = {
  id: string;
  code: string;
  fullName: string;
  employmentType: "CT" | "TV";
  departmentName: string | null;
  positionName: string | null;
  positionCode: string | null;
  accountEmail: string | null;
  phone: string | null;
  personalEmail: string | null;
  gender: string | null;
  dob: Date | null;
  address: string | null;
  socialInsuranceNumber: string | null;
  citizenIdNumber: string | null;
  avatarUrl: string | null;
  joinedAt: Date | null;
  resignedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  isActive: boolean;
  salary: number | null;
};

function formatDate(value: Date | string | null | undefined) {
  if (!value) return "—";
  const date = typeof value === "string" ? new Date(value) : value;
  return new Intl.DateTimeFormat("vi-VN").format(date);
}

function formatGender(value: string | null | undefined) {
  if (value === "MALE") return "Nam";
  if (value === "FEMALE") return "Nữ";
  if (value === "OTHER") return "Khác";
  return "—";
}


export const dynamic = "force-dynamic";

export default async function EmployeeDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!id) notFound();

  const emp = await prisma.employee.findUnique({
    where: { id },
    include: {
      department: { select: { name: true } },
      position: { select: { name: true, code: true } },
      account: { select: { email: true } },
    },
  });

  if (!emp) notFound();

  const empExtra = emp as Employee & {
    socialInsuranceNumber?: string | null;
    citizenIdNumber?: string | null;
    personalEmail?: string | null;
  };

  const detail: EmployeeDetail = {
    id: emp.id,
    code: emp.code,
    fullName: emp.fullName,
    employmentType: emp.employmentType,
    departmentName: emp.department?.name ?? null,
    positionName: emp.position?.name ?? null,
    positionCode: emp.position?.code ?? null,
    accountEmail: emp.account?.email ?? null,
    phone: emp.phone ?? null,
    personalEmail: empExtra.personalEmail ?? null,
    gender: emp.gender ?? null,
    dob: emp.dob ?? null,
    address: emp.address ?? null,
    socialInsuranceNumber: empExtra.socialInsuranceNumber ?? null,
    citizenIdNumber: empExtra.citizenIdNumber ?? null,
    avatarUrl: emp.avatarUrl ?? null,
    joinedAt: emp.joinedAt ?? null,
    resignedAt: emp.resignedAt ?? null,
    createdAt: emp.createdAt,
    updatedAt: emp.updatedAt,
    isActive: emp.isActive,
    salary: emp.salary ?? null,
  };

  const typeLabel = detail.employmentType === "TV" ? "Thời vụ" : "Chính thức";
  const statusLabel = detail.isActive ? "Đang làm" : "Đã nghỉ";
  const genderLabel = formatGender(detail.gender);

  return (
    <div className="space-y-5 w-full">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <p className="text-sm text-slate-500">Thông tin nhân viên</p>
          <h1 className="text-2xl font-semibold text-slate-900">{detail.fullName}</h1>
          <p className="text-sm text-slate-500">Mã: {detail.code}</p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href={`/nhan-vien/${detail.id}/edit`}
            className="px-3 py-2 text-sm font-semibold rounded-md border border-blue-200 text-blue-700 hover:bg-blue-50 transition"
          >
            Chỉnh sửa
          </Link>
          <Link
            href="/nhan-vien"
            className="px-3 py-2 text-sm font-semibold rounded-md border border-slate-200 text-slate-700 hover:bg-slate-50 transition"
          >
            ← Quay lại danh sách
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_3fr] xl:grid-cols-[1.2fr_2.8fr] gap-5">
        <div className="bg-white border border-slate-200 rounded-lg p-6 space-y-4 h-full">
          <div className="w-full h-64 sm:h-72 bg-slate-50 border border-slate-200 rounded-lg flex items-center justify-center overflow-hidden">
            {detail.avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={detail.avatarUrl} alt={detail.fullName} className="h-full w-full object-cover" />
            ) : (
              <span className="text-slate-400 text-sm">Chưa có ảnh</span>
            )}
          </div>

          <div className="space-y-2 text-sm text-slate-700">
            <div className="flex justify-between">
              <span className="text-slate-500">Họ và tên</span>
              <span className="font-semibold">{detail.fullName}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Chức vụ</span>
              <span className="font-semibold">{detail.positionName ?? "—"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Bộ phận</span>
              <span className="font-semibold">{detail.departmentName ?? "—"}</span>
            </div>
            {/* <div className="flex justify-between">
              <span className="text-slate-500">Mã vạch</span>
              <span className="font-semibold">{detail.code}</span>
            </div> */}
            <div className="flex justify-between">
              <span className="text-slate-500">Loại</span>
              <span className="font-semibold">{typeLabel}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Trạng thái</span>
              <span className="font-semibold">{statusLabel}</span>
            </div>
          </div>

          <div className="pt-2">
            <Barcode value={detail.code} />
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-lg p-6 md:p-8 h-full flex flex-col">
          <h2 className="text-base font-semibold text-slate-900 mb-4">Chi tiết nhân viên</h2>
          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4 text-sm flex-1">
            <div>
              <dt className="text-slate-500">Email tài khoản</dt>
              <dd className="font-semibold text-slate-900">{detail.accountEmail ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Email liên hệ</dt>
              <dd className="font-semibold text-slate-900">{detail.personalEmail ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-slate-500">BHXH</dt>
              <dd className="font-semibold text-slate-900">{detail.socialInsuranceNumber ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Điện thoại</dt>
              <dd className="font-semibold text-slate-900">{detail.phone ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Giới tính</dt>
              <dd className="font-semibold text-slate-900">{genderLabel}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Lương cơ bản</dt>
              <dd className="font-semibold text-slate-900">
                {detail.salary !== null
                  ? `${new Intl.NumberFormat("vi-VN").format(detail.salary)} VND`
                  : "—"}
              </dd>
            </div>
            <div>
              <dt className="text-slate-500">CCCD/CMND</dt>
              <dd className="font-semibold text-slate-900">{detail.citizenIdNumber ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Ngày sinh</dt>
              <dd className="font-semibold text-slate-900">{formatDate(detail.dob)}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Ngày vào làm</dt>
              <dd className="font-semibold text-slate-900">{formatDate(detail.joinedAt)}</dd>
            </div>
            {!detail.isActive && (
              <div>
                <dt className="text-slate-500">Ngày nghỉ</dt>
                <dd className="font-semibold text-slate-900">{formatDate(detail.resignedAt)}</dd>
              </div>
            )}
            <div className="sm:col-span-2">
              <dt className="text-slate-500">Địa chỉ</dt>
              <dd className="font-semibold text-slate-900">{detail.address ?? "—"}</dd>
            </div>
            <div className="sm:col-span-2 flex justify-between text-xs text-slate-500 pt-2">
              <span>Được tạo: {formatDate(detail.createdAt)}</span>
              <span>Cập nhật: {formatDate(detail.updatedAt)}</span>
            </div>
          </dl>
        </div>
      </div>
    </div>
  );
}
