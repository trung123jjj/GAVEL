"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import Header from "@/components/header";
import Footer from "@/components/footer";
import { api } from "@/lib/api";
import { getFavorites, toggleFavorite } from "@/lib/favorites";
import type { AuctionItem } from "@/types/auction";

function formatPrice(n: number) {
  return n.toLocaleString("vi-VN");
}

function getTimeLeft(targetTime: string) {
  const diff = new Date(targetTime).getTime() - Date.now();
  if (diff <= 0) return null;
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
  const minutes = Math.floor((diff / (1000 * 60)) % 60);
  const seconds = Math.floor((diff / 1000) % 60);
  return { days, hours, minutes, seconds };
}

function AuctionCard({ item, isWinner, onRemove }: { item: AuctionItem; isWinner?: boolean; onRemove?: (item: AuctionItem) => void }) {
  const [started, setStarted] = useState(item.status !== 'pending');
  const targetTime = started ? item.endTime : item.startTime;
  const [time, setTime] = useState(getTimeLeft(targetTime));

  useEffect(() => {
    const timer = setInterval(() => {
      if (!started && new Date(item.startTime).getTime() <= Date.now()) {
        setStarted(true);
      } else {
        setTime(getTimeLeft(targetTime));
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [started, targetTime, item.startTime]);

  return (
    <div className="flex flex-col overflow-hidden rounded-sm bg-white shadow-sm transition-shadow hover:shadow-md dark:bg-zinc-900">
      <Link href={`/auction/${item.id}`} className="group flex flex-1 flex-col">
      <div className="relative aspect-square overflow-hidden bg-zinc-50 dark:bg-zinc-800">
        <Image src={item.image} alt={item.title} fill sizes="(max-width: 640px) 50vw, 300px" className="object-contain p-4 transition-transform duration-300 group-hover:scale-105" />
        <span className={`absolute left-2 top-2 rounded-sm px-2 py-0.5 text-[11px] font-semibold ${item.status === 'active' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : item.status === 'ended' ? 'bg-zinc-200 text-zinc-600 dark:bg-zinc-700 dark:text-zinc-300' : 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'}`}>
          {item.status === 'active' ? 'Đang diễn ra' : item.status === 'ended' ? 'Đã kết thúc' : 'Sắp diễn ra'}
        </span>
        {isWinner && (
          <span className="absolute right-2 top-2 rounded-sm bg-yellow-400 px-2 py-0.5 text-[10px] font-bold text-yellow-900">
            Winner
          </span>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-1 p-3">
        <h3 className="line-clamp-2 text-sm font-medium leading-5 text-zinc-800 group-hover:text-primary dark:text-zinc-200">
          {item.title}
        </h3>
        <p className="text-lg font-bold text-accent">{formatPrice(item.currentPrice)}đ</p>
        <p className="text-[12px] text-zinc-400">{item.bidCount} lượt đặt giá</p>
        {time && (
          <p className="mt-auto text-[12px] text-zinc-400">
            {started ? 'Còn' : 'Bắt đầu sau'} {time.days > 0 && `${time.days} ngày `}{String(time.hours).padStart(2, "0")}:{String(time.minutes).padStart(2, "0")}:{String(time.seconds).padStart(2, "0")}
          </p>
        )}
      </div>
    </Link>
      {onRemove && (
        <button
          onClick={(e) => { e.preventDefault(); onRemove(item); }}
          className="flex w-full items-center justify-center gap-1 border-t border-zinc-100 py-2 text-[12px] font-medium text-red-500 transition-colors hover:bg-red-50 dark:border-zinc-800 dark:hover:bg-red-900/20"
        >
          <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
          Xóa khỏi danh sách theo dõi
        </button>
      )}
    </div>
  );
}

function Section({ title, count, items, render, emptyMsg }: { title: string; count: number; items: AuctionItem[]; render: (item: AuctionItem) => React.ReactNode; emptyMsg?: string }) {
  return (
    <section>
      <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-zinc-700 dark:text-zinc-300">
        {title}
        <span className="text-[12px] font-normal text-zinc-400">({count})</span>
      </h2>
      {items.length === 0 ? (
        <div className="rounded-sm bg-white py-8 text-center text-sm text-zinc-400 shadow-sm dark:bg-zinc-900">
          {emptyMsg || 'Không có'}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {items.map(render)}
        </div>
      )}
    </section>
  );
}

export default function WatchlistPage() {
  const [upcoming, setUpcoming] = useState<AuctionItem[]>([]);
  const [following, setFollowing] = useState<AuctionItem[]>([]);
  const [won, setWon] = useState<AuctionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [removeTarget, setRemoveTarget] = useState<AuctionItem | null>(null);

  useEffect(() => {
    const favoriteIds = getFavorites();
    const stored = localStorage.getItem("user");
    const currentUser = stored ? JSON.parse(stored) : null;

    if (favoriteIds.length === 0) {
      setLoading(false);
      return;
    }

    api.getAuctions({ limit: 500 })
      .then(async (auctionData: AuctionItem[] | { items: AuctionItem[] }) => {
        const data = Array.isArray(auctionData) ? auctionData : auctionData.items;
        const followed = data.filter((a) => favoriteIds.includes(String(a.id)));

        const upcomingItems: AuctionItem[] = [];
        const followingItems: AuctionItem[] = [];
        const endedItems: AuctionItem[] = [];

        const now = Date.now();

        for (const a of followed) {
          if (a.status === 'active') {
            followingItems.push(a);
          } else if (a.status === 'pending') {
            const startMs = new Date(a.startTime).getTime();
            const diffMin = (startMs - now) / 60000;
            if (diffMin >= 0 && diffMin <= 10) {
              upcomingItems.push(a);
            } else {
              followingItems.push(a);
            }
          } else if (a.status === 'ended') {
            endedItems.push(a);
          }
        }

        // Determine won auctions by fetching details
        const wonItems: AuctionItem[] = [];
        if (currentUser && endedItems.length > 0) {
          const details = await Promise.all(
            endedItems.map((a) => api.getAuction(a.id).catch(() => null))
          );
          for (const d of details) {
            if (d && d.bids && d.bids.length > 0 && d.bids[0].bidderName === currentUser.username) {
              wonItems.push(d);
            }
          }
        }

        // Bid đang theo dõi includes all followed auctions
        const allFollowing = [...upcomingItems, ...followingItems, ...endedItems];
        setUpcoming(upcomingItems);
        setFollowing(allFollowing);
        setWon(wonItems);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const total = upcoming.length + following.length + won.length;

  function handleRemove(item: AuctionItem) {
    setRemoveTarget(item);
  }

  function confirmRemove() {
    if (!removeTarget) return;
    toggleFavorite(removeTarget.id);
    setUpcoming((prev) => prev.filter((a) => String(a.id) !== String(removeTarget.id)));
    setFollowing((prev) => prev.filter((a) => String(a.id) !== String(removeTarget.id)));
    setWon((prev) => prev.filter((a) => String(a.id) !== String(removeTarget.id)));
    setRemoveTarget(null);
  }

  return (
    <div className="flex min-h-screen flex-col bg-zinc-100 dark:bg-zinc-950">
      <Header />

      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6">
        <h1 className="mb-4 text-lg font-semibold text-zinc-800 dark:text-zinc-200">
          Danh sách theo dõi ({total})
        </h1>

        {loading ? (
          <div className="rounded-sm bg-white py-16 text-center text-zinc-400 shadow-sm dark:bg-zinc-900">
            Đang tải...
          </div>
        ) : total === 0 ? (
          <div className="rounded-sm bg-white py-16 text-center shadow-sm dark:bg-zinc-900">
            <svg className="mx-auto h-12 w-12 text-zinc-300 dark:text-zinc-600" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
            </svg>
            <p className="mt-3 text-sm text-zinc-400">
              Chưa có sản phẩm theo dõi nào
            </p>
            <p className="mt-1 text-[13px] text-zinc-400">
              Nhấn vào nút Theo dõi bên cạnh tên sản phẩm để thêm vào danh sách
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-6">
            <Section title="Bid sắp diễn ra" count={upcoming.length} items={upcoming} render={(item) => <AuctionCard key={item.id} item={item} onRemove={handleRemove} />} emptyMsg="Không có bid nào sắp diễn ra" />
            <Section title="Bid đang theo dõi" count={following.length} items={following} render={(item) => <AuctionCard key={item.id} item={item} onRemove={handleRemove} />} emptyMsg="Không có bid nào đang theo dõi" />
            <Section title="Bid đã thắng" count={won.length} items={won} render={(item) => <AuctionCard key={item.id} item={item} isWinner onRemove={handleRemove} />} emptyMsg="Chưa có bid nào thắng" />
          </div>
        )}
      </main>

      {removeTarget && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50" onClick={() => setRemoveTarget(null)}>
          <div className="mx-4 w-full max-w-sm rounded-lg bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold text-zinc-800">Xác nhận xoá</h3>
            <p className="mt-2 text-sm text-zinc-600">
              Bạn có chắc chắn muốn xoá <span className="font-medium text-zinc-800">&ldquo;{removeTarget.title}&rdquo;</span> khỏi danh sách theo dõi?
            </p>
            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => setRemoveTarget(null)}
                className="rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50"
              >
                Huỷ
              </button>
              <button
                onClick={confirmRemove}
                className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-700"
              >
                Xoá
              </button>
            </div>
          </div>
        </div>
      )}

      <Footer />
    </div>
  );
}
