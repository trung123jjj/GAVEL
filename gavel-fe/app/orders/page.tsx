"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import Header from "@/components/header";
import Footer from "@/components/footer";
import { ApiError, api } from "@/lib/api";

type OrderStatus = "pending" | "paid" | "shipped" | "completed" | "cancelled";
type OrderItem = {
  id: number;
  status: OrderStatus;
  amount: number;
  createdAt: string;
  updatedAt: string;
  role: "buyer" | "seller";
  nextStatus: "paid" | "shipped" | "completed" | null;
  otherUser: { id: number; username: string; avatar: string | null } | null;
  auction: { id: number; title: string; image: string | null } | null;
};

const statusLabels: Record<OrderStatus, string> = {
  pending: "Chờ người mua xác nhận thanh toán",
  paid: "Chờ người bán gửi hàng",
  shipped: "Chờ người mua xác nhận nhận hàng",
  completed: "Đã hoàn tất",
  cancelled: "Đã hủy"
};

const actionLabels = {
  paid: "Tôi đã thanh toán bên ngoài",
  shipped: "Xác nhận đã gửi hàng",
  completed: "Tôi đã nhận được hàng"
};

const steps: OrderStatus[] = ["pending", "paid", "shipped", "completed"];

function OrderCard({ order, onUpdated }: { order: OrderItem; onUpdated: (updated: OrderItem) => void }) {
  const [updating, setUpdating] = useState(false);
  const [error, setError] = useState("");
  const currentStep = steps.indexOf(order.status);
  const image = order.auction?.image;

  async function updateStatus() {
    if (!order.nextStatus) return;
    setUpdating(true);
    setError("");
    try {
      const updated = await api.updateOrderStatus(order.id, order.nextStatus) as OrderItem;
      onUpdated(updated);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Không thể cập nhật giao dịch. Vui lòng thử lại.");
    } finally {
      setUpdating(false);
    }
  }

  return (
    <article className="rounded-sm bg-white p-4 shadow-sm dark:bg-zinc-900">
      <div className="flex flex-col gap-4 sm:flex-row">
        <Link href={order.auction ? `/auction/${order.auction.id}` : "/orders"} className="relative h-24 w-24 shrink-0 overflow-hidden rounded-sm bg-zinc-100 dark:bg-zinc-800">
          {image ? (
            <Image src={image} alt={order.auction?.title || "Sản phẩm đấu giá"} fill sizes="96px" className="object-cover" />
          ) : (
            <span className="flex h-full items-center justify-center text-xs text-zinc-400">Không có ảnh</span>
          )}
        </Link>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <p className="text-xs text-zinc-400">Giao dịch #{order.id} · {order.role === "buyer" ? "Bạn là người mua" : "Bạn là người bán"}</p>
              <Link href={order.auction ? `/auction/${order.auction.id}` : "/orders"} className="mt-1 block font-semibold text-zinc-800 hover:text-primary dark:text-zinc-100">
                {order.auction?.title || "Phiên đấu giá"}
              </Link>
            </div>
            <span className="rounded-sm bg-sky-50 px-2.5 py-1 text-xs font-semibold text-sky-700 dark:bg-sky-900/30 dark:text-sky-300">
              {statusLabels[order.status]}
            </span>
          </div>

          <p className="mt-2 text-sm text-zinc-500">
            Giá thắng: <span className="font-bold text-accent">{order.amount.toLocaleString("vi-VN")}đ</span>
            {order.otherUser && (
              <> · {order.role === "buyer" ? "Người bán" : "Người mua"}: <span className="font-medium text-zinc-700 dark:text-zinc-300">{order.otherUser.username}</span></>
            )}
          </p>

          <ol className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4" aria-label="Tiến trình giao dịch">
            {steps.map((step, index) => {
              const done = currentStep >= index;
              return (
                <li key={step} className={`border-t-2 pt-2 text-[11px] ${done ? "border-primary font-medium text-primary" : "border-zinc-200 text-zinc-400 dark:border-zinc-700"}`}>
                  {index + 1}. {statusLabels[step]}
                </li>
              );
            })}
          </ol>

          <div className="mt-4 flex flex-wrap gap-2">
            {order.otherUser && (
              <Link href={`/chat/${order.otherUser.id}`} className="rounded-sm border border-zinc-300 px-3 py-2 text-xs font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800">
                Nhắn tin với {order.otherUser.username}
              </Link>
            )}
            {order.nextStatus && (
              <button
                onClick={updateStatus}
                disabled={updating}
                className="rounded-sm bg-primary px-3 py-2 text-xs font-semibold text-white hover:bg-primary-hover disabled:opacity-50"
              >
                {updating ? "Đang cập nhật..." : actionLabels[order.nextStatus]}
              </button>
            )}
          </div>
          {error && <p role="alert" className="mt-2 text-sm text-red-600">{error}</p>}
        </div>
      </div>
    </article>
  );
}

export default function OrdersPage() {
  const [orders, setOrders] = useState<OrderItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadOrders = useCallback(() => {
    setLoading(true);
    setError("");
    api.getOrders()
      .then((data) => setOrders(data as OrderItem[]))
      .catch((err: unknown) => setError(err instanceof Error ? err.message : "Không thể tải giao dịch"))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    let active = true;
    api.getOrders()
      .then((data) => {
        if (active) setOrders(data as OrderItem[]);
      })
      .catch((err: unknown) => {
        if (active) setError(err instanceof Error ? err.message : "Không thể tải giao dịch");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  function handleUpdated(updated: OrderItem) {
    setOrders((current) => current.map((order) => order.id === updated.id ? updated : order));
  }

  return (
    <div className="flex min-h-screen flex-col bg-zinc-100 dark:bg-zinc-950">
      <Header />
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8">
        <h1 className="text-2xl font-bold text-zinc-800 dark:text-zinc-100">Giao dịch đấu giá</h1>
        <div className="mt-4 rounded-sm border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
          <p className="font-semibold">Thanh toán và giao nhận thực hiện ngoài GAVEL</p>
          <p className="mt-1">GAVEL không thu tiền và không xác minh giao dịch thanh toán. Hãy nhắn tin để tự thống nhất phương thức thanh toán, địa chỉ và vận chuyển. Chỉ xác nhận đã thanh toán sau khi bạn thực sự chuyển tiền; người mua chỉ xác nhận đã nhận hàng sau khi kiểm tra hàng.</p>
        </div>

        {loading ? (
          <p className="py-12 text-center text-zinc-400">Đang tải giao dịch...</p>
        ) : error ? (
          <div className="mt-6 rounded-sm bg-white p-6 text-center text-sm text-red-600 shadow-sm dark:bg-zinc-900">
            {error}
            <button onClick={loadOrders} className="ml-3 font-semibold underline">Thử lại</button>
          </div>
        ) : orders.length === 0 ? (
          <div className="mt-6 rounded-sm bg-white p-8 text-center text-sm text-zinc-500 shadow-sm dark:bg-zinc-900">
            Bạn chưa có giao dịch nào.
          </div>
        ) : (
          <div className="mt-6 space-y-4">
            {orders.map((order) => <OrderCard key={order.id} order={order} onUpdated={handleUpdated} />)}
          </div>
        )}
      </main>
      <Footer />
    </div>
  );
}
