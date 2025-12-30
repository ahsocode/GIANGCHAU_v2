// prisma/seed.ts
import "dotenv/config";
import { prisma } from "../lib/prisma";
import bcrypt from "bcryptjs";

async function main() {
  const adminEmail = "admin@giangchau.local";
  const directorEmail = "director@giangchau.local";
  const password = "123456";

  const passwordHash = await bcrypt.hash(password, 10);

  // ===== ADMIN (ẩn – full quyền) =====
  const admin = await prisma.account.upsert({
    where: { email: adminEmail },
    update: {},
    create: {
      email: adminEmail,
      name: "System Admin",
      roleKey: "ADMIN",
      status: "ACTIVE",
      passwordHash,
    },
  });

  // ===== DIRECTOR =====
  const director = await prisma.account.upsert({
    where: { email: directorEmail },
    update: {},
    create: {
      email: directorEmail,
      name: "Giám đốc",
      roleKey: "DIRECTOR",
      status: "ACTIVE",
      passwordHash,
    },
  });

  console.log("✅ Seed thành công:");
  console.log("ADMIN:", admin.email);
  console.log("DIRECTOR:", director.email);
}

main()
  .catch((e) => {
    console.error("❌ Seed lỗi:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
