import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import {
  sanitizeInputRows,
  validateRows,
  type ImportRowInput,
} from "../utils";

function generateEmployeeCode(input: {
  positionCode?: string | null;
  employmentType: "CT" | "TV";
  now: Date;
  seq: number;
}) {
  const { positionCode, employmentType, now, seq } = input;
  const year = now.getFullYear();
  const month = (now.getMonth() + 1).toString().padStart(2, "0");
  const seqStr = seq.toString().padStart(4, "0");
  const typeSuffix = employmentType === "TV" ? "TV" : "CT";
  const codePrefix = positionCode || "NV";

  return `GC${codePrefix}${year}${month}${seqStr}${typeSuffix}`.toUpperCase();
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ message: "Chưa đăng nhập" }, { status: 401 });
  }

  const body = (await request.json()) as {
    importId?: string;
    rows?: ImportRowInput[];
  };

  if (!body?.rows || body.rows.length === 0) {
    return NextResponse.json({ message: "Không có dữ liệu để xác nhận" }, { status: 400 });
  }

  if (body.importId) {
    const existingImport = await prisma.fileImport.findUnique({
      where: { id: body.importId },
      select: { id: true, createdById: true },
    });
    if (!existingImport || existingImport.createdById !== session.user.id) {
      return NextResponse.json({ message: "Không tìm thấy lịch sử upload hợp lệ" }, { status: 400 });
    }
  }

  const positions = await prisma.position.findMany({
    select: { id: true, code: true, name: true },
  });
  const departments = await prisma.department.findMany({
    select: { id: true, code: true, name: true },
  });
  const positionByCode = new Map(positions.map((pos) => [pos.code.toUpperCase(), pos]));
  const departmentByCode = new Map(departments.map((dept) => [dept.code.toUpperCase(), dept]));
  const positionById = new Map(positions.map((pos) => [pos.id, pos]));
  const departmentById = new Map(departments.map((dept) => [dept.id, dept]));

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

  if (errors.length > 0) {
    if (body.importId) {
      await prisma.fileImport.update({
        where: { id: body.importId },
        data: {
          failedRows: errors.length,
          errors,
        },
      });
    }
    return NextResponse.json({ message: "Dữ liệu không hợp lệ", errors }, { status: 400 });
  }

  const now = new Date();
  const monthStart = new Date(Date.UTC(now.getFullYear(), now.getMonth(), 1, 0, 0, 0));
  const monthEnd = new Date(Date.UTC(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999));
  const countInMonth = await prisma.employee.count({
    where: {
      createdAt: {
        gte: monthStart,
        lte: monthEnd,
      },
    },
  });
  let seqCounter = countInMonth + 1;

  const createdItems = await prisma.$transaction(async (tx) => {
    const items = [];
    for (const row of parsedRows) {
      const positionCode = positions.find((pos) => pos.id === row.positionId)?.code ?? "NV";
      const code = generateEmployeeCode({
        positionCode,
        employmentType: row.employmentType,
        now,
        seq: seqCounter,
      });
      seqCounter += 1;
      const created = await tx.employee.create({
        data: {
          code,
          fullName: row.fullName,
          gender: row.gender,
          employmentType: row.employmentType,
          departmentId: row.departmentId,
          positionId: row.positionId,
          phone: row.phone,
          personalEmail: row.email,
          dob: row.dob,
          address: row.address,
          socialInsuranceNumber: row.socialInsuranceNumber,
          citizenIdNumber: row.citizenIdNumber,
          joinedAt: row.joinedAt ?? now,
        },
        select: {
          id: true,
          code: true,
        },
      });
      const position = positionById.get(row.positionId) ?? null;
      const department = row.departmentId ? departmentById.get(row.departmentId) ?? null : null;
      items.push({
        id: created.id,
        code: created.code,
        fullName: row.fullName,
        phone: row.phone,
        email: row.email,
        departmentName: department?.name ?? null,
        positionName: position?.name ?? null,
        positionCode: position?.code ?? null,
        employmentType: row.employmentType,
      });
    }
    return items;
  });

  if (body.importId) {
    await prisma.fileImport.update({
      where: { id: body.importId },
      data: {
        type: "EMPLOYEE",
        totalRows: parsedRows.length,
        successRows: createdItems.length,
        failedRows: 0,
        errors: undefined,
      },
    });
  } else {
    await prisma.fileImport.create({
      data: {
        type: "EMPLOYEE",
        fileName: "nhan-vien-import",
        totalRows: parsedRows.length,
        successRows: createdItems.length,
        failedRows: 0,
        createdById: session.user.id,
      },
    });
  }

  return NextResponse.json({ items: createdItems });
}
