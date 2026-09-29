"use client";

import Image from "next/image";
import Link from "next/link";
import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { api, API_BASE } from "@/lib/api";
import type { AuctionItem, Review, ReviewMedia, UserProfile } from "@/types/auction";
import Header from "@/components/header";
import Footer from "@/components/footer";

function formatPrice(n: number) {
  return n.toLocaleString("vi-VN");
}

function getStatusLabel(status: string) {
  if (status === "active") return { text: "Đang diễn ra", color: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" };
  if (status === "ended") return { text: "Đã kết thúc", color: "bg-zinc-200 text-zinc-600 dark:bg-zinc-700 dark:text-zinc-300" };
  return { text: "Sắp diễn ra", color: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400" };
}

function getTimeLeft(endTime: string) {
  const diff = new Date(endTime).getTime() - Date.now();
  if (diff <= 0) return null;
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
  const minutes = Math.floor((diff / (1000 * 60)) % 60);
  return { days, hours, minutes };
}

type Tab = "all" | "active" | "ended" | "reviews";

function StarRating({ value, onChange, size = "md" }: { value: number; onChange?: (v: number) => void; size?: "sm" | "md" }) {
  const [hover, setHover] = useState(0);
  const sz = size === "sm" ? "text-base" : "text-xl";

  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((s) => (
        <button
          key={s}
          type="button"
          disabled={!onChange}
          className={`${sz} transition-colors ${onChange ? "cursor-pointer" : "cursor-default"}`}
          onMouseEnter={() => onChange && setHover(s)}
          onMouseLeave={() => onChange && setHover(0)}
          onClick={() => onChange && onChange(s)}
        >
          <span className={s <= (hover || value) ? "text-yellow-400" : "text-zinc-300 dark:text-zinc-600"}>
            ★
          </span>
        </button>
      ))}
    </div>
  );
}

function mediaSrc(url: string | null | undefined) {
  if (!url || !url.trim()) return null;
  if (url.startsWith("http")) return url;
  return `${API_BASE}${url}`;
}

