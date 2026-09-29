"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { Conversation } from "@/types/chat";

function timeLabel(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  if (d.toDateString() === now.toDateString()) {
    return d.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" });
  }
  const sameYear = d.getFullYear() === now.getFullYear();
  return d.toLocaleDateString(
    "vi-VN",
    sameYear
      ? { day: "2-digit", month: "2-digit" }
      : { day: "2-digit", month: "2-digit", year: "numeric" }
  );
}

export default function ChatSidebar({
  conversations,
  activeId,
}: {
  conversations: Conversation[];
  activeId?: string;
}) {
  const pathname = usePathname();

  return (
    <div className="flex h-full w-full flex-col overflow-y-auto">
      {conversations.length === 0 ? (
        <p className="px-4 py-10 text-center text-sm text-zinc-400">
          Chưa có hội thoại nào
        </p>
      ) : (
        conversations.map((c) => {
          const active =
            String(c.id) === activeId || pathname === `/chat/${c.otherUser.id}`;
          return (
            <Link
              key={c.id}
              href={`/chat/${c.otherUser.id}`}
              className={`flex items-center gap-3 border-b border-zinc-100 px-4 py-3 transition-colors dark:border-zinc-800 ${
                active
                  ? "bg-primary/10"
                  : "hover:bg-zinc-50 dark:hover:bg-zinc-800"
              }`}
            >
              <span className="relative h-10 w-10 shrink-0 overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-700">
                {c.otherUser.avatar ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={c.otherUser.avatar}
                    alt=""
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <span className="flex h-full w-full items-center justify-center text-sm font-bold text-zinc-500">
                    {c.otherUser.username.charAt(0).toUpperCase()}
                  </span>
                )}
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center justify-between gap-2">
                  <span className="truncate text-sm font-medium text-zinc-800 dark:text-zinc-200">
                    {c.otherUser.username}
                  </span>
                  {c.lastMessage && (
                    <span className="shrink-0 text-[11px] text-zinc-400">
                      {timeLabel(c.lastMessage.createdAt)}
                    </span>
                  )}
                </span>
                <span className="flex items-center justify-between gap-2">
                  <span
                    className={`truncate text-[13px] ${
                      c.unreadCount > 0
                        ? "font-semibold text-zinc-800 dark:text-zinc-200"
                        : "text-zinc-400"
                    }`}
                  >
                    {c.lastMessage ? c.lastMessage.content : "Chưa có tin nhắn"}
                  </span>
                  {c.unreadCount > 0 && (
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-accent text-[11px] font-bold text-white">
                      {c.unreadCount}
                    </span>
                  )}
                </span>
              </span>
            </Link>
          );
        })
      )}
    </div>
  );
}
