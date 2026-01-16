import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { generateEmployeeCode } from "@/lib/employee-code";
import type { EmploymentType } from "@/lib/employee-code";
import type { Employee } from "@prisma/client";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  if (!id) return NextResponse.json({ message: "Thiếu id" }, { status: 400 });

  const emp = await prisma.employee.findUnique({
    where: { id },
    include: {
      department: { select: { id: true, name: true } },
      position: { select: { id: true, name: true, code: true } },
      account: { select: { id: true, email: true } },
    },
  });

  if (!emp) {
    return NextResponse.json({ message: "Không tìm thấy nhân viên" }, { status: 404 });
  }

  return NextResponse.json({
    item: {
      id: emp.id,
      code: emp.code,
      fullName: emp.fullName,
      gender: emp.gender,
      dob: emp.dob,
    phone: emp.phone,
    personalEmail: emp.personalEmail,
    address: emp.address,
    socialInsuranceNumber: emp.socialInsuranceNumber,
    citizenIdNumber: emp.citizenIdNumber,
      salary: emp.salary ?? null,
      avatarUrl: emp.avatarUrl,
      employmentType: emp.employmentType as EmploymentType,
      departmentId: emp.departmentId,
      departmentName: emp.department?.name ?? null,
      positionId: emp.positionId,
      positionName: emp.position?.name ?? null,
      positionCode: emp.position?.code ?? null,
      accountEmail: emp.account?.email ?? null,
      isActive: emp.isActive,
      joinedAt: emp.joinedAt,
      resignedAt: emp.resignedAt,
      createdAt: emp.createdAt,
      updatedAt: emp.updatedAt,
    },
  });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  if (!id) return NextResponse.json({ message: "Thiếu id" }, { status: 400 });

  const body = (await request.json()) as {
    fullName?: string;
    departmentId?: string | null;
    positionId?: string | null;
    employmentType?: EmploymentType | string;
    isActive?: boolean;
    accountEmail?: string | null;
    accountPassword?: string | null;
    phone?: string | null;
    personalEmail?: string | null;
    gender?: string | null;
    dob?: string | null;
    address?: string | null;
    socialInsuranceNumber?: string | null;
    citizenIdNumber?: string | null;
    joinedAt?: string | null;
    resignedAt?: string | null;
    avatarUrl?: string | null;
    salary?: number | null;
  };

  const existing = await prisma.employee.findUnique({
    where: { id },
    include: {
      account: { select: { id: true, email: true } },
      department: { select: { id: true, name: true } },
      position: { select: { id: true, name: true, code: true } },
    },
  });
  if (!existing) return NextResponse.json({ message: "Không tìm thấy nhân viên" }, { status: 404 });

  const fullName = body.fullName?.trim() ?? existing.fullName;
  if (!fullName) {
    return NextResponse.json({ message: "Tên nhân viên là bắt buộc" }, { status: 400 });
  }

  const employmentType: EmploymentType =
    body.employmentType === "TV" ? "TV" : (existing.employmentType as EmploymentType);
  const positionId = body.positionId ?? existing.positionId ?? null;
  const departmentId = body.departmentId ?? existing.departmentId ?? null;

  let newCode: string | undefined;
  if (existing.employmentType !== employmentType || existing.positionId !== positionId) {
    newCode = await generateEmployeeCode({
      positionId: positionId ?? undefined,
      employmentType,
    });
  }

  const parseDate = (value?: string | null) => {
    if (!value) return null;
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d;
  };

  const joinedAt = body.joinedAt !== undefined ? parseDate(body.joinedAt) : existing.joinedAt;
  const resignedAt = body.resignedAt !== undefined ? parseDate(body.resignedAt) : existing.resignedAt;

  // Kiểm tra trùng BHXH / CCCD nếu có thay đổi
  if (body.socialInsuranceNumber) {
    const conflict = await prisma.employee.findFirst({
      where: {
        id: { not: id },
        socialInsuranceNumber: body.socialInsuranceNumber,
      },
      select: { id: true },
    });
    if (conflict) {
      return NextResponse.json({ message: "Mã BHXH đã tồn tại cho nhân viên khác" }, { status: 400 });
    }
  }
  if (body.citizenIdNumber) {
    const conflict = await prisma.employee.findFirst({
      where: {
        id: { not: id },
        citizenIdNumber: body.citizenIdNumber,
      },
      select: { id: true },
    });
    if (conflict) {
      return NextResponse.json({ message: "CCCD/CMND đã tồn tại cho nhân viên khác" }, { status: 400 });
    }
  }

  if (body.phone) {
    const conflict = await prisma.employee.findFirst({
      where: {
        id: { not: id },
        phone: body.phone,
      },
      select: { id: true },
    });
    if (conflict) {
      return NextResponse.json({ message: "Số điện thoại đã tồn tại cho nhân viên khác" }, { status: 400 });
    }
  }

  const updated = await prisma.employee.update({
    where: { id },
    data: {
      fullName,
      departmentId,
      positionId,
      employmentType,
      isActive: body.isActive ?? existing.isActive,
      phone: body.phone ?? existing.phone ?? null,
      gender: (body.gender as Employee["gender"]) ?? null,
      dob: body.dob !== undefined ? parseDate(body.dob) : existing.dob,
      address: body.address ?? existing.address ?? null,
      personalEmail: body.personalEmail ?? existing.personalEmail ?? null,
      socialInsuranceNumber: body.socialInsuranceNumber ?? existing.socialInsuranceNumber ?? null,
      citizenIdNumber: body.citizenIdNumber ?? existing.citizenIdNumber ?? null,
      salary:
        body.salary === undefined
          ? existing.salary ?? null
          : typeof body.salary === "number"
            ? Math.max(0, Math.round(body.salary))
            : null,
      joinedAt,
      resignedAt,
      avatarUrl: body.avatarUrl ?? existing.avatarUrl ?? null,
      ...(newCode ? { code: newCode } : {}),
    },
    include: {
      department: { select: { id: true, name: true } },
      position: { select: { id: true, name: true, code: true } },
      account: { select: { id: true, email: true } },
    },
  });

  if (body.accountEmail !== undefined) {
    const email = body.accountEmail?.trim();
    const password = body.accountPassword?.trim();
    const existingByEmail = email
      ? await prisma.account.findUnique({
          where: { email },
          select: { id: true, employeeId: true, roleKey: true, status: true, passwordHash: true },
        })
      : null;

    if (email && existingByEmail && existingByEmail.employeeId && existingByEmail.employeeId !== updated.id) {
      return NextResponse.json(
        { message: "Email đã được dùng cho tài khoản khác" },
        { status: 400 }
      );
    }

    if (email && updated.account) {
      // Đang có tài khoản gắn với nhân viên → cập nhật email (nếu khác)
      if (!existingByEmail || existingByEmail.id === updated.account.id) {
        const data: { email: string; passwordHash?: string } = { email };
        if (password) data.passwordHash = await bcrypt.hash(password, 10);
        await prisma.account.update({ where: { id: updated.account.id }, data });
        updated.account.email = email;
      } else {
        // email thuộc account khác nhưng chưa gắn nhân viên → gán account đó cho nhân viên, bỏ account cũ
        await prisma.account.update({
          where: { id: existingByEmail.id },
          data: { employeeId: updated.id, roleKey: existingByEmail.roleKey ?? "EMPLOYEE" },
        });
        await prisma.account.delete({ where: { id: updated.account.id } });
        updated.account = { id: existingByEmail.id, email };
      }
    } else if (email && !updated.account) {
      if (existingByEmail) {
        await prisma.account.update({
          where: { id: existingByEmail.id },
          data: { employeeId: updated.id, roleKey: existingByEmail.roleKey ?? "EMPLOYEE" },
        });
        updated.account = { id: existingByEmail.id, email };
      } else {
        const createdAccount = await prisma.account.create({
          data: {
            email,
            employeeId: updated.id,
            roleKey: "EMPLOYEE",
            status: "ACTIVE",
            ...(password ? { passwordHash: await bcrypt.hash(password, 10) } : {}),
          },
          select: { id: true, email: true },
        });
        updated.account = createdAccount;
      }
    } else if (!email && updated.account) {
      await prisma.account.update({ where: { id: updated.account.id }, data: { employeeId: null } });
      updated.account = null;
    }
  }

  return NextResponse.json({
    item: {
      id: updated.id,
      code: updated.code,
      fullName: updated.fullName,
      employmentType,
      departmentId: updated.departmentId,
      departmentName: updated.department?.name ?? null,
      positionId: updated.positionId,
      positionName: updated.position?.name ?? null,
      positionCode: updated.position?.code ?? null,
      accountEmail: updated.account?.email ?? null,
      isActive: updated.isActive,
      socialInsuranceNumber: updated.socialInsuranceNumber,
      citizenIdNumber: updated.citizenIdNumber,
      salary: updated.salary ?? null,
      createdAt: updated.createdAt,
    },
  });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  if (!id) return NextResponse.json({ message: "Thiếu id" }, { status: 400 });

  const emp = await prisma.employee.findUnique({
    where: { id },
    select: { account: { select: { id: true } } },
  });
  if (emp?.account) {
    return NextResponse.json(
      { message: "Không thể xoá nhân viên đang gắn tài khoản" },
      { status: 400 }
    );
  }

  await prisma.employee.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
