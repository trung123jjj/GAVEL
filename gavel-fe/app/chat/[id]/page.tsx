"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import Header from "@/components/header";
import ChatSidebar from "@/components/chat-sidebar";
import { api } from "@/lib/api";
import { getSocket } from "@/lib/socket";
import type { ChatMessage, Conversation, ConversationDetail } from "@/types/chat";

function timeLabel(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  if (d.toDateString() === now.toDateString()) {
    return d.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" });
  }
  return d.toLocaleDateString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function Avatar({ msg }: { msg: ChatMessage }) {
  const avatarSrc = msg.avatar && msg.avatar.trim() ? msg.avatar : null;
  return (
    <span className="h-8 w-8 shrink-0 overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-700">
      {avatarSrc ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={avatarSrc} alt="" className="h-full w-full object-cover" />
      ) : (
        <span className="flex h-full w-full items-center justify-center text-xs font-bold text-zinc-500">
          {msg.senderName.charAt(0).toUpperCase()}
        </span>
      )}
    </span>
  );
}

function Bubble({ msg, mine }: { msg: ChatMessage; mine: boolean }) {
  return (
    <div className={`mb-2 flex items-end gap-2 ${mine ? "justify-end" : "justify-start"}`}>
      {!mine && <Avatar msg={msg} />}
      <div
        className={`max-w-[75%] rounded-2xl px-3 py-2 text-sm shadow-sm ${
          mine
            ? "rounded-br-sm bg-primary text-white"
            : "rounded-bl-sm bg-white text-zinc-800 dark:bg-zinc-800 dark:text-zinc-100"
        }`}
      >
        <p className="break-words whitespace-pre-line">{msg.content}</p>
        <p
          className={`mt-1 text-right text-[10px] ${
            mine ? "text-white/70" : "text-zinc-400"
          }`}
        >
          {timeLabel(msg.createdAt)}
          {mine && <span className="ml-1">{msg.read ? "✓✓" : "✓"}</span>}
        </p>
      </div>
      {mine && <Avatar msg={msg} />}
    </div>
  );
}

