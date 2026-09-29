"use client";

import Link from "next/link";
import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { api } from "@/lib/api";
import { disconnectSocket, notifySessionChanged } from "@/lib/socket";

function SignInContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const registered = searchParams.get("registered") === "1";
  const [form, setForm] = useState({ username: "", password: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  function validate() {
    const errs: Record<string, string> = {};
    if (!form.username.trim()) errs.username = "Vui lòng nhập tên đăng nhập";
    if (!form.password) errs.password = "Vui lòng nhập mật khẩu";
    return errs;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const errs = validate();
    setErrors(errs);
    if (Object.keys(errs).length > 0) return;

    setLoading(true);
    try {
      const data = await api.login(form.username, form.password);
      // Phiên đăng nhập đã nằm trong cookie httpOnly do backend set.
      // Chỉ cache thông tin hiển thị, không lưu token.
      localStorage.setItem("user", JSON.stringify(data.user));
      disconnectSocket();
      notifySessionChanged();
      router.push("/");
    } catch (err: unknown) {
      setErrors({ username: err instanceof Error ? err.message : "Đăng nhập thất bại" });
    } finally {
      setLoading(false);
    }
  }

  function handleChange(field: string, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: "" }));
  }

  return (
    <div className="flex min-h-screen flex-col bg-zinc-100 dark:bg-zinc-950">
      <header className="bg-primary shadow-md">
        <div className="mx-auto flex h-16 max-w-7xl items-center px-4">
          <Link href="/" className="text-xl font-bold tracking-tight text-white">
            GAVEL
          </Link>
        </div>
      </header>

      <main className="flex flex-1 items-center justify-center px-4 py-10">
        <div className="w-full max-w-md">
          <div className="rounded-sm bg-white shadow-sm dark:bg-zinc-900">
            <div className="border-b border-zinc-100 px-6 py-4 dark:border-zinc-800">
              <h1 className="text-center text-lg font-semibold text-zinc-800 dark:text-zinc-200">
                Đăng Nhập
              </h1>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4 px-6 py-5">
              {registered && (
                <div className="rounded-sm bg-green-50 p-3 text-sm text-green-700 dark:bg-green-900/20 dark:text-green-400">
                  Đăng ký thành công! Vui lòng đăng nhập.
                </div>
              )}
              {/* Tên đăng nhập */}
              <div>
                <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                  Tên đăng nhập
                </label>
                <input
                  type="text"
                  value={form.username}
                  onChange={(e) => handleChange("username", e.target.value)}
                  placeholder="Nhập tên đăng nhập"
                  className={`w-full rounded-sm border px-3 py-2.5 text-sm outline-none transition-colors ${
                    errors.username
                      ? "border-red-500 focus:border-red-500"
                      : "border-zinc-200 focus:border-primary dark:border-zinc-700"
                  } dark:bg-zinc-800 dark:text-zinc-100`}
                />
                {errors.username && <p className="mt-1 text-xs text-red-500">{errors.username}</p>}
              </div>

              {/* Mật khẩu */}
              <div>
                <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                  Mật khẩu
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    value={form.password}
                    onChange={(e) => handleChange("password", e.target.value)}
                    placeholder="Nhập mật khẩu"
                    className={`w-full rounded-sm border px-3 py-2.5 pr-10 text-sm outline-none transition-colors ${
                      errors.password
                        ? "border-red-500 focus:border-red-500"
                        : "border-zinc-200 focus:border-primary dark:border-zinc-700"
                    } dark:bg-zinc-800 dark:text-zinc-100`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600"
                  >
                    {showPassword ? (
                      <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                      </svg>
                    ) : (
                      <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                    )}
                  </button>
                </div>
                {errors.password && <p className="mt-1 text-xs text-red-500">{errors.password}</p>}
              </div>

              {/* Quên mật khẩu */}
              <div className="flex items-center justify-end">
                <a href="#" className="text-sm text-primary hover:underline">
                  Quên mật khẩu?
                </a>
              </div>

              {/* Submit */}
              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-sm bg-primary py-2.5 text-sm font-semibold text-white transition-colors hover:bg-primary-hover disabled:opacity-50"
              >
                {loading ? "Đang đăng nhập..." : "Đăng Nhập"}
              </button>
            </form>

            <div className="border-t border-zinc-100 px-6 py-4 dark:border-zinc-800">
              <p className="text-center text-sm text-zinc-500 dark:text-zinc-400">
                Bạn chưa có tài khoản?{" "}
                <Link href="/auth/signup" className="font-medium text-primary hover:underline">
                  Đăng Ký
                </Link>
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

export default function SignInPage() {
  return (
    <Suspense>
      <SignInContent />
    </Suspense>
  );
}
