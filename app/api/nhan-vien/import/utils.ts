import * as XLSX from "xlsx";

export type ImportRowInput = {
  rowNumber: number;
  fullName: string;
  gender: string;
  employmentType: string;
  departmentCode: string;
  positionCode: string;
  phone: string;
  email: string;
  salary: string;
  dob: string;
  address: string;
  socialInsuranceNumber: string;
  citizenIdNumber: string;
  joinedAt: string;
};

export type ParsedRow = {
  rowNumber: number;
  fullName: string;
  gender: "MALE" | "FEMALE";
  employmentType: "CT" | "TV";
  departmentId: string | null;
  positionId: string;
  phone: string;
  email: string;
  salary: number | null;
  dob: Date | null;
  address: string | null;
  socialInsuranceNumber: string | null;
  citizenIdNumber: string | null;
  joinedAt: Date;
};

export type RowError = {
  row: number;
  messages: string[];
};

export const TEMPLATE_HEADERS = [
  "STT",
  "Họ và tên",
  "Giới tính",
  "Loại nhân viên",
  "Mã bộ phận",
  "Mã chức vụ",
  "Số điện thoại",
  "Email",
  "Lương",
  "Ngày sinh",
  "Địa chỉ",
  "Mã BHXH",
  "CCCD/CMND",
  "Ngày vào làm",
];

export const REQUIRED_HEADERS = [
  "Họ và tên",
  "Giới tính",
  "Loại nhân viên",
  "Mã chức vụ",
  "Số điện thoại",
  "Email",
];

export const HEADER_ALIASES = new Map<string, string>([
  ["STT", "STT"],
  ["Họ và tên", "Họ và tên"],
  ["Giới tính", "Giới tính"],
  ["Loại nhân viên", "Loại nhân viên"],
  ["Mã bộ phận", "Mã bộ phận"],
  ["Mã chức vụ", "Mã chức vụ"],
  ["Số điện thoại", "Số điện thoại"],
  ["Email", "Email"],
  ["Lương", "Lương"],
  ["Ngày sinh", "Ngày sinh"],
  ["Địa chỉ", "Địa chỉ"],
  ["Mã BHXH", "Mã BHXH"],
  ["CCCD/CMND", "CCCD/CMND"],
  ["Ngày vào làm", "Ngày vào làm"],
]);

export function normalizeHeader(value: unknown) {
  return String(value ?? "").trim();
}

export function isRowEmpty(row: unknown[]) {
  return row.every((cell) => String(cell ?? "").trim() === "");
}

export function parseDateCell(value: unknown) {
  if (value === null || value === undefined || String(value).trim() === "") return null;
  if (value instanceof Date) return value;
  if (typeof value === "number") {
    const parsed = XLSX.SSF.parse_date_code(value);
    if (!parsed) return null;
    return new Date(Date.UTC(parsed.y, parsed.m - 1, parsed.d));
  }
  const asString = String(value).trim();
  const asDate = new Date(asString);
  if (Number.isNaN(asDate.getTime())) return null;
  return asDate;
}

