import { NextResponse } from "next/server";
import crypto from "crypto";

const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
const apiKey = process.env.CLOUDINARY_API_KEY;
const apiSecret = process.env.CLOUDINARY_API_SECRET;
const defaultFolder = process.env.NEXT_PUBLIC_CLOUDINARY_AVATAR_FOLDER || "employee_avatar";

export async function POST(request: Request) {
  try {
    if (!cloudName || !apiKey || !apiSecret) {
      return NextResponse.json({ message: "Cloudinary env thiếu (cloud name / api key / api secret)" }, { status: 500 });
    }

    const body = (await request.json()) as { publicId?: string; folder?: string };
    const publicId = body.publicId?.trim();
    if (!publicId) {
      return NextResponse.json({ message: "Thiếu publicId" }, { status: 400 });
    }
    const folder = (body.folder ?? defaultFolder).trim();
    const timestamp = Math.floor(Date.now() / 1000);

    const paramsToSign: Record<string, string | number | boolean> = {
      public_id: publicId,
      overwrite: true,
      invalidate: true,
      unique_filename: false,
      timestamp,
    };
    if (folder) paramsToSign.folder = folder;

    const signature = signParams(paramsToSign, apiSecret);

    return NextResponse.json({
      cloudName,
      apiKey,
      timestamp,
      folder,
      publicId,
      signature,
    });
  } catch (error) {
    console.error("Cloudinary sign error:", error);
    return NextResponse.json({ message: "Lỗi ký Cloudinary" }, { status: 500 });
  }
}

function signParams(params: Record<string, string | number | boolean>, secret: string) {
  const sorted = Object.keys(params)
    .sort()
    .map((key) => `${key}=${params[key]}`)
    .join("&");
  const toSign = `${sorted}${secret}`;
  return crypto.createHash("sha1").update(toSign).digest("hex");
}
