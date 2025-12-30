import { NextResponse } from "next/server";

export async function POST() {
  // Chưa có cơ chế session/token để xoá; trả về success để client xử lý state.
  return NextResponse.json({ success: true });
}