export function formatDate(value: Date | null) {
  if (!value) return "";
  const year = value.getUTCFullYear();
  const month = String(value.getUTCMonth() + 1).padStart(2, "0");
  const day = String(value.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function parseDateString(value: string) {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
}

function stripDiacritics(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

export function mapGender(input: string) {
  const normalized = stripDiacritics(input.trim().toLowerCase());
  if (normalized === "nam") return "MALE";
  if (normalized === "nu") return "FEMALE";
  return null;
}

export function normalizeGenderLabel(value: string) {
  const normalized = stripDiacritics(value.trim().toLowerCase());
  if (normalized === "nam") return "Nam";
  if (normalized === "nu") return "Nữ";
  return value.trim();
}

export function sanitizeInputRows(rows: ImportRowInput[]) {
  return rows.map((row) => ({
    ...row,
    fullName: row.fullName.trim(),
    gender: normalizeGenderLabel(row.gender),
    employmentType: row.employmentType.trim().toUpperCase(),
    departmentCode: row.departmentCode.trim(),
    positionCode: row.positionCode.trim(),
    phone: row.phone.trim(),
    email: row.email.trim().toLowerCase(),
    salary: row.salary.trim(),
    dob: row.dob.trim(),
    address: row.address.trim(),
    socialInsuranceNumber: row.socialInsuranceNumber.trim(),
    citizenIdNumber: row.citizenIdNumber.trim(),
    joinedAt: row.joinedAt.trim(),
  }));
}

function parseSalary(value: string) {
  if (!value) return null;
  const normalized = value.replace(/,/g, "").replace(/\s+/g, "");
  const parsed = Number(normalized);
  if (Number.isNaN(parsed) || parsed < 0) return null;
  return Math.round(parsed);
}

export async function validateRows(params: {
  rows: ImportRowInput[];
  positionByCode: Map<string, { id: string }>;
  departmentByCode: Map<string, { id: string }>;
}) {
  const { rows, positionByCode, departmentByCode } = params;
  const errors: RowError[] = [];
  const parsedRows: ParsedRow[] = [];

  const phoneSet = new Set<string>();
  const emailSet = new Set<string>();
  const siSet = new Set<string>();
  const cccdSet = new Set<string>();

  for (const row of rows) {
    const rowErrors: string[] = [];
    const fullName = row.fullName.trim();
    if (!fullName) rowErrors.push("Thiếu họ và tên");

    const gender = mapGender(row.gender);
    if (!gender) rowErrors.push("Giới tính chỉ nhận Nam hoặc Nữ");

    const employmentType = row.employmentType.trim().toUpperCase();
    if (employmentType !== "CT" && employmentType !== "TV") {
      rowErrors.push("Loại nhân viên chỉ nhận CT hoặc TV");
    }

    const positionCode = row.positionCode.trim();
    const position = positionCode ? positionByCode.get(positionCode.toUpperCase()) : null;
    if (!positionCode) rowErrors.push("Thiếu mã chức vụ");
    else if (!position) rowErrors.push("Mã chức vụ không tồn tại");

    const departmentCode = row.departmentCode.trim();
    const department = departmentCode ? departmentByCode.get(departmentCode.toUpperCase()) : null;
    if (departmentCode && !department) rowErrors.push("Mã bộ phận không tồn tại");

    const phone = row.phone.trim();
    if (!phone) rowErrors.push("Thiếu số điện thoại");
    else if (phoneSet.has(phone)) rowErrors.push("Số điện thoại trùng trong danh sách");
    else phoneSet.add(phone);

    const email = row.email.trim().toLowerCase();
    if (!email) rowErrors.push("Thiếu email");
    else if (emailSet.has(email)) rowErrors.push("Email trùng trong danh sách");
    else emailSet.add(email);

    const salaryValue = parseSalary(row.salary.trim());
    if (row.salary.trim() && salaryValue === null) {
      rowErrors.push("Lương không hợp lệ");
    }

    const dob = parseDateString(row.dob.trim());
    if (row.dob.trim() && !dob) rowErrors.push("Ngày sinh không hợp lệ");

    const joinedAtParsed = parseDateString(row.joinedAt.trim());
    if (row.joinedAt.trim() && !joinedAtParsed) rowErrors.push("Ngày vào làm không hợp lệ");

    const address = row.address.trim();
    const socialInsuranceNumber = row.socialInsuranceNumber.trim();
    const citizenIdNumber = row.citizenIdNumber.trim();

    if (socialInsuranceNumber) {
      if (siSet.has(socialInsuranceNumber)) rowErrors.push("Mã BHXH trùng trong danh sách");
      else siSet.add(socialInsuranceNumber);
    }
    if (citizenIdNumber) {
      if (cccdSet.has(citizenIdNumber)) rowErrors.push("CCCD/CMND trùng trong danh sách");
      else cccdSet.add(citizenIdNumber);
    }

    if (rowErrors.length > 0) {
      errors.push({ row: row.rowNumber, messages: rowErrors });
      continue;
    }

    parsedRows.push({
      rowNumber: row.rowNumber,
      fullName,
      gender: gender!,
      employmentType: employmentType as "CT" | "TV",
      departmentId: department?.id ?? null,
      positionId: position!.id,
      phone,
      email,
      salary: salaryValue,
      dob,
      address: address || null,
      socialInsuranceNumber: socialInsuranceNumber || null,
      citizenIdNumber: citizenIdNumber || null,
      joinedAt: joinedAtParsed ?? new Date(),
    });
  }

  return { parsedRows, errors, phoneSet, emailSet, siSet, cccdSet };
}
