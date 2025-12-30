import type { ReactNode } from "react";
import { Toaster } from "sonner";
import "./globals.css";
import { NextAuthSessionProvider } from "@/components/providers/session-provider";

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="vi">
      <body>
        <NextAuthSessionProvider>
          {children}
          <Toaster position="top-right" richColors />
        </NextAuthSessionProvider>
      </body>
    </html>
  );
}
