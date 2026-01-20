import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { Barcode } from "@/components/ui/barcode";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";

export default async function HoSoPage() {
  const session = await auth();
  if (!session?.user?.email) {
    redirect("/dang-nhap");
  }

  const account = await prisma.account.findUnique({
    where: { email: session.user.email.toLowerCase() },
    include: {
      employee: {
        include: {
          department: { select: { name: true } },
          position: { select: { name: true, code: true } },
        },
      },
    },
  });

  if (!account) {
    return <div className="text-sm text-red-600">Không tìm thấy tài khoản.</div>;
  }

  const emp = account.employee;
  const positionName = emp?.position?.name ?? null;
  const departmentName = emp?.department?.name ?? null;

  return (
    <div className="space-y-5 w-full">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <p className="text-sm text-slate-500">Hồ sơ cá nhân</p>
          <h1 className="text-2xl font-semibold text-slate-900">{emp?.fullName || account.email}</h1>
          {emp?.code && <p className="text-sm text-slate-500">Mã: {emp.code}</p>}
        </div>
        <Button asChild className="rounded-none bg-emerald-500 text-white hover:bg-emerald-600">
          <Link href="/ho-so/chinh-sua">Cập nhật thông tin cá nhân</Link>
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_3fr] xl:grid-cols-[1.2fr_2.8fr] gap-5">
        <div className="bg-white border border-slate-200 rounded-lg p-6 space-y-4 h-full">
          <div className="w-full h-64 sm:h-72 bg-slate-50 border border-slate-200 rounded-lg flex items-center justify-center overflow-hidden">
            {emp?.avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={emp.avatarUrl} alt={emp.fullName ?? account.email} className="h-full w-full object-cover" />
            ) : (
              <span className="text-slate-400 text-sm">Chưa có ảnh</span>
            )}
          </div>

          <div className="space-y-2 text-sm text-slate-700">
            {emp?.fullName && (
              <div className="flex justify-between">
                <span className="text-slate-500">Họ và tên</span>
                <span className="font-semibold">{emp.fullName}</span>
              </div>
            )}
            {positionName && (
              <div className="flex justify-between">
                <span className="text-slate-500">Chức vụ</span>
                <span className="font-semibold">{positionName}</span>
              </div>
            )}
            {departmentName && (
              <div className="flex justify-between">
                <span className="text-slate-500">Bộ phận</span>
                <span className="font-semibold">{departmentName}</span>
              </div>
            )}
            {emp?.code && (
              <div className="flex justify-between">
                <span className="text-slate-500">Mã nhân viên</span>
                <span className="font-semibold">{emp.code}</span>
              </div>
            )}
            {emp && (
              <div className="flex justify-between">
                <span className="text-slate-500">Loại</span>
                <span className="font-semibold">
                  {emp.employmentType === "TV" ? "Thời vụ" : "Chính thức"}
                </span>
              </div>
            )}
          </div>
          {emp?.code && (
            <div className="pt-2">
              <Barcode value={emp.code} />
            </div>
          )}
        </div>

        <div className="bg-white border border-slate-200 rounded-lg p-6 md:p-8 h-full flex flex-col">
          <h2 className="text-base font-semibold text-slate-900 mb-4">Thông tin chi tiết</h2>
          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4 text-sm flex-1">
            <div>
              <dt className="text-slate-500">Lương cơ bản</dt>
              <dd className="font-semibold text-slate-900">
                {emp?.salary !== undefined && emp?.salary !== null
                  ? `${new Intl.NumberFormat("vi-VN").format(emp.salary)} VND`
                  : "—"}
              </dd>
            </div>
            <div>
              <dt className="text-slate-500">Email tài khoản</dt>
              <dd className="font-semibold text-slate-900">{account.email}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Email liên hệ</dt>
              <dd className="font-semibold text-slate-900">{emp?.personalEmail ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Điện thoại</dt>
              <dd className="font-semibold text-slate-900">{emp?.phone ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Giới tính</dt>
              <dd className="font-semibold text-slate-900">
                {emp?.gender === "MALE"
                  ? "Nam"
                  : emp?.gender === "FEMALE"
                    ? "Nữ"
                    : emp?.gender === "OTHER"
                      ? "Khác"
                      : "—"}
              </dd>
            </div>
            <div>
              <dt className="text-slate-500">CCCD/CMND</dt>
              <dd className="font-semibold text-slate-900">{emp?.citizenIdNumber ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-slate-500">BHXH</dt>
              <dd className="font-semibold text-slate-900">{emp?.socialInsuranceNumber ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Ngày sinh</dt>
              <dd className="font-semibold text-slate-900">
                {emp?.dob ? new Intl.DateTimeFormat("vi-VN").format(new Date(emp.dob)) : "—"}
              </dd>
            </div>
            <div>
              <dt className="text-slate-500">Ngày vào làm</dt>
              <dd className="font-semibold text-slate-900">
                {emp?.joinedAt ? new Intl.DateTimeFormat("vi-VN").format(new Date(emp.joinedAt)) : "—"}
              </dd>
            </div>
            {!emp?.isActive && (
              <div>
                <dt className="text-slate-500">Ngày nghỉ</dt>
                <dd className="font-semibold text-slate-900">
                  {emp?.resignedAt ? new Intl.DateTimeFormat("vi-VN").format(new Date(emp.resignedAt)) : "—"}
                </dd>
              </div>
            )}
            <div className="sm:col-span-2">
              <dt className="text-slate-500">Địa chỉ</dt>
              <dd className="font-semibold text-slate-900">{emp?.address ?? "—"}</dd>
            </div>
            <div className="sm:col-span-2 flex justify-between text-xs text-slate-500 pt-2">
              <span>Tạo lúc: {emp?.createdAt ? new Intl.DateTimeFormat("vi-VN").format(new Date(emp.createdAt)) : "—"}</span>
              <span>Cập nhật: {emp?.updatedAt ? new Intl.DateTimeFormat("vi-VN").format(new Date(emp.updatedAt)) : "—"}</span>
            </div>
          </dl>
        </div>
      </div>

    </div>
  );
}
