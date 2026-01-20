"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Eye, EyeOff, Mail, Lock, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { signIn } from "next-auth/react";

export default function DangNhapPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);


  const canSubmit = useMemo(() => {
    return email.trim().length > 0 && password.trim().length > 0 && !loading;
  }, [email, password, loading]);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    if (!email || !password) {
      toast.error("Vui lòng nhập đầy đủ email và mật khẩu");
      return;
    }

    try {
      setLoading(true);

      const res = await signIn("credentials", {
        email,
        password,
        redirect: false,
        callbackUrl: "/tong-quan",
      });

      if (!res || res.error) {
        toast.error("Email hoặc mật khẩu không đúng");
        return;
      }

      let redirectUrl = res.url || "/tong-quan";
      try {
        const profileRes = await fetch("/api/ho-so");
        if (profileRes.ok) {
          const profile = (await profileRes.json()) as { item?: { account?: { roleKey?: string } } };
          const roleKey = profile.item?.account?.roleKey;
          if (roleKey === "EMPLOYEE") {
            redirectUrl = "/lich-lam";
          }
        }
      } catch (error) {
        console.error(error);
      }

      toast.success("Đăng nhập thành công");
      router.push(redirectUrl);
    } catch (error) {
      console.error(error);
      toast.error("Không thể kết nối máy chủ. Thử lại sau.");
    } finally {
      setLoading(false);
    }
  }

  function handleGoogleLogin() {
    toast("Đăng nhập Google sẽ làm sau");
  }


  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <div className="flex min-h-screen items-center justify-center px-4 py-8 sm:px-6 lg:px-8">
        <div className="w-full max-w-md">
          <Card className="border border-slate-200 bg-white text-slate-900 shadow-lg">
            <CardHeader className="space-y-1 p-4 pb-2 sm:p-6 sm:pb-2">
              <div className="space-y-1 text-center">
                <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight">Đăng nhập</h2>
                <p className="text-xs sm:text-sm text-slate-500">Tiếp tục quản lý ca làm & chấm công</p>
              </div>
            </CardHeader>

            <CardContent className="p-4 pt-0 sm:p-6 sm:pt-0">
              <form onSubmit={handleSubmit} className="space-y-3 sm:space-y-4">
                {/* Email */}
                <div className="space-y-2">
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <Input
                      type="email"
                      placeholder="Gmail công ty"
                      value={email}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEmail(e.target.value)}
                      className="rounded-none border-slate-200 bg-white pl-10 pr-3 py-2.5 sm:py-3 text-sm sm:text-base shadow-sm transition focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-100"
                      autoComplete="email"
                    />
                  </div>
                </div>

                {/* Password */}
                <div className="space-y-2">
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <Input
                      type={showPass ? "text" : "password"}
                      placeholder="Mật khẩu"
                      value={password}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                        setPassword(e.target.value)
                      }
                      className="rounded-none border-slate-200 bg-white pl-10 pr-12 py-2.5 sm:py-3 text-sm sm:text-base shadow-sm transition focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-100"
                      autoComplete="current-password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPass((v) => !v)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-slate-500 transition hover:bg-slate-100 rounded"
                      aria-label={showPass ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
                    >
                      {showPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                <Button
                  type="submit"
                  className="w-full rounded-none bg-emerald-500 py-2.5 sm:py-3 text-sm sm:text-base font-medium text-white shadow-sm transition hover:bg-emerald-600 hover:shadow-md"
                  disabled={!canSubmit}
                >
                  {loading ? (
                    <span className="inline-flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Đang đăng nhập...
                    </span>
                  ) : (
                    "Đăng nhập"
                  )}
                </Button>
              </form>

              <div className="my-4 sm:my-5">
                <Separator />
              </div>

              <Button
                variant="outline"
                className="w-full rounded-none border-slate-200 bg-white py-2.5 sm:py-3 text-sm sm:text-base text-slate-900 transition hover:bg-slate-50"
                onClick={handleGoogleLogin}
                disabled={loading}
              >
                <svg className="mr-2 h-4 w-4 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
                  <path
                    d="M21.35 11.1h-9.17v2.98h5.27c-.23 1.24-.98 2.29-2.12 2.99v2.48h3.42c2-1.84 3.16-4.55 3.16-7.74 0-.7-.06-1.38-.17-2.03z"
                    fill="currentColor"
                    opacity="0.9"
                  />
                  <path
                    d="M12.18 22c2.86 0 5.26-.94 7.02-2.55l-3.42-2.48c-.95.64-2.16 1.02-3.6 1.02-2.77 0-5.12-1.87-5.96-4.38H2.7v2.56C4.44 19.95 8.04 22 12.18 22z"
                    fill="currentColor"
                    opacity="0.7"
                  />
                  <path
                    d="M6.22 13.63a7.19 7.19 0 0 1 0-3.26V7.81H2.7a10.88 10.88 0 0 0 0 8.38l3.52-2.56z"
                    fill="currentColor"
                    opacity="0.55"
                  />
                  <path
                    d="M12.18 6.02c1.56 0 2.95.54 4.05 1.59l3.04-3.04C17.43 2.86 15.03 2 12.18 2 8.04 2 4.44 4.05 2.7 7.81l3.52 2.56c.84-2.51 3.2-4.35 5.96-4.35z"
                    fill="currentColor"
                    opacity="0.4"
                  />
                </svg>
                <span className="truncate">Đăng nhập bằng Google</span>
              </Button>

              <p className="mt-3 sm:mt-4 text-center text-xs text-slate-500 px-2">
                Bằng việc đăng nhập, bạn đồng ý tuân thủ quy định sử dụng hệ thống nội bộ.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
