import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import EmployeeAttendanceHistoryClient from "./attendance-history-client";

export const dynamic = "force-dynamic";

export default async function EmployeeAttendanceHistoryPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!id) notFound();

  const employee = await prisma.employee.findUnique({
    where: { id },
    select: { id: true, fullName: true, code: true },
  });
  if (!employee) notFound();

  return (
    <div className="space-y-5 w-full">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <p className="text-sm text-slate-500">Lich su cham cong nhan vien</p>
          <h1 className="text-2xl font-semibold text-slate-900">{employee.fullName}</h1>
          <p className="text-sm text-slate-500">Ma: {employee.code}</p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href={`/nhan-vien/${employee.id}`}
            className="px-3 py-2 text-sm font-semibold rounded-md border border-slate-200 text-slate-700 hover:bg-slate-50 transition"
          >
            Quay lai ho so
          </Link>
        </div>
      </div>

      <EmployeeAttendanceHistoryClient
        employee={{
          id: employee.id,
          fullName: employee.fullName,
          code: employee.code,
        }}
      />
    </div>
  );
}
