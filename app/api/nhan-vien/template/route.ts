import * as XLSX from "xlsx";
import { prisma } from "@/lib/prisma";

const TEMPLATE_HEADERS = [
  "STT",
  "Họ và tên",
  "Giới tính",
  "Loại nhân viên",
  "Mã bộ phận",
  "Mã chức vụ",
  "Số điện thoại",
  "Email",
  "Lương cơ bản",
  "Ngày sinh",
  "Địa chỉ",
  "Mã BHXH",
  "CCCD/CMND",
  "Ngày vào làm",
];

function applyHeaderStyle(sheet: XLSX.WorkSheet, columnCount: number) {
  const headerStyle = {
    font: { bold: true, color: { rgb: "FFFFFF" } },
    fill: { fgColor: { rgb: "1D4ED8" } },
    alignment: { horizontal: "center" as const, vertical: "center" as const },
  };
  for (let col = 0; col < columnCount; col += 1) {
    const cellRef = XLSX.utils.encode_cell({ r: 0, c: col });
    const cell = sheet[cellRef];
    if (cell) cell.s = headerStyle;
  }
}

export async function GET() {
  const positions = await prisma.position.findMany({
    select: { code: true, name: true },
    orderBy: { name: "asc" },
  });
  const departments = await prisma.department.findMany({
    select: { code: true, name: true },
    orderBy: { name: "asc" },
  });
  const sampleDepartmentCode = departments[0]?.code ?? "";
  const samplePositionCode = positions[0]?.code ?? "";
  const templateSampleRow = [
    "1",
    "Nguyễn Văn A",
    "Nữ",
    "CT",
    sampleDepartmentCode,
    samplePositionCode,
    "0900000000",
    "nguyenvana@example.com",
    "12000000",
    "1990-01-01",
    "Hà Nội",
    "SI123456789",
    "012345678901",
    "2024-01-01",
  ];

  const workbook = XLSX.utils.book_new();
  const templateSheet = XLSX.utils.aoa_to_sheet([TEMPLATE_HEADERS, templateSampleRow]);
  applyHeaderStyle(templateSheet, TEMPLATE_HEADERS.length);
  XLSX.utils.book_append_sheet(workbook, templateSheet, "Template");

  const guideRows: string[][] = [
    ["Hướng dẫn nhập liệu"],
    ["1. Các cột bắt buộc: Họ và tên, Giới tính, Loại nhân viên, Mã chức vụ, Số điện thoại, Email."],
    ["2. Mã chức vụ phải khớp sheet \"Chức vụ\"; Mã bộ phận (nếu có) phải khớp sheet \"Bộ phận\"."],
    ["3. Loại nhân viên phải khớp sheet \"Loại nhân viên\" (CT hoặc TV)."],
    ["4. Giới tính chỉ nhận: Nam, Nữ."],
    ["5. Ngày tháng theo định dạng giống mẫu (YYYY-MM-DD)."],
    ["6. Lương cơ bản nhập số VND, không âm (vd: 12000000)."],
    ["7. Các trường unique: Mã BHXH, CCCD/CMND, Số điện thoại, Email (trùng sẽ báo lỗi)."],
  ];
  const guideSheet = XLSX.utils.aoa_to_sheet(guideRows);
  applyHeaderStyle(guideSheet, 1);
  XLSX.utils.book_append_sheet(workbook, guideSheet, "Hướng dẫn");

  const positionRows: string[][] = [
    ["STT", "Mã chức vụ", "Tên chức vụ"],
    ...positions.map((position, index) => [String(index + 1), position.code, position.name]),
  ];
  const positionSheet = XLSX.utils.aoa_to_sheet(positionRows);
  applyHeaderStyle(positionSheet, positionRows[0]?.length ?? 0);
  XLSX.utils.book_append_sheet(workbook, positionSheet, "Chức vụ");

  const departmentRows: string[][] = [
    ["STT", "Mã bộ phận", "Tên bộ phận"],
    ...departments.map((department, index) => [String(index + 1), department.code, department.name]),
  ];
  const departmentSheet = XLSX.utils.aoa_to_sheet(departmentRows);
  applyHeaderStyle(departmentSheet, departmentRows[0]?.length ?? 0);
  XLSX.utils.book_append_sheet(workbook, departmentSheet, "Bộ phận");

  const employmentTypeRows: string[][] = [
    ["STT", "Mã loại", "Tên loại"],
    ["1", "CT", "Chính thức"],
    ["2", "TV", "Thời vụ"],
  ];
  const employmentTypeSheet = XLSX.utils.aoa_to_sheet(employmentTypeRows);
  applyHeaderStyle(employmentTypeSheet, employmentTypeRows[0]?.length ?? 0);
  XLSX.utils.book_append_sheet(workbook, employmentTypeSheet, "Loại nhân viên");

  const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });

  return new Response(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="nhan-vien-template.xlsx"',
    },
  });
}