export default function ChatDetailPage() {
  const params = useParams();
  const router = useRouter();
  const userId = params.id as string;

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [meId] = useState<number>(() => {
    if (typeof window === "undefined") return 0;
    const stored = localStorage.getItem("user");
    if (!stored) return 0;
    try {
      return Number(JSON.parse(stored).id) || 0;
    } catch {
      return 0;
    }
  });
  const [conv, setConv] = useState<ConversationDetail | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  const loadConversations = useCallback(() => {
    api.getConversations().then(setConversations).catch(console.error);
  }, []);

  useEffect(() => {
    loadConversations();
    api
      .getConversation(userId)
      .then((data: ConversationDetail) => {
        setConv(data);
        setMessages(data.messages);
      })
      .catch((err) => {
        // Phiên hết hạn thì đưa về trang đăng nhập thay vì báo lỗi kỹ thuật.
        if (err instanceof Error && err.message.includes("Chưa đăng nhập")) {
          router.push("/auth/signin");
        } else {
          console.error(err);
        }
      })
      .finally(() => setLoading(false));
  }, [userId, router, loadConversations]);

  // socket events
  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    const convId = conv?.id;

    const handleConnect = () => {
      if (convId) socket.emit("conversation:join", convId);
    };

    const handleMessageNew = (msg: ChatMessage) => {
      if (convId && msg.conversationId === convId) {
        setMessages((prev) =>
          prev.some((m) => String(m.id) === String(msg.id)) ? prev : [...prev, msg]
        );
        if (socket.connected) socket.emit("message:read", convId);
      }
      loadConversations();
    };

    const handleMessageRead = (data: { conversationId: number }) => {
      if (convId && data.conversationId === convId) {
        setMessages((prev) => prev.map((m) => ({ ...m, read: true })));
      }
      loadConversations();
    };

    const handleConvUpdate = () => loadConversations();

    socket.on("connect", handleConnect);
    socket.on("message:new", handleMessageNew);
    socket.on("message:read", handleMessageRead);
    socket.on("conversation:update", handleConvUpdate);

    if (convId) socket.emit("conversation:join", convId);

    return () => {
      socket.off("connect", handleConnect);
      socket.off("message:new", handleMessageNew);
      socket.off("message:read", handleMessageRead);
      socket.off("conversation:update", handleConvUpdate);
    };
  }, [conv?.id, loadConversations]);

  // mark incoming messages as read on load / when new messages arrive
  useEffect(() => {
    if (!conv?.id) return;
    const socket = getSocket();
    if (socket && socket.connected) {
      socket.emit("message:read", conv.id);
    }
  }, [conv?.id, messages.length]);

  // scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, conv?.otherUser?.id]);

  async function handleSend() {
    const content = input.trim();
    if (!content || !conv?.id || sending) return;
    setSending(true);
    setInput("");
    setSendError("");
    const socket = getSocket();
    try {
      if (socket && socket.connected) {
        // Server trả lỗi qua ack (chưa đăng nhập, hết rate limit, không thuộc hội thoại...)
        // nên phải chờ ack rồi mới coi như thành công.
        await new Promise<void>((resolve, reject) => {
          socket.emit(
            "message:send",
            { conversationId: conv!.id, content },
            (ack: { ok: boolean; error?: string } | undefined) => {
              if (ack?.ok) return resolve();
              return reject(new Error(ack?.error || "Gửi tin nhắn thất bại"));
            }
          );
        });
      } else {
        await api.sendMessage(String(conv.id), content);
        const data = await api.getConversation(userId);
        setMessages(data.messages);
      }
    } catch (err) {
      setInput(content);
      setSendError(err instanceof Error ? err.message : "Gửi tin nhắn thất bại");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="flex h-screen flex-col bg-zinc-100 dark:bg-zinc-950">
      <Header />
      <div className="flex min-h-0 flex-1">
        {/* Sidebar */}
        <aside className="hidden w-72 shrink-0 flex-col border-r border-zinc-200 bg-white md:flex dark:border-zinc-800 dark:bg-zinc-900">
          <div className="border-b border-zinc-100 px-4 py-3 dark:border-zinc-800">
            <h2 className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">
              Tin nhắn
            </h2>
          </div>
          <ChatSidebar
            conversations={conversations}
            activeId={conv ? String(conv.id) : undefined}
          />
        </aside>

        {/* Chat window */}
        <section className="flex min-w-0 flex-1 flex-col">
          {/* Header */}
          <div className="flex items-center gap-3 border-b border-zinc-200 bg-white px-4 py-3 dark:border-zinc-800 dark:bg-zinc-900">
            {conv?.otherUser && (
              <Link
                href={`/user/${conv.otherUser.id}`}
                className="flex items-center gap-3 transition-opacity hover:opacity-80"
              >
                <span className="relative h-9 w-9 overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-700">
                  {conv.otherUser.avatar && conv.otherUser.avatar.trim() ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={conv.otherUser.avatar}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <span className="flex h-full w-full items-center justify-center text-sm font-bold text-zinc-500">
                      {conv.otherUser.username.charAt(0).toUpperCase()}
                    </span>
                  )}
                </span>
                <span className="text-sm font-semibold text-zinc-800 dark:text-zinc-100">
                  {conv.otherUser.username}
                </span>
              </Link>
            )}
          </div>

          {/* Messages */}
          <div
            ref={scrollRef}
            className="min-h-0 flex-1 overflow-y-auto px-4 py-4"
          >
            {loading ? (
              <p className="py-10 text-center text-sm text-zinc-400">
                Đang tải...
              </p>
            ) : messages.length === 0 ? (
              <p className="py-10 text-center text-sm text-zinc-400">
                Chưa có tin nhắn nào. Gửi tin nhắn đầu tiên nhé!
              </p>
            ) : (
              messages.map((m) => (
                <Bubble key={m.id} msg={m} mine={m.senderId === meId} />
              ))
            )}
          </div>

          {/* Input */}
          <div className="border-t border-zinc-200 bg-white px-4 py-3 dark:border-zinc-800 dark:bg-zinc-900">
            {sendError && (
              <p className="mb-2 text-xs text-red-600 dark:text-red-400">{sendError}</p>
            )}
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={input}
                onChange={(e) => {
                  setInput(e.target.value);
                  if (sendError) setSendError("");
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleSend();
                }}
                placeholder="Nhập tin nhắn..."
                className="flex-1 rounded-full border border-zinc-200 bg-zinc-50 px-4 py-2.5 text-sm text-zinc-800 outline-none transition-colors focus:border-primary dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
              />
              <button
                onClick={handleSend}
                disabled={sending || !input.trim()}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary text-white transition-colors hover:bg-primary-hover disabled:opacity-50"
              >
                <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
                </svg>
              </button>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
