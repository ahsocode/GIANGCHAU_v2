import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ message: "Chưa đăng nhập" }, { status: 401 });
  }

  const account = await prisma.account.findUnique({
    where: { email: session.user.email.toLowerCase() },
    include: {
      employee: {
        include: {
          department: { select: { name: true } },
          position: { select: { name: true, code: true } },
        },
      },
    },
  });

  if (!account) {
    return NextResponse.json({ message: "Không tìm thấy tài khoản" }, { status: 404 });
  }

  const emp = account.employee;

  return NextResponse.json({
    item: {
      account: {
        id: account.id,
        email: account.email,
        roleKey: account.roleKey,
        status: account.status,
        name: account.name,
      },
      employee: emp
        ? {
            id: emp.id,
            code: emp.code,
            fullName: emp.fullName,
            departmentName: emp.department?.name ?? null,
            positionName: emp.position?.name ?? null,
            positionCode: emp.position?.code ?? null,
            phone: emp.phone,
            personalEmail: (emp as { personalEmail?: string | null }).personalEmail ?? null,
            gender: emp.gender,
            dob: emp.dob,
            address: emp.address,
            socialInsuranceNumber: (emp as { socialInsuranceNumber?: string | null }).socialInsuranceNumber ?? null,
            citizenIdNumber: (emp as { citizenIdNumber?: string | null }).citizenIdNumber ?? null,
            avatarUrl: emp.avatarUrl ?? null,
            joinedAt: emp.joinedAt,
            resignedAt: emp.resignedAt,
            employmentType: emp.employmentType,
            salary: emp.salary ?? null,
            createdAt: emp.createdAt,
            updatedAt: emp.updatedAt,
            isActive: emp.isActive,
          }
        : null,
    },
  });
}

export async function PATCH(request: Request) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ message: "Chưa đăng nhập" }, { status: 401 });
  }

  const body = (await request.json()) as {
    personalEmail?: string | null;
    dob?: string | null;
    address?: string | null;
    gender?: string | null;
    phone?: string | null;
    socialInsuranceNumber?: string | null;
    citizenIdNumber?: string | null;
  };

  if (body.phone || body.socialInsuranceNumber || body.citizenIdNumber) {
    return NextResponse.json(
      { message: "Số điện thoại / CCCD / BHXH cần gửi yêu cầu để cập nhật" },
      { status: 400 }
    );
  }

  const employee = await prisma.employee.findFirst({
    where: { account: { email: session.user.email.toLowerCase() } },
    include: {
      department: { select: { name: true } },
      position: { select: { name: true, code: true } },
      account: { select: { email: true, id: true } },
    },
  });

  if (!employee) {
    return NextResponse.json({ message: "Không tìm thấy nhân viên" }, { status: 404 });
  }

  if (body.gender && !["MALE", "FEMALE", "OTHER"].includes(body.gender)) {
    return NextResponse.json({ message: "Giới tính không hợp lệ." }, { status: 400 });
  }

  const updateData: {
    personalEmail?: string | null;
    dob?: Date | null;
    address?: string | null;
    gender?: "MALE" | "FEMALE" | "OTHER" | null;
  } = {};

  if ("personalEmail" in body) updateData.personalEmail = body.personalEmail ?? null;
  if ("dob" in body) updateData.dob = body.dob ? new Date(body.dob) : null;
  if ("address" in body) updateData.address = body.address ?? null;
  if ("gender" in body) {
    updateData.gender = body.gender ? (body.gender as "MALE" | "FEMALE" | "OTHER") : null;
  }

  const updated = await prisma.employee.update({
    where: { id: employee.id },
    data: updateData,
    include: {
      department: { select: { name: true } },
      position: { select: { name: true, code: true } },
      account: { select: { email: true, id: true } },
    },
  });

  return NextResponse.json({
    item: {
      id: updated.id,
      code: updated.code,
      fullName: updated.fullName,
      departmentName: updated.department?.name ?? null,
      positionName: updated.position?.name ?? null,
      positionCode: updated.position?.code ?? null,
      phone: updated.phone,
      personalEmail: updated.personalEmail ?? null,
      gender: updated.gender,
      dob: updated.dob,
      address: updated.address,
      socialInsuranceNumber: updated.socialInsuranceNumber ?? null,
      citizenIdNumber: updated.citizenIdNumber ?? null,
      avatarUrl: updated.avatarUrl ?? null,
      joinedAt: updated.joinedAt,
      resignedAt: updated.resignedAt,
      employmentType: updated.employmentType,
      salary: updated.salary ?? null,
      createdAt: updated.createdAt,
      updatedAt: updated.updatedAt,
      isActive: updated.isActive,
      accountEmail: updated.account?.email ?? null,
    },
  });
}
