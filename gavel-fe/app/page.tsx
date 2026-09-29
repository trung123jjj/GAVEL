"use client";

import { Suspense, useEffect, useState } from "react";
import Header from "@/components/header";
import Footer from "@/components/footer";
import AuctionGrid from "@/components/auction-grid";
import { api } from "@/lib/api";
import type { AuctionItem } from "@/types/auction";
import { useSearchParams } from "next/navigation";

function HomeContent() {
  const searchParams = useSearchParams();
  const query = searchParams.get("q") || "";
  const [auctions, setAuctions] = useState<AuctionItem[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([api.getAuctions({ limit: 200, sort: "ending_soon" }), api.getCategories()])
      .then(([auctionData, catData]) => {
        const items = (auctionData as { items: AuctionItem[] }).items || auctionData;
        setAuctions(items);
        setCategories(["Tất cả", ...catData.map((c: { name: string }) => c.name)]);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const filtered = query
    ? auctions.filter(
        (a) =>
          a.title.toLowerCase().includes(query.toLowerCase()) ||
          a.description.toLowerCase().includes(query.toLowerCase()) ||
          a.categories.some((c) => c.toLowerCase().includes(query.toLowerCase()))
      )
    : auctions;

  return (
    <div className="flex min-h-screen flex-col bg-zinc-100 dark:bg-zinc-950">
      <Header />

      <main className="flex-1">
        {/* Banner */}
        <section className="mx-auto mt-4 max-w-7xl px-4">
          <div className="overflow-hidden rounded-sm bg-gradient-to-r from-sky-500 to-blue-600 shadow-sm">
            <div className="flex aspect-[3.5/1] items-center justify-center">
              <div className="text-center text-white">
                <h2 className="text-2xl font-bold md:text-4xl">GAVEL - Đấu Giá Trực Tuyến</h2>
                <p className="mt-2 text-sm md:text-lg">Khám phá hàng ngàn sản phẩm đấu giá hấp dẫn</p>
                <a
                  href="#listings"
                  className="mt-4 inline-block rounded-full bg-white px-6 py-2 text-sm font-semibold text-primary transition-colors hover:bg-sky-50"
                >
                  Khám phá ngay
                </a>
              </div>
            </div>
          </div>
        </section>

        {/* Stats */}
        <section className="mx-auto mt-4 max-w-7xl px-4">
          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-sm bg-white p-4 text-center shadow-sm dark:bg-zinc-900">
              <p className="text-2xl font-bold text-accent">
                {auctions.filter((a) => a.status === "active").length}
              </p>
              <p className="text-[13px] text-zinc-500">Đang đấu giá</p>
            </div>
            <div className="rounded-sm bg-white p-4 text-center shadow-sm dark:bg-zinc-900">
              <p className="text-2xl font-bold text-accent">
                {auctions.reduce((sum, a) => sum + a.bidCount, 0)}
              </p>
              <p className="text-[13px] text-zinc-500">Lượt đặt giá</p>
            </div>
            <div className="rounded-sm bg-white p-4 text-center shadow-sm dark:bg-zinc-900">
              <p className="text-2xl font-bold text-accent">{auctions.length}</p>
              <p className="text-[13px] text-zinc-500">Sản phẩm</p>
            </div>
          </div>
        </section>

        {/* Listings */}
        <section id="listings" className="mx-auto mt-4 max-w-7xl px-4 pb-8">
          {loading ? (
            <div className="rounded-sm bg-white py-16 text-center text-zinc-400 shadow-sm dark:bg-zinc-900">
              Đang tải...
            </div>
          ) : (
            <>
              {query && (
                <div className="mb-3 text-sm text-zinc-500">
                  Kết quả cho: <span className="font-medium text-zinc-700 dark:text-zinc-300">&ldquo;{query}&rdquo;</span>
                  {" "}({filtered.length})
                </div>
              )}
              <AuctionGrid items={filtered} categories={categories} />
            </>
          )}
        </section>
      </main>

      <Footer />
    </div>
  );
}

export default function Home() {
  return (
    <Suspense>
      <HomeContent />
    </Suspense>
  );
}
