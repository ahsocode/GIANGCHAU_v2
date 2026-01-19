import * as XLSX from "xlsx";
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import {
  HEADER_ALIASES,
  REQUIRED_HEADERS,
  formatDate,
  isRowEmpty,
  normalizeHeader,
  parseDateCell,
  sanitizeInputRows,
  validateRows,
  type ImportRowInput,
} from "./utils";

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ message: "Chưa đăng nhập" }, { status: 401 });
  }

  const formData = await request.formData();
  const file = formData.get("file");
  if (!file || !(file instanceof File)) {
    return NextResponse.json({ message: "Vui lòng chọn file Excel" }, { status: 400 });
  }

  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: "array" });
  const templateSheet = workbook.Sheets["Template"] ?? workbook.Sheets[workbook.SheetNames[0]];
  if (!templateSheet) {
    return NextResponse.json({ message: "Không tìm thấy sheet Template" }, { status: 400 });
  }

  const rows = XLSX.utils.sheet_to_json<unknown[]>(templateSheet, { header: 1, blankrows: false, defval: "" });
  if (!rows.length) {
    return NextResponse.json({ message: "File không có dữ liệu" }, { status: 400 });
  }

  const rawHeaders = rows[0] as unknown[];
  const headers = rawHeaders.map(normalizeHeader);
  const headerIndex = new Map<string, number>();
  headers.forEach((header, index) => {
    const mapped = HEADER_ALIASES.get(header);
    if (mapped) headerIndex.set(mapped, index);
  });

  const missingHeaders = REQUIRED_HEADERS.filter((header) => !headerIndex.has(header));
  if (missingHeaders.length > 0) {
    return NextResponse.json(
      { message: `Thiếu cột bắt buộc: ${missingHeaders.join(", ")}` },
      { status: 400 }
    );
  }

  const positions = await prisma.position.findMany({
    select: { id: true, code: true, name: true },
  });
  const departments = await prisma.department.findMany({
    select: { id: true, code: true, name: true },
  });
  const positionByCode = new Map(positions.map((pos) => [pos.code.toUpperCase(), pos]));
  const departmentByCode = new Map(departments.map((dept) => [dept.code.toUpperCase(), dept]));

  let dataRowCount = 0;
  const inputRows: ImportRowInput[] = [];

  for (let i = 1; i < rows.length; i += 1) {
    const row = rows[i] as unknown[];
    if (isRowEmpty(row)) continue;
    dataRowCount += 1;
    const rowNumber = i + 1;
    const getValue = (header: string) => {
      const idx = headerIndex.get(header);
      return idx === undefined ? "" : String(row[idx] ?? "").trim();
    };

    const dob = parseDateCell(row[headerIndex.get("Ngày sinh") ?? -1]);
    const joinedAt = parseDateCell(row[headerIndex.get("Ngày vào làm") ?? -1]);
    inputRows.push({
      rowNumber,
      fullName: getValue("Họ và tên"),
      gender: getValue("Giới tính"),
      employmentType: getValue("Loại nhân viên"),
      departmentCode: getValue("Mã bộ phận"),
      positionCode: getValue("Mã chức vụ"),
      phone: getValue("Số điện thoại"),
      email: getValue("Email"),
      salary: getValue("Lương cơ bản"),
      dob: formatDate(dob),
      address: getValue("Địa chỉ"),
      socialInsuranceNumber: getValue("Mã BHXH"),
      citizenIdNumber: getValue("CCCD/CMND"),
      joinedAt: formatDate(joinedAt),
    });
  }

  if (inputRows.length === 0) {
    return NextResponse.json({ message: "Không có dữ liệu để nhập" }, { status: 400 });
  }

  const sanitizedRows = sanitizeInputRows(inputRows);
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

  const fileImport = await prisma.fileImport.create({
    data: {
      type: "EMPLOYEE_UPLOAD",
      fileName: file.name,
      totalRows: dataRowCount,
      successRows: 0,
      failedRows: errors.length,
      errors: errors.length > 0 ? errors : undefined,
      createdById: session.user.id,
    },
  });

  return NextResponse.json({
    importId: fileImport.id,
    rows: sanitizedRows,
    errors,
  });
}
