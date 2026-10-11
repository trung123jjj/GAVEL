"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import Header from "@/components/header";
import Footer from "@/components/footer";
import { api } from "@/lib/api";

type NotificationItem = {
  id: number;
  type: "outbid" | "won" | "auction_closed" | "system";
  title: string;
  message: string;
  auctionId: number | null;
  read: boolean;
  createdAt: string;
};

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [markingRead, setMarkingRead] = useState(false);

  useEffect(() => {
    let active = true;
    api.getNotifications()
      .then((data) => {
        if (!active) return;
        setNotifications(data.notifications as NotificationItem[]);
        setUnreadCount(data.unreadCount as number);
      })
      .catch((err: unknown) => {
        if (active) setError(err instanceof Error ? err.message : "Không thể tải thông báo");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  async function markAllRead() {
    setMarkingRead(true);
    setError("");
    try {
      await api.markNotificationsRead();
      setNotifications((current) => current.map((notification) => ({ ...notification, read: true })));
      setUnreadCount(0);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không thể cập nhật thông báo");
    } finally {
      setMarkingRead(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-zinc-100 dark:bg-zinc-950">
      <Header />
      <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-zinc-800 dark:text-zinc-100">Thông báo</h1>
            <p className="mt-1 text-sm text-zinc-500">{unreadCount} thông báo chưa đọc</p>
          </div>
          {unreadCount > 0 && (
            <button
              onClick={markAllRead}
              disabled={markingRead}
              className="rounded-sm border border-zinc-300 px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-white disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-900"
            >
              {markingRead ? "Đang cập nhật..." : "Đánh dấu tất cả đã đọc"}
            </button>
          )}
        </div>

        {error && <p role="alert" className="mt-4 rounded-sm bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300">{error}</p>}
        {loading ? (
          <p className="py-12 text-center text-zinc-400">Đang tải thông báo...</p>
        ) : notifications.length === 0 ? (
          <p className="mt-6 rounded-sm bg-white p-8 text-center text-sm text-zinc-500 shadow-sm dark:bg-zinc-900">Bạn chưa có thông báo nào.</p>
        ) : (
          <ul className="mt-6 space-y-3">
            {notifications.map((notification) => (
              <li key={notification.id} className={`rounded-sm p-4 shadow-sm ${notification.read ? "bg-white dark:bg-zinc-900" : "border-l-4 border-primary bg-sky-50 dark:bg-sky-950/30"}`}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-zinc-800 dark:text-zinc-100">{notification.title}</p>
                    <p className="mt-1 whitespace-pre-line text-sm leading-6 text-zinc-600 dark:text-zinc-300">{notification.message}</p>
                    <p className="mt-2 text-xs text-zinc-400">{new Date(notification.createdAt).toLocaleString("vi-VN")}</p>
                  </div>
                  {!notification.read && <span className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full bg-primary" aria-label="Chưa đọc" />}
                </div>
                {notification.auctionId && (
                  <Link href={`/auction/${notification.auctionId}`} className="mt-3 inline-block text-sm font-semibold text-primary hover:underline">
                    Xem phiên đấu giá
                  </Link>
                )}
                {(notification.type === "won" || notification.type === "auction_closed" || notification.type === "system") && (
                  <Link href="/orders" className="ml-4 mt-3 inline-block text-sm font-semibold text-primary hover:underline">
                    Xem giao dịch
                  </Link>
                )}
              </li>
            ))}
          </ul>
        )}
      </main>
      <Footer />
    </div>
  );
}
