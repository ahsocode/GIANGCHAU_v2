import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { sanitizeInputRows, validateRows, type ImportRowInput } from "../utils";

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ message: "Chưa đăng nhập" }, { status: 401 });
  }

  const body = (await request.json()) as { rows?: ImportRowInput[] };
  if (!body?.rows || body.rows.length === 0) {
    return NextResponse.json({ message: "Không có dữ liệu để kiểm tra" }, { status: 400 });
  }

  const positions = await prisma.position.findMany({
    select: { id: true, code: true },
  });
  const departments = await prisma.department.findMany({
    select: { id: true, code: true },
  });
  const positionByCode = new Map(positions.map((pos) => [pos.code.toUpperCase(), pos]));
  const departmentByCode = new Map(departments.map((dept) => [dept.code.toUpperCase(), dept]));

  const sanitizedRows = sanitizeInputRows(body.rows);
  const { parsedRows, errors, phoneSet, emailSet, siSet, cccdSet } = await validateRows({
    rows: sanitizedRows,
    positionByCode,
    departmentByCode,
  });

  const phoneValues = [...phoneSet];
  const emailValues = [...emailSet];
  const siValues = [...siSet];
  const cccdValues = [...cccdSet];

  if (phoneValues.length > 0) {
    const existingPhone = await prisma.employee.findMany({
      where: { phone: { in: phoneValues } },
      select: { phone: true },
    });
    const existingSet = new Set(existingPhone.map((item) => item.phone).filter(Boolean));
    if (existingSet.size > 0) {
      parsedRows.forEach((row) => {
        if (existingSet.has(row.phone)) {
          errors.push({ row: row.rowNumber, messages: ["Số điện thoại trùng trong CSDL"] });
        }
      });
    }
  }

  if (emailValues.length > 0) {
    const [existingPersonal, existingAccounts] = await Promise.all([
      prisma.employee.findMany({
        where: { personalEmail: { in: emailValues } },
        select: { personalEmail: true },
      }),
      prisma.account.findMany({
        where: { email: { in: emailValues } },
        select: { email: true },
      }),
    ]);
    const existingSet = new Set<string>();
    existingPersonal.forEach((item) => item.personalEmail && existingSet.add(item.personalEmail.toLowerCase()));
    existingAccounts.forEach((item) => item.email && existingSet.add(item.email.toLowerCase()));
    if (existingSet.size > 0) {
      parsedRows.forEach((row) => {
        if (existingSet.has(row.email)) {
          errors.push({ row: row.rowNumber, messages: ["Email trùng trong CSDL"] });
        }
      });
    }
  }

  if (siValues.length > 0) {
    const existingSi = await prisma.employee.findMany({
      where: { socialInsuranceNumber: { in: siValues } },
      select: { socialInsuranceNumber: true },
    });
    const existingSet = new Set(existingSi.map((item) => item.socialInsuranceNumber).filter(Boolean));
    if (existingSet.size > 0) {
      parsedRows.forEach((row) => {
        if (row.socialInsuranceNumber && existingSet.has(row.socialInsuranceNumber)) {
          errors.push({ row: row.rowNumber, messages: ["Mã BHXH trùng trong CSDL"] });
        }
      });
    }
  }

  if (cccdValues.length > 0) {
    const existingCccd = await prisma.employee.findMany({
      where: { citizenIdNumber: { in: cccdValues } },
      select: { citizenIdNumber: true },
    });
    const existingSet = new Set(existingCccd.map((item) => item.citizenIdNumber).filter(Boolean));
    if (existingSet.size > 0) {
      parsedRows.forEach((row) => {
        if (row.citizenIdNumber && existingSet.has(row.citizenIdNumber)) {
          errors.push({ row: row.rowNumber, messages: ["CCCD/CMND trùng trong CSDL"] });
        }
      });
    }
  }

  return NextResponse.json({ errors });
}
