import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import PersonalEditClient from "../personal-edit-client";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";

export default async function ChinhSuaHoSoPage() {
  const session = await auth();
  if (!session?.user?.email) {
    redirect("/dang-nhap");
  }

  const account = await prisma.account.findUnique({
    where: { email: session.user.email.toLowerCase() },
    include: {
      employee: true,
    },
  });

  if (!account) {
    return <div className="text-sm text-red-600">Không tìm thấy tài khoản.</div>;
  }

  const emp = account.employee;

  return (
    <div className="space-y-5 w-full">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <p className="text-sm text-slate-500">Cập nhật thông tin cá nhân</p>
          <h1 className="text-2xl font-semibold text-slate-900">{emp?.fullName || account.email}</h1>
          {emp?.code && <p className="text-sm text-slate-500">Mã: {emp.code}</p>}
        </div>
        <Button variant="outline" asChild className="rounded-none">
          <Link href="/ho-so">← Quay về hồ sơ</Link>
        </Button>
      </div>

      <PersonalEditForm
        personalEmail={emp?.personalEmail ?? ""}
        dob={emp?.dob ? emp.dob.toISOString().slice(0, 10) : ""}
        address={emp?.address ?? ""}
        phone={emp?.phone ?? ""}
        socialInsuranceNumber={emp?.socialInsuranceNumber ?? ""}
        citizenIdNumber={emp?.citizenIdNumber ?? ""}
        salary={emp?.salary ?? null}
      />
    </div>
  );
}

function PersonalEditForm({
  personalEmail,
  dob,
  address,
  phone,
  socialInsuranceNumber,
  citizenIdNumber,
  salary,
}: {
  personalEmail: string;
  dob: string;
  address: string;
  phone: string;
  socialInsuranceNumber: string;
  citizenIdNumber: string;
  salary: number | null;
}) {
  return (
    <div className="bg-white border border-slate-200 rounded-lg p-6 space-y-4">
      <p className="text-sm text-slate-700">
        Bạn có thể cập nhật Email cá nhân, Ngày sinh, Địa chỉ. Các mục SĐT / CCCD / BHXH cần gửi yêu cầu hỗ trợ để
        thay đổi.
      </p>
      <div className="text-sm text-slate-700">
        Lương cơ bản:{" "}
        <span className="font-semibold text-slate-900">
          {salary !== null ? `${new Intl.NumberFormat("vi-VN").format(salary)} VND` : "—"}
        </span>
      </div>
      <PersonalEditClient
        personalEmail={personalEmail}
        dob={dob}
        address={address}
        phone={phone}
        socialInsuranceNumber={socialInsuranceNumber}
        citizenIdNumber={citizenIdNumber}
      />
    </div>
  );
}
