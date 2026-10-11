"use client";

import Image from "next/image";
import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import Header from "@/components/header";
import Footer from "@/components/footer";
import { ApiError, api } from "@/lib/api";

type AdminAuction = {
  id: number;
  title: string;
  description: string;
  image: string | null;
  currentPrice: number;
  startTime: string;
  endTime: string;
  status: "active" | "pending" | "ended" | "removed";
  bidCount: number;
  seller: { id: number; username: string } | null;
  categories: string[];
  removedAt: string | null;
  removalReason: string | null;
  orderStatus: string | null;
};

type AdminAuctionPage = {
  auctions: AdminAuction[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
};

const statusLabels = {
  active: "Đang diễn ra",
  pending: "Sắp diễn ra",
  ended: "Đã kết thúc",
  removed: "Đã gỡ"
};

const filters = [
  { value: "active", label: "Đang diễn ra" },
  { value: "pending", label: "Sắp diễn ra" },
  { value: "ended", label: "Đã kết thúc" },
  { value: "removed", label: "Đã gỡ" },
  { value: "all", label: "Tất cả" }
];

export default function AdminAuctionsPage() {
  const [authorized, setAuthorized] = useState(false);
  const [checkingAccess, setCheckingAccess] = useState(true);
  const [auctions, setAuctions] = useState<AdminAuction[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState("active");
  const [searchInput, setSearchInput] = useState("");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [removingId, setRemovingId] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let active = true;
    api.me()
      .then((data) => {
        if (active) setAuthorized(data.user.role === "admin");
      })
      .catch((err: unknown) => {
        if (active) setError(err instanceof Error ? err.message : "Không thể xác minh quyền truy cập");
      })
      .finally(() => {
        if (active) setCheckingAccess(false);
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!authorized) return;
    let active = true;
    api.getAdminAuctions({ page, limit: 20, q: query, status })
      .then((data) => {
        if (!active) return;
        const result = data as AdminAuctionPage;
        setAuctions(result.auctions);
        setTotal(result.total);
        setTotalPages(result.totalPages);
        setError("");
      })
      .catch((err: unknown) => {
        if (active) setError(err instanceof ApiError ? err.message : "Không thể tải danh sách sản phẩm");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [authorized, page, query, status, reloadKey]);

  function search(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextQuery = searchInput.trim();
    if (nextQuery === query && page === 1) {
      setLoading(true);
      setReloadKey((current) => current + 1);
      return;
    }
    setPage(1);
    setLoading(true);
    setQuery(nextQuery);
  }

  function changeFilter(nextStatus: string) {
    if (nextStatus === status && page === 1) {
      setLoading(true);
      setReloadKey((current) => current + 1);
      return;
    }
    setStatus(nextStatus);
    setPage(1);
    setLoading(true);
  }

  async function removeAuction(auction: AdminAuction) {
    const reason = window.prompt(`Nhập lý do gỡ sản phẩm "${auction.title}" (bắt buộc):`)?.trim();
    if (!reason) return;
    if (!window.confirm("Sản phẩm sẽ bị ẩn khỏi trang công khai. Lịch sử giá được giữ lại; đơn chưa hoàn tất sẽ bị hủy. Tiếp tục?")) return;

    setRemovingId(auction.id);
    setError("");
    setNotice("");
    try {
      await api.removeAdminAuction(auction.id, reason);
      if (status !== "removed" && status !== "all") {
        setAuctions((current) => current.filter((item) => item.id !== auction.id));
        setTotal((current) => Math.max(0, current - 1));
      } else {
        setAuctions((current) => current.map((item) => item.id === auction.id
          ? { ...item, status: "removed", removedAt: new Date().toISOString(), removalReason: reason, orderStatus: item.orderStatus && item.orderStatus !== "completed" ? "cancelled" : item.orderStatus }
          : item
        ));
      }
      setNotice(`Đã gỡ "${auction.title}". Lịch sử đấu giá được giữ lại.`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Không thể gỡ sản phẩm");
    } finally {
      setRemovingId(null);
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-zinc-100 dark:bg-zinc-950">
      <Header />
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-8">
        <div className="mb-6">
          <p className="text-sm font-medium text-primary">Khu vực quản trị</p>
          <h1 className="mt-1 text-2xl font-bold text-zinc-800 dark:text-zinc-100">Quản lý sản phẩm</h1>
          <div className="mt-4 flex gap-2">
            <Link href="/admin/users" className="rounded-sm border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-600 hover:bg-white dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900">Tài khoản</Link>
            <Link href="/admin/auctions" className="rounded-sm bg-primary px-4 py-2 text-sm font-semibold text-white">Sản phẩm</Link>
          </div>
        </div>

        {checkingAccess ? (
          <p className="py-12 text-center text-zinc-400">Đang xác minh quyền truy cập...</p>
        ) : !authorized ? (
          <div className="rounded-sm bg-white p-8 text-center shadow-sm dark:bg-zinc-900">
            <p className="font-medium text-zinc-700 dark:text-zinc-200">{error || "Bạn không có quyền truy cập trang quản trị."}</p>
            <Link href="/" className="mt-4 inline-block text-sm font-semibold text-primary hover:underline">Về trang chủ</Link>
          </div>
        ) : (
          <>
            <div className="mb-4 rounded-sm border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
              Khi gỡ sản phẩm, lịch sử đấu giá được giữ để bảo toàn dữ liệu. Đơn chưa hoàn tất sẽ bị hủy; đơn đã hoàn tất không bị thay đổi. Người bán và người đã đặt giá sẽ nhận thông báo kèm lý do.
            </div>
            <form onSubmit={search} className="mb-4 flex flex-col gap-2 rounded-sm bg-white p-4 shadow-sm sm:flex-row dark:bg-zinc-900">
              <input
                value={searchInput}
                onChange={(event) => setSearchInput(event.target.value)}
                placeholder="Tìm theo tên hoặc mô tả sản phẩm"
                className="h-10 flex-1 rounded-sm border border-zinc-300 px-3 text-sm outline-none focus:border-primary dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
              />
              <button type="submit" className="rounded-sm bg-primary px-5 py-2 text-sm font-semibold text-white hover:bg-primary-hover">Tìm kiếm</button>
            </form>

            <div className="mb-4 flex flex-wrap items-center gap-2">
              {filters.map((filter) => (
                <button
                  key={filter.value}
                  onClick={() => changeFilter(filter.value)}
                  className={`rounded-full px-3 py-1.5 text-xs font-semibold ${status === filter.value ? "bg-primary text-white" : "border border-zinc-300 text-zinc-600 hover:bg-white dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900"}`}
                >
                  {filter.label}
                </button>
              ))}
              <span className="ml-auto text-sm text-zinc-500">{total} sản phẩm</span>
            </div>

            {error && (
              <div role="alert" className="mb-4 flex items-center justify-between gap-3 rounded-sm bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300">
                <span>{error}</span>
                <button onClick={() => { setLoading(true); setReloadKey((current) => current + 1); }} className="shrink-0 font-semibold underline">Thử lại</button>
              </div>
            )}
            {notice && <p role="status" className="mb-4 rounded-sm bg-green-50 p-3 text-sm text-green-700 dark:bg-green-950/40 dark:text-green-300">{notice}</p>}

            <div className="overflow-hidden rounded-sm bg-white shadow-sm dark:bg-zinc-900">
              {loading ? (
                <p className="py-12 text-center text-zinc-400">Đang tải sản phẩm...</p>
              ) : auctions.length === 0 ? (
                <p className="py-12 text-center text-sm text-zinc-400">Không có sản phẩm phù hợp.</p>
              ) : (
                <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
                  {auctions.map((auction) => (
                    <article key={auction.id} className="flex flex-col gap-4 p-4 sm:flex-row">
                      <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-sm bg-zinc-100 dark:bg-zinc-800">
                        {auction.image ? <Image src={auction.image} alt={auction.title} fill sizes="96px" className="object-cover" /> : <span className="flex h-full items-center justify-center text-xs text-zinc-400">Không có ảnh</span>}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div>
                            {auction.status === "removed" ? (
                              <h2 className="font-semibold text-zinc-800 dark:text-zinc-100">{auction.title}</h2>
                            ) : (
                              <Link href={`/auction/${auction.id}`} className="font-semibold text-zinc-800 hover:text-primary dark:text-zinc-100">{auction.title}</Link>
                            )}
                            <p className="mt-1 text-xs text-zinc-500">Người bán: {auction.seller?.username || "Không rõ"} · {auction.bidCount} lượt đặt giá · {auction.currentPrice.toLocaleString("vi-VN")}đ</p>
                            <p className="mt-1 line-clamp-2 text-sm text-zinc-500">{auction.description}</p>
                            {auction.categories.length > 0 && <p className="mt-1 text-xs text-zinc-400">Danh mục: {auction.categories.join(", ")}</p>}
                          </div>
                          <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${auction.status === "removed" ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300" : auction.status === "active" ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300" : "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300"}`}>
                            {statusLabels[auction.status]}
                          </span>
                        </div>
                        {auction.status === "removed" && (
                          <p className="mt-2 text-xs text-red-600 dark:text-red-300">Lý do gỡ: {auction.removalReason || "Không có thông tin"}</p>
                        )}
                        {auction.orderStatus && <p className="mt-1 text-xs text-zinc-500">Trạng thái đơn: {auction.orderStatus === "cancelled" ? "Đã hủy" : auction.orderStatus === "completed" ? "Đã hoàn tất" : auction.orderStatus}</p>}
                      </div>
                      {auction.status !== "removed" && (
                        <button
                          onClick={() => void removeAuction(auction)}
                          disabled={removingId === auction.id}
                          className="self-start rounded-sm bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50 sm:self-center"
                        >
                          {removingId === auction.id ? "Đang gỡ..." : "Gỡ sản phẩm"}
                        </button>
                      )}
                    </article>
                  ))}
                </div>
              )}
              <div className="flex items-center justify-between border-t border-zinc-100 px-4 py-3 dark:border-zinc-800">
                <span className="text-xs text-zinc-500">Trang {page} / {Math.max(totalPages, 1)}</span>
                <div className="flex gap-2">
                  <button onClick={() => { setLoading(true); setPage((current) => Math.max(1, current - 1)); }} disabled={page <= 1 || loading} className="rounded-sm border border-zinc-300 px-3 py-1.5 text-sm disabled:opacity-40 dark:border-zinc-700">Trước</button>
                  <button onClick={() => { setLoading(true); setPage((current) => Math.min(totalPages, current + 1)); }} disabled={page >= totalPages || loading} className="rounded-sm border border-zinc-300 px-3 py-1.5 text-sm disabled:opacity-40 dark:border-zinc-700">Sau</button>
                </div>
              </div>
            </div>
          </>
        )}
      </main>
      <Footer />
    </div>
  );
}
