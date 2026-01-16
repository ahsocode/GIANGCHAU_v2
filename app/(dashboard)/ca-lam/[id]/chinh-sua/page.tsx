import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { CaLamForm } from "../../ui/ca-lam-form";

type Params = { id: string };

export default async function ChinhSuaCaLamPage({ params }: { params: Promise<Params> }) {
  const resolvedParams = await params;
  if (!resolvedParams?.id) notFound();
  const shift = await prisma.workShift.findUnique({ where: { id: resolvedParams.id } });
  if (!shift) notFound();

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-semibold">Chỉnh sửa ca làm</h2>
        <p className="text-sm text-muted-foreground">
          Cập nhật thông tin ca làm đang áp dụng.
        </p>
      </div>

      <CaLamForm
        mode="edit"
        shiftId={shift.id}
        initialValues={{
          code: shift.code,
          name: shift.name,
          startTime: shift.startTime,
          endTime: shift.endTime,
          breakMinutes: shift.breakMinutes,
          lateGraceMinutes: shift.lateGraceMinutes,
          earlyGraceMinutes: shift.earlyGraceMinutes,
          overtimeThresholdMinutes: shift.overtimeThresholdMinutes,
          status: shift.status,
        }}
      />
    </div>
  );
}
