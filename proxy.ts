import { NextResponse } from "next/server";
import { auth } from "@/auth";

const employeeAllowedPrefixes = ["/ho-so", "/lich-lam", "/cham-cong", "/tong-hop", "/yeu-cau"];

export default auth(async (request) => {
  const { nextUrl } = request;
  const pathname = nextUrl.pathname;

  if (pathname.startsWith("/dang-nhap") || pathname.startsWith("/unauthorized")) {
    return NextResponse.next();
  }

  const session = request.auth;
  if (!session?.user) {
    return NextResponse.redirect(new URL("/dang-nhap", request.url));
  }

  const roleKey = (session.user as { roleKey?: string }).roleKey;
  if (roleKey === "EMPLOYEE") {
    const allowed = employeeAllowedPrefixes.some(
      (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
    );
    if (!allowed) {
      return NextResponse.redirect(new URL("/unauthorized", request.url));
    }
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
