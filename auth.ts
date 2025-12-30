import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";

export const {
  handlers: { GET, POST },
  auth,
  signIn,
  signOut,
} = NextAuth({
  session: { strategy: "jwt" },
  pages: {
    signIn: "/dang-nhap",
  },
  secret: process.env.NEXTAUTH_SECRET,
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "text" },
        password: { label: "Password", type: "password" },
      },
      authorize: async (credentials) => {
        const email = credentials?.email?.toString().toLowerCase();
        const password = credentials?.password?.toString() ?? "";
        if (!email || !password) return null;

        const account = await prisma.account.findUnique({
          where: { email },
          select: { id: true, email: true, name: true, roleKey: true, status: true, passwordHash: true },
        });

        if (!account || !account.passwordHash) return null;
        if (account.status !== "ACTIVE") return null;

        const isValid = await bcrypt.compare(password, account.passwordHash);
        if (!isValid) return null;

        return {
          id: account.id,
          email: account.email,
          name: account.name,
          roleKey: account.roleKey,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        const withRole = user as { roleKey?: string };
        token.roleKey = withRole.roleKey;
        token.name = user.name;
      }
      return token;
    },
    async session({ session, token }) {
      session.user = {
        ...session.user,
        id: token.sub ?? "",
        email: token.email ?? "",
        name: token.name,
        roleKey: (token as { roleKey?: string }).roleKey,
      };
      return session;
    },
  },
});
