"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Header from "@/components/header";
import ChatSidebar from "@/components/chat-sidebar";
import { api } from "@/lib/api";
import type { Conversation } from "@/types/chat";

export default function ChatListPage() {
  const router = useRouter();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Không còn token trong localStorage — gọi thẳng API, server sẽ trả 401
    // nếu cookie phiên không còn hiệu lực.
    api
      .getConversations()
      .then(setConversations)
      .catch((err) => {
        if (err instanceof Error && err.message.includes("Chưa đăng nhập")) {
          router.push("/auth/signin");
        } else {
          console.error(err);
        }
      })
      .finally(() => setLoading(false));
  }, [router]);

  return (
    <div className="flex h-screen flex-col bg-zinc-100 dark:bg-zinc-950">
      <Header />
      <div className="flex min-h-0 flex-1">
        <aside className="flex w-full flex-col border-r border-zinc-200 bg-white md:w-72 md:shrink-0 dark:border-zinc-800 dark:bg-zinc-900">
          <div className="border-b border-zinc-100 px-4 py-3 dark:border-zinc-800">
            <h2 className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">
              Tin nhắn
            </h2>
          </div>
          {loading ? (
            <p className="px-4 py-10 text-center text-sm text-zinc-400">
              Đang tải...
            </p>
          ) : (
            <ChatSidebar conversations={conversations} />
          )}
        </aside>
        <section className="hidden flex-1 items-center justify-center text-sm text-zinc-400 md:flex">
          Chọn một hội thoại để bắt đầu nhắn tin
        </section>
      </div>
    </div>
  );
}
