import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import EmployeeBenefitClient from "./benefit-client";

export const dynamic = "force-dynamic";

export default async function EmployeeBenefitPage({
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

  const [benefit, policy] = await Promise.all([
    prisma.employeeBenefit.findUnique({
      where: { employeeId: employee.id },
      select: {
        totalAnnualLeaveDays: true,
        usedAnnualLeaveDays: true,
        usedShiftChangeCount: true,
      },
    }),
    prisma.shiftChangePolicy.findUnique({
      where: { key: "GLOBAL" },
      select: { totalShiftChangeCount: true },
    }),
  ]);

  return (
    <EmployeeBenefitClient
      employee={{ id: employee.id, fullName: employee.fullName, code: employee.code }}
      benefit={{
        totalAnnualLeaveDays: benefit?.totalAnnualLeaveDays ?? 0,
        usedAnnualLeaveDays: benefit?.usedAnnualLeaveDays ?? 0,
        usedShiftChangeCount: benefit?.usedShiftChangeCount ?? 0,
      }}
      totalShiftChangeCount={policy?.totalShiftChangeCount ?? 0}
    />
  );
}
