"use client";

import Link from "next/link";
import { useState } from "react";
import { api } from "@/lib/api";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(action: "reset" | "verify") {
    setMessage("");
    setError("");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError("Vui lòng nhập email hợp lệ");
      return;
    }

    setLoading(true);
    try {
      if (action === "reset") {
        const result = await api.requestPasswordReset(email.trim());
        setMessage(result.message);
      } else {
        const result = await api.resendEmailVerification(email.trim());
        setMessage(result.message);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Không thể xử lý yêu cầu");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-zinc-100 px-4 dark:bg-zinc-950">
      <section className="w-full max-w-md rounded-sm bg-white p-6 shadow-sm dark:bg-zinc-900">
        <Link href="/auth/signin" className="text-sm text-primary hover:underline">← Quay lại đăng nhập</Link>
        <h1 className="mt-5 text-xl font-semibold text-zinc-800 dark:text-zinc-100">Khôi phục mật khẩu</h1>
        <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
          Nhập email đã xác minh trên tài khoản. Chúng tôi sẽ gửi liên kết đặt lại mật khẩu nếu email khớp.
        </p>
        <label htmlFor="recovery-email" className="mt-5 block text-sm font-medium text-zinc-700 dark:text-zinc-300">Email</label>
        <input
          id="recovery-email"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          className="mt-1 w-full rounded-sm border border-zinc-200 px-3 py-2.5 text-sm outline-none focus:border-primary dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
        />
        {error && <p role="alert" className="mt-3 text-sm text-red-600">{error}</p>}
        {message && <p role="status" className="mt-3 text-sm text-green-700 dark:text-green-400">{message}</p>}
        <button
          type="button"
          disabled={loading}
          onClick={() => void submit("reset")}
          className="mt-5 w-full rounded-sm bg-primary py-2.5 text-sm font-semibold text-white hover:bg-primary-hover disabled:opacity-50"
        >
          {loading ? "Đang gửi..." : "Gửi link đặt lại mật khẩu"}
        </button>
        <button
          type="button"
          disabled={loading}
          onClick={() => void submit("verify")}
          className="mt-3 w-full rounded-sm border border-zinc-200 py-2.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
        >
          Gửi lại email xác minh
        </button>
      </section>
    </main>
  );
}
