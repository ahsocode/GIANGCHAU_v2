import "next-auth";
import "next-auth/jwt";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      email?: string | null;
      name?: string | null;
      roleKey?: string;
    };
  }

  interface User {
    roleKey?: string;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    roleKey?: string;
  }
}
