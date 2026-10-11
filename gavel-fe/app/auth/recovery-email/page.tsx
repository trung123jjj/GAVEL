"use client";

import Link from "next/link";
import { useState } from "react";
import { api } from "@/lib/api";

export default function RecoveryEmailPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setMessage("");
    setError("");
    setLoading(true);
    try {
      const result = await api.requestRecoveryEmail(email.trim(), password);
      setMessage(result.message);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Không thể cập nhật email");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-zinc-100 px-4 dark:bg-zinc-950">
      <form onSubmit={submit} className="w-full max-w-md rounded-sm bg-white p-6 shadow-sm dark:bg-zinc-900">
        <Link href="/" className="text-sm text-primary hover:underline">← Về trang chủ</Link>
        <h1 className="mt-5 text-xl font-semibold text-zinc-800 dark:text-zinc-100">Email khôi phục</h1>
        <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">Xác nhận mật khẩu hiện tại, sau đó mở email mới để xác minh.</p>
        <label className="mt-5 block text-sm font-medium text-zinc-700 dark:text-zinc-300">Email</label>
        <input required type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} className="mt-1 w-full rounded-sm border border-zinc-200 px-3 py-2.5 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100" />
        <label className="mt-4 block text-sm font-medium text-zinc-700 dark:text-zinc-300">Mật khẩu hiện tại</label>
        <input required type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} className="mt-1 w-full rounded-sm border border-zinc-200 px-3 py-2.5 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100" />
        {error && <p role="alert" className="mt-3 text-sm text-red-600">{error}</p>}
        {message && <p role="status" className="mt-3 text-sm text-green-700 dark:text-green-400">{message}</p>}
        <button type="submit" disabled={loading} className="mt-5 w-full rounded-sm bg-primary py-2.5 text-sm font-semibold text-white hover:bg-primary-hover disabled:opacity-50">
          {loading ? "Đang gửi..." : "Gửi link xác minh"}
        </button>
      </form>
    </main>
  );
}
