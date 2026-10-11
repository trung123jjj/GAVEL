"use client";

import { useState, useRef, useEffect } from "react";
import type { AuctionItem } from "@/types/auction";
import AuctionCard from "./auction-card";

export default function AuctionGrid({
  items,
  categories,
}: {
  items: AuctionItem[];
  categories: string[];
}) {
  const [selected, setSelected] = useState("Tất cả");
  const [sortBy, setSortBy] = useState<"endTime" | "price" | "bids">("endTime");
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const filtered = items.filter(
    (item) => selected === "Tất cả" || item.categories.includes(selected)
  );

  const sorted = [...filtered].sort((a, b) => {
    if (sortBy === "endTime") return new Date(a.endTime).getTime() - new Date(b.endTime).getTime();
    if (sortBy === "price") return b.currentPrice - a.currentPrice;
    return b.bidCount - a.bidCount;
  });

  return (
    <div>
      {/* Header + filters */}
      <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-lg font-semibold text-zinc-800 dark:text-zinc-200">
          Sản phẩm đấu giá
        </h2>
        <div className="flex gap-2">
          {/* Category dropdown */}
          <div className="relative" ref={dropdownRef}>
            <button
              onClick={() => setDropdownOpen(!dropdownOpen)}
              className="flex items-center gap-2 rounded-sm border border-zinc-200 bg-white px-3 py-1.5 text-sm text-zinc-700 outline-none hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
            >
              {selected}
              <svg className={`h-4 w-4 transition-transform ${dropdownOpen ? "rotate-180" : ""}`} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            {dropdownOpen && (
              <div className="absolute left-0 z-10 mt-1 w-48 rounded-sm border border-zinc-200 bg-white shadow-md dark:border-zinc-700 dark:bg-zinc-800">
                {categories.map((cat) => (
                  <button
                    key={cat}
                    onClick={() => {
                      setSelected(cat);
                      setDropdownOpen(false);
                    }}
                    className={`block w-full px-3 py-2 text-left text-sm transition-colors ${
                      selected === cat
                        ? "bg-primary/10 font-medium text-primary"
                        : "text-zinc-700 hover:bg-zinc-50 dark:text-zinc-300 dark:hover:bg-zinc-700"
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            )}
          </div>

          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
            className="rounded-sm border border-zinc-200 bg-white px-3 py-1.5 text-sm text-zinc-700 outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
          >
            <option value="endTime">Kết thúc sớm nhất</option>
            <option value="price">Giá cao nhất</option>
            <option value="bids">Nhiều lượt đặt giá</option>
          </select>
        </div>
      </div>

      {/* Grid */}
      {sorted.length === 0 ? (
        <div className="rounded-sm bg-white py-16 text-center text-zinc-400 shadow-sm dark:bg-zinc-900">
          Không có sản phẩm nào
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {sorted.map((item) => (
            <AuctionCard key={item.id} item={item} />
          ))}
        </div>
      )}
    </div>
  );
}