function ReviewCard({ review }: { review: Review }) {
  const [lightbox, setLightbox] = useState<string | null>(null);

  return (
    <>
      <div className="rounded-sm bg-white p-4 shadow-sm dark:bg-zinc-900">
        <div className="flex items-start gap-3">
          <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-700">
            {review.buyerAvatar ? (
              <Image src={review.buyerAvatar} alt={review.buyerName} fill sizes="40px" className="object-cover" />
            ) : (
              <span className="flex h-full w-full items-center justify-center text-sm font-bold text-zinc-400">
                {review.buyerName?.charAt(0)?.toUpperCase()}
              </span>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-zinc-800 dark:text-zinc-200">{review.buyerName}</span>
              <span className="text-[12px] text-zinc-400">
                {new Date(review.createdAt).toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" })}
              </span>
            </div>
            <StarRating value={review.rating} size="sm" />
            <p className="mt-1 text-sm text-zinc-500 line-clamp-2">
              Đã mua: <Link href={`/auction/${review.auctionId}`} className="font-medium text-primary hover:underline">{review.auctionTitle}</Link>
            </p>
            {review.comment && (
              <p className="mt-2 text-sm text-zinc-700 dark:text-zinc-300 whitespace-pre-line">{review.comment}</p>
            )}
            {review.media.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-2">
                {review.media.map((m, i) => {
                  const src = mediaSrc(m.url);
                  if (!src) return null;
                  return m.type === "image" ? (
                    <button key={i} onClick={() => setLightbox(src)} className="relative h-20 w-20 overflow-hidden rounded-sm bg-zinc-100 dark:bg-zinc-800">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={src} alt="" className="h-full w-full object-cover" />
                    </button>
                  ) : (
                    <button key={i} onClick={() => setLightbox(src)} className="relative h-20 w-20 overflow-hidden rounded-sm bg-zinc-100 dark:bg-zinc-800">
                      <video src={src} className="h-full w-full object-cover" muted />
                      <span className="absolute inset-0 flex items-center justify-center text-white text-lg">▶</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {lightbox && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
          onClick={() => setLightbox(null)}
        >
          {lightbox.match(/\.(mp4|webm|ogg)$/i) || lightbox.includes("video") ? (
            <video src={lightbox} controls className="max-h-[80vh] max-w-[90vw] rounded-sm" />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={lightbox} alt="" className="max-h-[80vh] max-w-[90vw] rounded-sm object-contain" />
          )}
        </div>
      )}
    </>
  );
}

function ReviewForm({ profileId, profileName, onSubmitted }: { profileId: string; profileName: string; onSubmitted: () => void }) {
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [media, setMedia] = useState<ReviewMedia[]>([]);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setUploading(true);
    try {
      const urls = await api.upload(Array.from(files));
      const newMedia: ReviewMedia[] = urls.map((url) => ({
        type: url.match(/\.(mp4|webm|ogg)$/i) ? "video" : "image",
        url,
      }));
      setMedia((prev) => [...prev, ...newMedia]);
    } catch {
      setError("Lỗi tải ảnh/video lên");
    } finally {
      setUploading(false);
    }
  };

  const removeMedia = (index: number) => {
    setMedia((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    if (rating === 0) {
      setError("Vui lòng đánh giá sao");
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      await api.createReview(profileId, { rating, comment, media });
      setSuccess(true);
      setRating(0);
      setComment("");
      setMedia([]);
      onSubmitted();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Lỗi gửi đánh giá");
    } finally {
      setSubmitting(false);
    }
  };

  if (success) {
    return (
      <div className="rounded-sm bg-white p-6 text-center shadow-sm dark:bg-zinc-900">
        <p className="text-lg font-semibold text-green-600">Đánh giá đã được gửi thành công!</p>
        <button
          onClick={() => setSuccess(false)}
          className="mt-3 rounded-sm bg-accent px-4 py-2 text-sm font-medium text-white hover:opacity-90"
        >
          Viết đánh giá khác
        </button>
      </div>
    );
  }

  return (
    <div className="rounded-sm bg-white p-4 shadow-sm dark:bg-zinc-900">
      <h3 className="mb-3 text-sm font-semibold text-zinc-700 dark:text-zinc-300">Viết đánh giá cho {profileName}</h3>

      <div className="space-y-3">
        <div>
          <label className="mb-1 block text-[13px] text-zinc-500">Đánh giá sao *</label>
          <StarRating value={rating} onChange={setRating} />
        </div>

        <div>
          <label className="mb-1 block text-[13px] text-zinc-500">Bình luận</label>
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            rows={3}
            placeholder="Chia sẻ trải nghiệm của bạn..."
            className="w-full resize-none rounded-sm border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-primary dark:border-zinc-700 dark:bg-zinc-800"
          />
        </div>

        <div>
          <label className="mb-1 block text-[13px] text-zinc-500">Hình ảnh / Video</label>
          <div className="flex flex-wrap gap-2">
            {media.map((m, i) => {
              const src = mediaSrc(m.url);
              return (
                <div key={i} className="relative h-20 w-20 overflow-hidden rounded-sm bg-zinc-100 dark:bg-zinc-800">
                  {m.type === "image" ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={src} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <video src={src} className="h-full w-full object-cover" muted />
                  )}
                  <button
                    type="button"
                    onClick={() => removeMedia(i)}
                    className="absolute right-0.5 top-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-black/60 text-xs text-white hover:bg-black/80"
                  >
                    ✕
                  </button>
                </div>
              );
            })}
            <button
              type="button"
              disabled={uploading}
              onClick={() => fileRef.current?.click()}
              className="flex h-20 w-20 items-center justify-center rounded-sm border-2 border-dashed border-zinc-300 text-2xl text-zinc-400 hover:border-primary hover:text-primary dark:border-zinc-600"
            >
              {uploading ? "..." : "+"}
            </button>
          </div>
          <input
            ref={fileRef}
            type="file"
            accept="image/*,video/*"
            multiple
            className="hidden"
            onChange={(e) => handleUpload(e.target.files)}
          />
        </div>

        {error && <p className="text-sm text-red-500">{error}</p>}

        <button
          onClick={handleSubmit}
          disabled={submitting || rating === 0}
          className="w-full rounded-sm bg-accent py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {submitting ? "Đang gửi..." : "Gửi đánh giá"}
        </button>
      </div>
    </div>
  );
}

function AuctionGrid({ items, isOwner, onDelete }: { items: AuctionItem[]; isOwner?: boolean; onDelete?: (item: AuctionItem) => void }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
      {items.map((item) => {
        const status = getStatusLabel(item.status);
        const time = getTimeLeft(item.endTime);
        return (
          <div key={item.id} className="group relative flex flex-col overflow-hidden rounded-sm bg-white shadow-sm transition-shadow hover:shadow-md dark:bg-zinc-900">
            <Link href={`/auction/${item.id}`} className="flex flex-col">
              <div className="relative aspect-square overflow-hidden bg-zinc-50 dark:bg-zinc-800">
                <Image
                  src={item.image}
                  alt={item.title}
                  fill
                  className="object-contain p-4 transition-transform duration-300 group-hover:scale-105"
                />
                <span className={`absolute left-2 top-2 rounded-sm px-2 py-0.5 text-[11px] font-semibold ${status.color}`}>
                  {status.text}
                </span>
              </div>
              <div className="flex flex-1 flex-col gap-1 p-3">
                <h3 className="line-clamp-2 text-sm font-medium leading-5 text-zinc-800 group-hover:text-primary dark:text-zinc-200">
                  {item.title}
                </h3>
                <p className="text-lg font-bold text-accent">{formatPrice(item.currentPrice)}đ</p>
                <p className="text-[12px] text-zinc-400">{item.bidCount} lượt đặt giá</p>
                {time && (
                  <p className="mt-auto text-[12px] text-zinc-400">
                    Còn {time.days > 0 && `${time.days}d `}{String(time.hours).padStart(2, "0")}:{String(time.minutes).padStart(2, "0")}
                  </p>
                )}
              </div>
            </Link>
            {isOwner && (
              <div className="flex border-t border-zinc-100 dark:border-zinc-800">
                <Link
                  href={`/sell?edit=${item.id}`}
                  className="flex flex-1 items-center justify-center gap-1 py-2 text-[12px] font-medium text-zinc-500 transition-colors hover:bg-zinc-50 hover:text-primary dark:hover:bg-zinc-800"
                >
                  <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                  Sửa
                </Link>
                <span className="w-px bg-zinc-100 dark:bg-zinc-800" />
                <button
                  onClick={() => onDelete?.(item)}
                  className="flex flex-1 items-center justify-center gap-1 py-2 text-[12px] font-medium text-zinc-500 transition-colors hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/20"
                >
                  <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                  Xoá
                </button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function UserProfileContent() {
  const params = useParams();
  const id = params.id as string;
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>("all");
  const [currentUser, setCurrentUser] = useState<{ id: string } | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deletingAuction, setDeletingAuction] = useState<AuctionItem | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  useEffect(() => {
    async function loadCurrentUser() {
      try {
        const data = await api.me();
        setCurrentUser(data.user);
      } catch {
        setCurrentUser(null);
      }
    }

    void loadCurrentUser();
  }, []);

  const isOwner = currentUser !== null && String(currentUser.id) === id;

  const fetchProfile = useCallback(() => {
    api.getUserProfile(id)
      .then((data) => setProfile(data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

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

  if (!profile) {
    return (
      <div className="flex min-h-screen flex-col bg-zinc-100 dark:bg-zinc-950">
        <Header />
        <main className="flex flex-1 items-center justify-center">
          <p className="text-zinc-400">Không tìm thấy người dùng</p>
        </main>
        <Footer />
      </div>
    );
  }

  const filteredAuctions = tab === "all" || tab === "reviews"
    ? profile.auctions
    : profile.auctions.filter((a) => a.status === tab);

  async function handleDelete() {
    if (!deletingAuction) return;
    setDeleteLoading(true);
    try {
      await api.deleteAuction(deletingAuction.id);
      setShowDeleteModal(false);
      setDeletingAuction(null);
      fetchProfile();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Xoá thất bại");
    } finally {
      setDeleteLoading(false);
    }
  }

  const reviews = profile.reviews || [];
  const avgRating = profile.averageRating || 0;

  return (
    <div className="flex min-h-screen flex-col bg-zinc-100 dark:bg-zinc-950">
      <Header />

      {/* Profile header */}
      <section className="bg-white shadow-sm dark:bg-zinc-900">
        <div className="mx-auto flex max-w-7xl items-center gap-5 px-4 py-6">
          {/* Avatar */}
          <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-700">
            {profile.avatar && profile.avatar.trim() ? (
              <Image src={profile.avatar} alt={profile.username} fill sizes="80px" className="object-cover" />
            ) : (
              <span className="flex h-full w-full items-center justify-center text-2xl font-bold text-zinc-400">
                {profile.username?.charAt(0)?.toUpperCase()}
              </span>
            )}
          </div>

          {/* Info */}
          <div className="flex-1">
            <h1 className="text-xl font-bold text-zinc-800 dark:text-zinc-100">{profile.username}</h1>
            <p className="mt-0.5 text-sm text-zinc-400">
              Tham gia ngày {new Date(profile.joinedAt).toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" })}
            </p>
            {avgRating > 0 && (
              <div className="mt-1 flex items-center gap-1.5">
                <StarRating value={Math.round(avgRating)} size="sm" />
                <span className="text-[13px] font-medium text-zinc-500">{avgRating.toFixed(1)}</span>
                <span className="text-[12px] text-zinc-400">({reviews.length} đánh giá)</span>
              </div>
            )}
          </div>

          {/* Message button */}
          {!isOwner && (
            <Link
              href={`/chat/${profile.id}`}
              className="flex shrink-0 items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-primary-hover"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
              </svg>
              Nhắn tin
            </Link>
          )}

          {/* Stats */}
          <div className="hidden gap-6 sm:flex">
            <div className="text-center">
              <p className="text-2xl font-bold text-accent">{profile.auctionCount}</p>
              <p className="text-[13px] text-zinc-400">Sản phẩm</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-accent">
                {profile.auctions.filter((a) => a.status === "active").length}
              </p>
              <p className="text-[13px] text-zinc-400">Đang bán</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-accent">
                {profile.auctions.reduce((sum, a) => sum + a.bidCount, 0)}
              </p>
              <p className="text-[13px] text-zinc-400">Lượt đặt giá</p>
            </div>
          </div>
        </div>

        {/* Mobile stats */}
        <div className="grid grid-cols-3 gap-3 border-t border-zinc-100 px-4 py-3 sm:hidden dark:border-zinc-800">
          <div className="text-center">
            <p className="text-lg font-bold text-accent">{profile.auctionCount}</p>
            <p className="text-[12px] text-zinc-400">Sản phẩm</p>
          </div>
          <div className="text-center">
            <p className="text-lg font-bold text-accent">
              {profile.auctions.filter((a) => a.status === "active").length}
            </p>
            <p className="text-[12px] text-zinc-400">Đang bán</p>
          </div>
          <div className="text-center">
            <p className="text-lg font-bold text-accent">
              {profile.auctions.reduce((sum, a) => sum + a.bidCount, 0)}
            </p>
            <p className="text-[12px] text-zinc-400">Lượt đặt giá</p>
          </div>
        </div>
      </section>

      {/* Tabs + Content */}
      <main className="mx-auto w-full max-w-7xl px-4 py-4">
        {/* Tabs */}
        <div className="mb-4 flex gap-1 rounded-sm bg-white p-1 shadow-sm dark:bg-zinc-900">
          {([
            { key: "all", label: "Tất cả" },
            { key: "active", label: "Đang bán" },
            { key: "ended", label: "Đã kết thúc" },
            { key: "reviews", label: "Đánh giá" },
          ] as const).map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex-1 rounded-sm px-4 py-2 text-sm font-medium transition-colors ${
                tab === t.key
                  ? "bg-accent text-white"
                  : "text-zinc-500 hover:bg-zinc-50 dark:hover:bg-zinc-800"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Listings tab */}
        {tab !== "reviews" && (
          <>
            {filteredAuctions.length === 0 ? (
              <div className="rounded-sm bg-white py-16 text-center text-sm text-zinc-400 shadow-sm dark:bg-zinc-900">
                Chưa có sản phẩm nào
              </div>
            ) : (
              <AuctionGrid
                items={filteredAuctions}
                isOwner={isOwner}
                onDelete={(item) => { setDeletingAuction(item); setShowDeleteModal(true); }}
              />
            )}
          </>
        )}

        {/* Reviews tab */}
        {tab === "reviews" && (
          <div className="space-y-4">
            {/* Review form */}
            <ReviewForm profileId={id} profileName={profile.username} onSubmitted={fetchProfile} />

            {/* Reviews list */}
            {reviews.length === 0 ? (
              <div className="rounded-sm bg-white py-16 text-center text-sm text-zinc-400 shadow-sm dark:bg-zinc-900">
                Chưa có đánh giá nào
              </div>
            ) : (
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">
                  Tất cả đánh giá ({reviews.length})
                </h3>
                {reviews.map((review) => (
                  <ReviewCard key={review.id} review={review} />
                ))}
              </div>
            )}
          </div>
        )}
      </main>

      {/* Delete confirmation modal */}
      {showDeleteModal && deletingAuction && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50" onClick={() => !deleteLoading && setShowDeleteModal(false)}>
          <div className="mx-4 w-full max-w-sm rounded-lg bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold text-zinc-800">Xác nhận xoá</h3>
            <p className="mt-2 text-sm text-zinc-600">
              Bạn có chắc chắn muốn xoá sản phẩm <span className="font-medium text-zinc-800">&ldquo;{deletingAuction.title}&rdquo;</span> không? Hành động này không thể hoàn tác.
            </p>
            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => setShowDeleteModal(false)}
                disabled={deleteLoading}
                className="rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50 disabled:opacity-50"
              >
                Huỷ
              </button>
              <button
                onClick={handleDelete}
                disabled={deleteLoading}
                className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-700 disabled:opacity-50"
              >
                {deleteLoading ? "Đang xoá..." : "Xoá"}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="mt-auto">
        <Footer />
      </div>
    </div>
  );
}

export default function UserProfilePage() {
  return (
    <Suspense>
      <UserProfileContent />
    </Suspense>
  );
}
