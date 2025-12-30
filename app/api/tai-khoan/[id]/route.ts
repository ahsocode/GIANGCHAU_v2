import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Prisma, RoleKey } from "@prisma/client";
import bcrypt from "bcryptjs";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  if (!id) return NextResponse.json({ message: "Thiếu id" }, { status: 400 });

  try {
    await prisma.account.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete account error:", error);
    return NextResponse.json({ message: "Xoá tài khoản thất bại" }, { status: 500 });
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  if (!id) return NextResponse.json({ message: "Thiếu id" }, { status: 400 });

  const body = (await request.json()) as {
    status?: "ACTIVE" | "DISABLED";
    roleKey?: string;
    email?: string;
    password?: string;
  };
  const data: Prisma.AccountUpdateInput = {};
  if (body.status) data.status = body.status;
  if (body.roleKey) {
    const roles: RoleKey[] = ["ADMIN", "DIRECTOR", "STAFF", "EMPLOYEE"];
    if (!roles.includes(body.roleKey as RoleKey)) {
      return NextResponse.json({ message: "Quyền không hợp lệ" }, { status: 400 });
    }
    data.roleKey = body.roleKey as RoleKey;
  }
  if (body.email !== undefined) {
    const email = body.email.trim().toLowerCase();
    const conflict = await prisma.account.findUnique({ where: { email }, select: { id: true } });
    if (conflict && conflict.id !== id) {
      return NextResponse.json({ message: "Email đã được sử dụng" }, { status: 400 });
    }
    data.email = email;
  }
  if (body.password) {
    data.passwordHash = await bcrypt.hash(body.password, 10);
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ message: "Không có thay đổi" }, { status: 400 });
  }

  try {
    const updated = await prisma.account.update({
      where: { id },
      data,
      select: { id: true, email: true, status: true, roleKey: true, employeeId: true },
    });
    return NextResponse.json({ item: updated });
  } catch (error) {
    console.error("Update account error:", error);
    return NextResponse.json({ message: "Cập nhật tài khoản thất bại" }, { status: 500 });
  }
}
