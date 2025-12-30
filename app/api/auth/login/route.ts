import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";

import { prisma } from "@/lib/prisma";

export async function POST(request: Request) {
  try {
    const { email, password } = (await request.json()) as {
      email?: string;
      password?: string;
    };

    if (!email || !password) {
      return NextResponse.json(
        { success: false, message: "Vui lòng nhập email và mật khẩu." },
        { status: 400 }
      );
    }

    const account = await prisma.account.findUnique({
      where: { email: email.toLowerCase() },
    });

    if (!account || !account.passwordHash) {
      return NextResponse.json(
        { success: false, message: "Email hoặc mật khẩu không đúng." },
        { status: 401 }
      );
    }

    if (account.status !== "ACTIVE") {
      return NextResponse.json(
        { success: false, message: "Tài khoản đã bị vô hiệu hoá." },
        { status: 403 }
      );
    }

    const isValid = await bcrypt.compare(password, account.passwordHash);
    if (!isValid) {
      return NextResponse.json(
        { success: false, message: "Email hoặc mật khẩu không đúng." },
        { status: 401 }
      );
    }

    // Chưa sinh token/session. ReactAuth có thể nhận response này để lưu token phía client.
    const user = {
      id: account.id,
      email: account.email,
      name: account.name,
      roleKey: account.roleKey,
    };

    return NextResponse.json({ success: true, user });
  } catch (err) {
    console.error("Login error", err);
    return NextResponse.json(
      { success: false, message: "Có lỗi xảy ra, thử lại sau." },
      { status: 500 }
    );
  }
}
