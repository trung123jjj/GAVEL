"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import type { AuctionItem } from "@/types/auction";

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

function StatusBadge({ status }: { status: string }) {
  if (status === "ended")
    return <span className="rounded-sm bg-zinc-200 px-2 py-0.5 text-[11px] font-semibold text-zinc-600 dark:bg-zinc-700 dark:text-zinc-300">Đã kết thúc</span>;
  if (status === "pending")
    return <span className="rounded-sm bg-yellow-100 px-2 py-0.5 text-[11px] font-semibold text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400">Sắp diễn ra</span>;
  return <span className="rounded-sm bg-green-100 px-2 py-0.5 text-[11px] font-semibold text-green-700 dark:bg-green-900/30 dark:text-green-400">Đang diễn ra</span>;
}

export default function AuctionCard({ item }: { item: AuctionItem }) {
  const [timeLeft, setTimeLeft] = useState(getTimeLeft(item.endTime));
  const cardImage = item.image && item.image.trim() ? item.image : "/next.svg";
  const sellerAvatar = item.sellerAvatar && item.sellerAvatar.trim() ? item.sellerAvatar : null;

  useEffect(() => {
    const timer = setInterval(() => setTimeLeft(getTimeLeft(item.endTime)), 1000);
    return () => clearInterval(timer);
  }, [item.endTime]);

  const isUrgent = !timeLeft.expired && item.status === "active" && timeLeft.days === 0 && timeLeft.hours < 3;

  return (
    <Link href={`/auction/${item.id}`} className="group flex flex-col overflow-hidden rounded-sm bg-white shadow-sm transition-shadow hover:shadow-md dark:bg-zinc-900">
      {/* Image */}
      <div className="relative aspect-square overflow-hidden bg-zinc-50 dark:bg-zinc-800">
        <Image
          src={cardImage}
          alt={item.title}
          fill
          sizes="(max-width: 640px) 50vw, 300px"
          className="object-contain p-4 transition-transform duration-300 group-hover:scale-105"
        />
        <div className="absolute left-2 top-2">
          <StatusBadge status={item.status} />
        </div>
        {item.bidCount > 0 && (
          <div className="absolute right-2 top-2 rounded-sm bg-black/60 px-2 py-0.5 text-[11px] text-white">
            {item.bidCount} lượt_bid
          </div>
        )}
      </div>

      {/* Info */}
      <div className="flex flex-1 flex-col gap-1.5 p-3">
        <h3 className="line-clamp-2 text-sm font-medium leading-5 text-zinc-800 group-hover:text-primary dark:text-zinc-200">
          {item.title}
        </h3>

        <p className="flex items-center gap-1.5 text-[12px] text-zinc-400">
          <span className="relative h-4 w-4 shrink-0 overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-700">
            {sellerAvatar ? (
              <Image src={sellerAvatar} alt={item.seller} fill sizes="16px" className="object-cover" />
            ) : (
              <span className="flex h-full w-full items-center justify-center text-[9px] font-bold text-zinc-500">
                {item.seller?.charAt(0)?.toUpperCase()}
              </span>
            )}
          </span>
          {item.seller}
        </p>

        {/* Price */}
        <div className="mt-auto">
          <p className="text-[11px] uppercase text-zinc-400">Giá hiện tại</p>
          <p className="text-lg font-bold text-accent">
            {item.currentPrice.toLocaleString("vi-VN")}đ
          </p>
          <p className="text-[12px] text-zinc-400">
            Khởi điểm: {item.startingPrice.toLocaleString("vi-VN")}đ
          </p>
        </div>

        {/* Countdown */}
        {item.status === "active" && (
          <div className={`flex items-center gap-1 text-[12px] font-medium ${isUrgent ? "text-red-500" : "text-zinc-600 dark:text-zinc-300"}`}>
            <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            {timeLeft.expired ? (
              <span>Đã kết thúc</span>
            ) : (
              <span>
                {timeLeft.days > 0 && `${timeLeft.days}d `}
                {String(timeLeft.hours).padStart(2, "0")}:
                {String(timeLeft.minutes).padStart(2, "0")}:
                {String(timeLeft.seconds).padStart(2, "0")}
              </span>
            )}
          </div>
        )}
        {item.status === "pending" && (
          <p className="text-[12px] text-yellow-600 dark:text-yellow-400">Chưa bắt đầu</p>
        )}
      </div>
    </Link>
  );
}
