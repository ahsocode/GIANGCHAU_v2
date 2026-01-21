import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request) {
  const session = await auth();
  const email = session?.user?.email?.toLowerCase();
  if (!email) {
    return NextResponse.json({ message: "Chưa đăng nhập" }, { status: 401 });
  }

  const { currentPassword, nextPassword } = (await request.json()) as {
    currentPassword?: string;
    nextPassword?: string;
  };

  if (!currentPassword || !nextPassword) {
    return NextResponse.json({ message: "Thiếu mật khẩu." }, { status: 400 });
  }

  if (nextPassword.length < 6) {
    return NextResponse.json({ message: "Mật khẩu mới tối thiểu 6 ký tự." }, { status: 400 });
  }

  const account = await prisma.account.findUnique({
    where: { email },
    select: { id: true, passwordHash: true },
  });

  if (!account?.passwordHash) {
    return NextResponse.json({ message: "Tài khoản chưa có mật khẩu." }, { status: 400 });
  }

  const isValid = await bcrypt.compare(currentPassword, account.passwordHash);
  if (!isValid) {
    return NextResponse.json({ message: "Mật khẩu hiện tại không đúng." }, { status: 400 });
  }

  const nextHash = await bcrypt.hash(nextPassword, 10);
  await prisma.account.update({
    where: { id: account.id },
    data: { passwordHash: nextHash },
  });

  return NextResponse.json({ ok: true });
}
