import type { RoleKey } from "@/lib/rbac";

// DEV ONLY: set role bằng env DEV_ROLE, mặc định DIRECTOR
export async function getCurrentRoleDev(): Promise<RoleKey> {
  const r = process.env.DEV_ROLE as RoleKey | undefined;
  return r ?? "DIRECTOR";
}
