"use client";

import Link from "next/link";
import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { api } from "@/lib/api";

function VerifyEmailContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token") || "";
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!token) return;
    api.verifyEmail(token)
      .then((result) => setMessage(result.message))
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : "Không thể xác minh email");
      });
  }, [token]);

  const invalidToken = !token;
  return (
    <main className="flex min-h-screen items-center justify-center bg-zinc-100 px-4 dark:bg-zinc-950">
      <section className="w-full max-w-md rounded-sm bg-white p-6 text-center shadow-sm dark:bg-zinc-900">
        {invalidToken || error
          ? <p role="alert" className="text-sm text-red-600">{error || "Liên kết xác minh email không hợp lệ"}</p>
          : <p role="status" className="text-sm text-green-700 dark:text-green-400">{message || "Đang xác minh email..."}</p>}
        <Link href="/auth/signin" className="mt-5 inline-block text-sm text-primary hover:underline">Đến trang đăng nhập</Link>
      </section>
    </main>
  );
}

export default function VerifyEmailPage() {
  return <Suspense><VerifyEmailContent /></Suspense>;
}
