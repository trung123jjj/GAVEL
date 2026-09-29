"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";

export default function SignUpPage() {
  const router = useRouter();
  const [form, setForm] = useState({
    username: "",
    password: "",
    confirmPassword: "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  function validate() {
    const errs: Record<string, string> = {};
    if (!form.username.trim()) errs.username = "Vui lòng nhập tên đăng nhập";
    else if (form.username.trim().length < 3) errs.username = "Tên đăng nhập phải có ít nhất 3 ký tự";
    if (!form.password) errs.password = "Vui lòng nhập mật khẩu";
    else if (form.password.length < 6) errs.password = "Mật khẩu phải có ít nhất 6 ký tự";
    if (!form.confirmPassword) errs.confirmPassword = "Vui lòng xác nhận mật khẩu";
    else if (form.password !== form.confirmPassword) errs.confirmPassword = "Mật khẩu xác nhận không khớp";
    return errs;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const errs = validate();
    setErrors(errs);
    if (Object.keys(errs).length > 0) return;

    setLoading(true);
    try {
      await api.register({
        username: form.username,
        password: form.password,
      });
      router.push("/auth/signin?registered=1");
    } catch (err: unknown) {
      setErrors({ submit: err instanceof Error ? err.message : "Đăng ký thất bại" });
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
                Đăng Ký
              </h1>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4 px-6 py-5">
              {/* Tên đăng nhập */}
              <div>
                <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                  Tên đăng nhập
                </label>
                <input
                  type="text"
                  value={form.username}
                  onChange={(e) => handleChange("username", e.target.value)}
                  placeholder="Ít nhất 3 ký tự"
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
                    placeholder="Ít nhất 6 ký tự"
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

              {/* Xác nhận mật khẩu */}
              <div>
                <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                  Xác nhận mật khẩu
                </label>
                <input
                  type={showPassword ? "text" : "password"}
                  value={form.confirmPassword}
                  onChange={(e) => handleChange("confirmPassword", e.target.value)}
                  placeholder="Nhập lại mật khẩu"
                  className={`w-full rounded-sm border px-3 py-2.5 text-sm outline-none transition-colors ${
                    errors.confirmPassword
                      ? "border-red-500 focus:border-red-500"
                      : "border-zinc-200 focus:border-primary dark:border-zinc-700"
                  } dark:bg-zinc-800 dark:text-zinc-100`}
                />
                {errors.confirmPassword && (
                  <p className="mt-1 text-xs text-red-500">{errors.confirmPassword}</p>
                )}
              </div>

              {/* Submit error */}
              {errors.submit && (
                <div className="rounded-sm border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700">
                  {errors.submit}
                </div>
              )}

              {/* Submit */}
              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-sm bg-primary py-2.5 text-sm font-semibold text-white transition-colors hover:bg-primary-hover disabled:opacity-50"
              >
                {loading ? "Đang đăng ký..." : "Đăng Ký"}
              </button>
            </form>

            <div className="border-t border-zinc-100 px-6 py-4 dark:border-zinc-800">
              <p className="text-center text-sm text-zinc-500 dark:text-zinc-400">
                Bạn đã có tài khoản?{" "}
                <Link href="/auth/signin" className="font-medium text-primary hover:underline">
                  Đăng Nhập
                </Link>
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
