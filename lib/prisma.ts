import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
  pgPool?: Pool;
};

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) throw new Error("DATABASE_URL bị thiếu");

const isDev = process.env.NODE_ENV !== "production";
const rejectUnauthorized =
  (process.env.PG_SSL_REJECT_UNAUTHORIZED ?? (isDev ? "0" : "1")) === "1";

const pool =
  globalForPrisma.pgPool ??
  new Pool({
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized },
  });

if (isDev) globalForPrisma.pgPool = pool;

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    adapter: new PrismaPg(pool),
    log: ["error", "warn"],
  });

if (isDev) globalForPrisma.prisma = prisma;
