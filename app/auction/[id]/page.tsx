"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import { isFavorite, toggleFavorite } from "@/lib/favorites";
import { joinAuctionRoom, leaveAuctionRoom, onBidNew, onAuctionEnded } from "@/lib/socket";
import type { AuctionItem } from "@/types/auction";
import Header from "@/components/header";
import Footer from "@/components/footer";

function getTimeLeft(endTime: string) {
  const diff = new Date(endTime).getTime() - Date.now();
  if (diff <= 0) return { days: 0, hours: 0, minutes: 0, seconds: 0, expired: true };
  return {
    days: Math.floor(diff / (1000 * 60 * 60 * 24)),
    hours: Math.floor((diff / (1000 * 60 * 60)) % 24),
    minutes: Math.floor((diff / (1000 * 60)) % 60),
    seconds: Math.floor((diff / 1000) % 60),
    expired: false,
  };
}

function formatPrice(n: number) {
  return n.toLocaleString("vi-VN");
}

export default function AuctionDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const [item, setItem] = useState<AuctionItem | null>(null);
  const [endTime, setEndTime] = useState<string>("");
  const [targetTime, setTargetTime] = useState<string>("");
  const [timeLeft, setTimeLeft] = useState({ days: 0, hours: 0, minutes: 0, seconds: 0, expired: true });
  const [bidAmount, setBidAmount] = useState("");
  const [bidError, setBidError] = useState("");
  const [bidSuccess, setBidSuccess] = useState(false);
  const [timeExtended, setTimeExtended] = useState(false);
  const [favorited, setFavorited] = useState(false);
  const [currentImageIdx, setCurrentImageIdx] = useState(0);
  const [loading, setLoading] = useState(true);
  const itemRef = useRef(item);
  itemRef.current = item;

  useEffect(() => {
    params.then((p) => {
      api.getAuction(p.id)
        .then((data) => {
          setItem(data);
          setEndTime(data.endTime);
          setTargetTime(data.status === 'pending' ? data.startTime : data.endTime);
          setBidAmount(String(data.currentPrice + data.minIncrement));
          setTimeLeft(getTimeLeft(data.status === 'pending' ? data.startTime : data.endTime));
          setFavorited(isFavorite(p.id));
        })
        .catch(console.error)
        .finally(() => setLoading(false));
    });
  }, [params]);

  useEffect(() => {
    if (!targetTime) return;
    const timer = setInterval(() => {
      const current = itemRef.current;
      if (current && current.status === 'pending' && new Date(current.startTime).getTime() <= Date.now()) {
        setTargetTime(current.endTime);
        setItem({ ...current, status: 'active' });
      } else {
        setTimeLeft(getTimeLeft(targetTime));
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [targetTime]);

  // Realtime: tham gia room auction_<id>, lắng nghe bid:new và auction:ended
  useEffect(() => {
    let auctionId: string | null = null;
    let offBid = () => {};
    let offEnded = () => {};

    params.then((p) => {
      auctionId = p.id;
      joinAuctionRoom(p.id);

      offBid = onBidNew((payload) => {
        if (!auctionId || payload.auctionId !== Number(auctionId)) return;
        setItem((prev) => {
          if (!prev) return prev;
          const exists = prev.bids.some((b) => b.amount === payload.currentPrice);
          const newBid = {
            id: `live-${payload.createdAt || Date.now()}`,
            bidderName: payload.bidder.username,
            amount: payload.currentPrice,
            time: payload.createdAt,
          };
          const bids = exists ? prev.bids : [newBid, ...prev.bids];
          return { ...prev, currentPrice: payload.currentPrice, bidCount: payload.bidCount, endTime: payload.endTime, bids };
        });
        setEndTime(payload.endTime);
        setTargetTime(payload.endTime);
        setBidAmount(String(payload.currentPrice + (itemRef.current?.minIncrement || 0)));
        if (payload.timeExtended) {
          setTimeExtended(true);
          setTimeout(() => setTimeExtended(false), 3000);
        }
      });

      offEnded = onAuctionEnded((payload) => {
        if (!auctionId || payload.auctionId !== Number(auctionId)) return;
        setItem((prev) => {
          if (!prev) return prev;
          const winnerBid = payload.winner
            ? { id: `winner-${payload.auctionId}`, bidderName: payload.winner.username, amount: payload.finalPrice, time: new Date().toISOString() }
            : null;
          const bids = winnerBid
            ? prev.bids.some((b) => b.bidderName === payload.winner!.username && b.amount === payload.finalPrice)
              ? prev.bids
              : [winnerBid, ...prev.bids]
            : prev.bids;
          return {
            ...prev,
            status: "ended",
            currentPrice: payload.finalPrice || prev.currentPrice,
            endTime: payload.endTime,
            bids,
          };
        });
        setEndTime(payload.endTime);
        setTargetTime(payload.endTime);
        setTimeLeft(getTimeLeft(payload.endTime));
      });
    });

    return () => {
      offBid();
      offEnded();
      if (auctionId) leaveAuctionRoom(auctionId);
    };
  }, [params]);

  if (loading) {
    return (
      <div className="flex min-h-screen flex-col bg-zinc-100 dark:bg-zinc-950">
        <Header />
        <main className="flex flex-1 items-center justify-center">
          <p className="text-zinc-400">Đang tải...</p>
        </main>
        <Footer />
      </div>
    );
  }

  if (!item) {
    return (
      <div className="flex min-h-screen flex-col bg-zinc-100 dark:bg-zinc-950">
        <Header />
        <main className="flex flex-1 items-center justify-center">
          <p className="text-zinc-400">Không tìm thấy sản phẩm</p>
        </main>
        <Footer />
      </div>
    );
  }

  const isActive = item.status === "active" && !timeLeft.expired;
  const minBid = item.currentPrice + item.minIncrement;

  async function handleBid() {
    if (!item) return;
    const val = Number(bidAmount);
    if (!val || val < minBid) {
      setBidError(`Giá phải lớn hơn ${formatPrice(minBid)}đ`);
      setBidSuccess(false);
      return;
    }

    try {
      await api.placeBid(item.id, val);
      setBidError("");
      setBidSuccess(true);

      // Refresh auction data
      const updated = await api.getAuction(item.id);
      setItem(updated);
      setEndTime(updated.endTime);
      setTargetTime(updated.status === 'pending' ? updated.startTime : updated.endTime);
      setBidAmount(String(updated.currentPrice + updated.minIncrement));

      // Anti-sniping visual feedback
      const remainingMs = new Date(endTime).getTime() - Date.now();
      const twoMinutesMs = 2 * 60 * 1000;
      if (remainingMs > 0 && remainingMs < twoMinutesMs) {
        setTimeExtended(true);
        setTimeout(() => setTimeExtended(false), 3000);
      }
    } catch (err: unknown) {
      setBidError(err instanceof Error ? err.message : "Đặt giá thất bại");
      setBidSuccess(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-zinc-100 dark:bg-zinc-950">
      <Header />

      <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-4 px-4 py-6 md:flex-row">
        {/* Left: Image carousel */}
        <div className="md:w-1/2">
          <div className="overflow-hidden rounded-sm bg-white shadow-sm dark:bg-zinc-900">
            <div className="relative aspect-square">
              {(() => {
                const allImages = item.images && item.images.length > 0 ? item.images : (item.image ? [item.image] : ["/next.svg"]);
                const src = allImages[currentImageIdx] || allImages[0];
                return (
                  <>
                    <Image src={src} alt={item.title} fill sizes="(max-width: 768px) 100vw, 50vw" className="object-contain p-8" />
                    {allImages.length > 1 && (
                      <>
                        <button
                          onClick={() => setCurrentImageIdx((prev) => (prev === 0 ? allImages.length - 1 : prev - 1))}
                          className="absolute left-2 top-1/2 -translate-y-1/2 flex h-8 w-8 items-center justify-center rounded-full bg-white/80 text-zinc-700 shadow transition-colors hover:bg-white"
                        >
                          <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                          </svg>
                        </button>
                        <button
                          onClick={() => setCurrentImageIdx((prev) => (prev === allImages.length - 1 ? 0 : prev + 1))}
                          className="absolute right-2 top-1/2 -translate-y-1/2 flex h-8 w-8 items-center justify-center rounded-full bg-white/80 text-zinc-700 shadow transition-colors hover:bg-white"
                        >
                          <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                          </svg>
                        </button>
                      </>
                    )}
                  </>
                );
              })()}
            </div>
            {item.images && item.images.length > 1 && (
              <div className="flex items-center justify-center gap-2 border-t border-zinc-100 px-4 py-3 dark:border-zinc-800">
                {item.images.map((_, i) => (
                  <button
                    key={i}
                    onClick={() => setCurrentImageIdx(i)}
                    className={`h-2 rounded-full transition-all ${i === currentImageIdx ? "w-6 bg-primary" : "w-2 bg-zinc-300 dark:bg-zinc-600"}`}
                  />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right: Info + Bidding */}
        <div className="flex flex-col gap-4 md:w-1/2">
          {/* Title & seller */}
          <div className="rounded-sm bg-white p-5 shadow-sm dark:bg-zinc-900">
            <div className="flex items-center justify-between gap-2">
              <h1 className="text-xl font-bold text-zinc-800 dark:text-zinc-100">{item.title}</h1>
              <button
                onClick={() => setFavorited(toggleFavorite(item.id))}
                className={`shrink-0 rounded-sm border px-3 py-1.5 text-sm font-medium transition-colors ${
                  favorited
                    ? 'border-zinc-200 text-zinc-500 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800'
                    : 'border-red-200 bg-red-50 text-red-600 hover:bg-red-100 dark:border-red-800 dark:bg-red-900/20 dark:text-red-400'
                }`}
              >
                {favorited ? (
                  <span className="flex items-center gap-1.5">
                    <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
                    </svg>
                    Đang theo dõi
                  </span>
                ) : (
                  <span className="flex items-center gap-1.5">
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                    </svg>
                    Theo dõi
                  </span>
                )}
              </button>
            </div>
            <p className="mt-1.5 flex items-center gap-2 text-sm text-zinc-400">
              Đăng bởi
              <Link href={`/user/${item.sellerId}`} className="flex items-center gap-2 hover:opacity-80 transition-opacity">
                <span className="relative h-6 w-6 shrink-0 overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-700">
                  {item.sellerAvatar ? (
                    <Image src={item.sellerAvatar} alt={item.seller} fill sizes="24px" className="object-cover" />
                  ) : (
                    <span className="flex h-full w-full items-center justify-center text-[11px] font-bold text-zinc-500">
                      {item.seller?.charAt(0)?.toUpperCase()}
                    </span>
                  )}
                </span>
                <span className="font-medium text-zinc-600 dark:text-zinc-300">{item.seller}</span>
              </Link>
            </p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {item.categories.map((cat) => (
                <span key={cat} className="rounded-sm bg-sky-100 px-2 py-0.5 text-[11px] font-semibold text-sky-700 dark:bg-sky-900/30 dark:text-sky-400">
                  {cat}
                </span>
              ))}
            </div>
          </div>

          {/* Countdown */}
          <div className="rounded-sm bg-white p-5 shadow-sm dark:bg-zinc-900">
            <p className="mb-2 text-sm font-medium text-zinc-600 dark:text-zinc-300">{item.status === 'pending' ? 'Bắt đầu đấu giá sau' : 'Thời gian còn lại'}</p>
            {timeLeft.expired ? (
              <p className="text-lg font-bold text-zinc-400">Đấu giá đã kết thúc</p>
            ) : (
              <>
                <div className="flex gap-2">
                  {[
                    { val: timeLeft.days, label: "Ngày" },
                    { val: timeLeft.hours, label: "Giờ" },
                    { val: timeLeft.minutes, label: "Phút" },
                    { val: timeLeft.seconds, label: "Giây" },
                  ].map((t) => (
                    <div key={t.label} className="flex flex-col items-center">
                      <span className={`flex h-14 w-14 items-center justify-center rounded-sm text-xl font-bold text-white ${timeExtended ? "bg-accent animate-pulse" : "bg-zinc-800"}`}>
                        {String(t.val).padStart(2, "0")}
                      </span>
                      <span className="mt-1 text-[11px] text-zinc-400">{t.label}</span>
                    </div>
                  ))}
                </div>
                {timeExtended && (
                  <p className="mt-3 flex items-center gap-1.5 text-[13px] font-medium text-accent">
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Đã cộng thêm 2 phút — giá mới cao hơn trong 2 phút cuối!
                  </p>
                )}
                {!timeExtended && timeLeft.days === 0 && timeLeft.hours === 0 && timeLeft.minutes < 2 && (
                  <p className="mt-3 flex items-center gap-1.5 text-[13px] text-amber-600 dark:text-amber-400">
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
                    </svg>
                    Còn dưới 2 phút — giá mới cao hơn sẽ tự động cộng thêm thời gian!
                  </p>
                )}
              </>
            )}
          </div>

          {/* Price info */}
          <div className="rounded-sm bg-white p-5 shadow-sm dark:bg-zinc-900">
            <div className="mb-3">
              <p className="text-[12px] uppercase text-zinc-400">Giá hiện tại</p>
              <p className="text-3xl font-bold text-accent">{formatPrice(item.currentPrice)}đ</p>
            </div>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <p className="text-[12px] text-zinc-400">Giá khởi điểm</p>
                <p className="font-medium text-zinc-700 dark:text-zinc-300">{formatPrice(item.startingPrice)}đ</p>
              </div>
              <div>
                <p className="text-[12px] text-zinc-400">Bước giá tối thiểu</p>
                <p className="font-medium text-zinc-700 dark:text-zinc-300">{formatPrice(item.minIncrement)}đ</p>
              </div>
              <div>
                <p className="text-[12px] text-zinc-400">S lượt đặt giá</p>
                <p className="font-medium text-zinc-700 dark:text-zinc-300">{item.bidCount}</p>
              </div>
              <div>
                <p className="text-[12px] text-zinc-400">Tăng trưởng</p>
                <p className="font-medium text-green-600">
                  +{(((item.currentPrice - item.startingPrice) / item.startingPrice) * 100).toFixed(1)}%
                </p>
              </div>
            </div>
            <hr className="my-3 border-zinc-100 dark:border-zinc-800" />
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <p className="text-[12px] text-zinc-400">Bắt đầu</p>
                <p className="font-medium text-zinc-700 dark:text-zinc-300">
                  {new Date(item.startTime).toLocaleString("vi-VN", {
                    hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit", year: "numeric",
                  })}
                </p>
              </div>
              <div>
                <p className="text-[12px] text-zinc-400">Kết thúc</p>
                <p className="font-medium text-zinc-700 dark:text-zinc-300">
                  {new Date(item.endTime).toLocaleString("vi-VN", {
                    hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit", year: "numeric",
                  })}
                </p>
              </div>
            </div>
          </div>

          {/* Bid form */}
          {isActive && (
            <div className="rounded-sm bg-white p-5 shadow-sm dark:bg-zinc-900">
              <p className="mb-2 text-sm font-medium text-zinc-600 dark:text-zinc-300">Đặt giá của bạn</p>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-zinc-400">đ</span>
                  <input
                    type="number"
                    value={bidAmount}
                    onChange={(e) => { setBidAmount(e.target.value); setBidError(""); setBidSuccess(false); }}
                    min={minBid}
                    step={item.minIncrement}
                    className="w-full rounded-sm border border-zinc-200 py-2.5 pl-7 pr-3 text-sm font-medium outline-none focus:border-primary dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                  />
                </div>
                <button
                  onClick={handleBid}
                  className="shrink-0 rounded-sm bg-accent px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-sky-600"
                >
                  Đặt giá
                </button>
              </div>
              <div className="mt-2 flex items-center gap-3">
                <button
                  onClick={() => { setBidAmount(String(minBid)); setBidError(""); setBidSuccess(false); }}
                  className="rounded-sm border border-zinc-200 px-3 py-1 text-[12px] text-zinc-500 transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-800"
                >
                  Tối thiểu: {formatPrice(minBid)}đ
                </button>
                <button
                  onClick={() => { setBidAmount(String(minBid + item.minIncrement * 5)); setBidError(""); setBidSuccess(false); }}
                  className="rounded-sm border border-zinc-200 px-3 py-1 text-[12px] text-zinc-500 transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-800"
                >
                  +5 bước
                </button>
              </div>
              {bidError && <p className="mt-2 text-sm text-red-500">{bidError}</p>}
              {bidSuccess && <p className="mt-2 text-sm text-green-600">Đặt giá thành công!</p>}
            </div>
          )}

          {!isActive && item.status === "ended" && (
            <div className="rounded-sm bg-zinc-200 p-5 text-center dark:bg-zinc-800">
              <p className="text-sm font-medium text-zinc-500">Đấu giá đã kết thúc</p>
              {item.bids.length > 0 && (
                <p className="mt-1 flex items-center justify-center gap-1.5 text-sm font-semibold text-yellow-700">
                  <span className="rounded-sm bg-yellow-400 px-1.5 py-0.5 text-[10px] font-bold text-yellow-900">Winner</span>
                  {item.bids[0].bidderName} — {formatPrice(item.bids[0].amount)}đ
                </p>
              )}
            </div>
          )}
          {!isActive && item.status === "pending" && (
            <div className="rounded-sm bg-yellow-50 p-5 text-center dark:bg-yellow-900/20">
              <p className="text-sm font-medium text-yellow-700 dark:text-yellow-400">Đấu giá chưa bắt đầu</p>
            </div>
          )}
        </div>
      </main>

      {/* Bid history */}
      <section className="mx-auto w-full max-w-7xl px-4 pb-8">
        <div className="rounded-sm bg-white shadow-sm dark:bg-zinc-900">
          <div className="border-b border-zinc-100 px-5 py-3 dark:border-zinc-800">
            <h3 className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">
              Lịch sử đặt giá ({item.bidCount} lượt)
            </h3>
          </div>
          {item.bids.length === 0 ? (
            <p className="px-5 py-8 text-center text-sm text-zinc-400">Chưa có lượt đặt giá nào</p>
          ) : (
            <div className="max-h-80 overflow-y-auto divide-y divide-zinc-100 dark:divide-zinc-800">
              {item.bids.map((bid, i) => (
                <div key={bid.id} className="flex items-center justify-between px-5 py-3">
                  <div className="flex items-center gap-3">
                    <span className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold text-white ${i === 0 ? "bg-accent" : "bg-zinc-300 dark:bg-zinc-600"}`}>
                      {i + 1}
                    </span>
                    <div>
                      <p className="flex items-center gap-1.5 text-sm font-medium text-zinc-800 dark:text-zinc-200">
                        {bid.bidderName}
                        {item.status === "ended" && i === 0 && (
                          <span className="rounded-sm bg-yellow-400 px-1.5 py-0.5 text-[10px] font-bold text-yellow-900">Winner</span>
                        )}
                      </p>
                      <p className="text-[12px] text-zinc-400">
                        {new Date(bid.time).toLocaleString("vi-VN", { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit" })}
                      </p>
                    </div>
                  </div>
                  <span className={`text-sm font-semibold ${i === 0 ? "text-accent" : "text-zinc-600 dark:text-zinc-300"}`}>
                    {formatPrice(bid.amount)}đ
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Description */}
      <section className="mx-auto w-full max-w-7xl px-4 pb-8">
        <div className="rounded-sm bg-white p-5 shadow-sm dark:bg-zinc-900">
          <h3 className="mb-3 text-sm font-semibold text-zinc-800 dark:text-zinc-200">Mô tả sản phẩm</h3>
          <p className="text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">{item.description}</p>
        </div>
      </section>

      <div className="mt-auto">
        <Footer />
      </div>
    </div>
  );
}
