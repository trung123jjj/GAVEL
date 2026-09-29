"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import { disconnectSocket, notifySessionChanged } from "@/lib/socket";

const navLinks = [
  { href: "/", label: "Đang đấu giá" },
  { href: "/sell", label: "Đăng bán" },
  { href: "/watchlist", label: "Yêu thích" },
];

export default function Header() {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<{ id: string; username: string; avatar?: string | null } | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function handleSearch() {
    const q = searchQuery.trim();
    if (q) {
      router.push(`/?q=${encodeURIComponent(q)}`);
    } else {
      router.push("/");
    }
  }

  useEffect(() => {
    let cancelled = false;

    // /auth/me là nguồn sự thật — localStorage chỉ còn là cache để hiển thị
    // nhanh, không phải nơi xác thực.
    async function loadUser() {
      try {
        const data = await api.me();
        if (cancelled) return;
        setUser(data.user);
        localStorage.setItem("user", JSON.stringify(data.user));
      } catch {
        if (cancelled) return;
        setUser(null);
        localStorage.removeItem("user");
      }
    }

    loadUser();
    window.addEventListener("gavel:session-changed", loadUser);
    return () => {
      cancelled = true;
      window.removeEventListener("gavel:session-changed", loadUser);
    };
  }, [pathname]);

  async function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setAvatarUploading(true);
    try {
      const urls = await api.upload([file]);
      console.log('upload success', urls);
      await api.updateAvatar(urls[0]);
      console.log('updateAvatar success');
      const updated = { ...user!, avatar: urls[0] };
      localStorage.setItem("user", JSON.stringify(updated));
      setUser(updated);
    } catch (err) {
      console.error('avatar change error', err);
    } finally {
      setAvatarUploading(false);
      e.target.value = '';
    }
  }

  async function handleLogout() {
    try {
      await api.logout();
    } catch (err) {
      console.error("logout error", err);
    }
    localStorage.removeItem("user");
    disconnectSocket();
    notifySessionChanged();
    setUser(null);
    setShowLogoutModal(false);
    router.push("/");
  }

  return (
    <header className="sticky top-0 z-50 bg-primary shadow-md">
      {/* Top bar */}
      <div className="hidden bg-sky-700/40 px-4 text-[13px] text-white/90 md:block">
        <div className="mx-auto flex h-8 max-w-7xl items-center justify-between">
          <div className="flex items-center gap-4">
            <span>Nền tảng đấu giá trực tuyến</span>
          </div>
          <div className="flex items-center gap-4">
            {user ? (
              <div className="relative">
                <button
                  onClick={() => setShowUserMenu(!showUserMenu)}
                  className="flex items-center gap-2 hover:opacity-80 transition-opacity"
                >
                  <span className="relative flex h-6 w-6 items-center justify-center overflow-hidden rounded-full bg-white/20 text-[11px] font-bold uppercase">
                    {user.avatar && user.avatar.trim() ? (
                      <Image src={user.avatar} alt={user.username} fill sizes="24px" className="object-cover" />
                    ) : (
                      user.username.charAt(0)
                    )}
                  </span>
                  <span className="font-medium">{user.username}</span>
                  <svg className={`h-3 w-3 transition-transform ${showUserMenu ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                {showUserMenu && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setShowUserMenu(false)} />
                    <div className="absolute right-0 z-50 mt-2 w-48 rounded-sm border border-zinc-200 bg-white shadow-md dark:border-zinc-700 dark:bg-zinc-800">
                      <Link
                        href={`/user/${user.id}`}
                        onClick={() => setShowUserMenu(false)}
                        className="flex items-center gap-2 px-4 py-2.5 text-sm text-zinc-700 transition-colors hover:bg-zinc-50 dark:text-zinc-300 dark:hover:bg-zinc-700"
                      >
                        <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                        </svg>
                        Trang cá nhân
                      </Link>
                      <Link
                        href="/watchlist"
                        onClick={() => setShowUserMenu(false)}
                        className="flex items-center gap-2 px-4 py-2.5 text-sm text-zinc-700 transition-colors hover:bg-zinc-50 dark:text-zinc-300 dark:hover:bg-zinc-700"
                      >
                        <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" />
                        </svg>
                        Danh sách theo dõi
                      </Link>
                      <Link
                        href="/chat"
                        onClick={() => setShowUserMenu(false)}
                        className="flex items-center gap-2 px-4 py-2.5 text-sm text-zinc-700 transition-colors hover:bg-zinc-50 dark:text-zinc-300 dark:hover:bg-zinc-700"
                      >
                        <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                        </svg>
                        Tin nhắn của tôi
                      </Link>
                      <hr className="border-zinc-100 dark:border-zinc-700" />
                      <button
                        onClick={() => { setShowUserMenu(false); fileInputRef.current?.click(); }}
                        disabled={avatarUploading}
                        className="flex w-full items-center gap-2 px-4 py-2.5 text-sm text-zinc-700 transition-colors hover:bg-zinc-50 dark:text-zinc-300 dark:hover:bg-zinc-700 disabled:opacity-50"
                      >
                        <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                        {avatarUploading ? 'Đang tải...' : 'Đổi ảnh đại diện'}
                      </button>
                      <button
                        onClick={() => { setShowUserMenu(false); setShowLogoutModal(true); }}
                        className="flex w-full items-center gap-2 px-4 py-2.5 text-sm text-red-600 transition-colors hover:bg-red-50 dark:hover:bg-red-900/20"
                      >
                        <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                        </svg>
                        Đăng Xuất
                      </button>
                    </div>
                  </>
                )}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleAvatarChange}
                />
              </div>
            ) : (
              <>
                <Link href="/auth/signup" className="hover:underline">
                  Đăng Ký
                </Link>
                <span className="h-3 w-px bg-white/20" />
                <Link href="/auth/signin" className="hover:underline">
                  Đăng Nhập
                </Link>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Main header */}
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-4 px-4">
        {/* Logo */}
        <Link href="/" className="shrink-0 text-xl font-bold tracking-tight text-white">
          GAVEL
        </Link>

        {/* Search */}
        <div className="flex flex-1 items-center overflow-hidden rounded-sm bg-white">
          <input
            type="text"
            placeholder="Tìm kiếm sản phẩm đấu giá..."
            className="h-10 flex-1 px-3 text-sm text-zinc-800 outline-none placeholder:text-zinc-400"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleSearch();
            }}
          />
          <button
            onClick={handleSearch}
            className="flex h-10 w-16 items-center justify-center bg-accent text-white transition-colors hover:bg-sky-600"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M11 19a8 8 0 100-16 8 8 0 000 16z" />
            </svg>
          </button>
        </div>

        {/* Mobile user */}
        {user && (
          <div className="flex items-center gap-1 md:hidden">
            <Link href="/watchlist" className="flex h-8 w-8 items-center justify-center rounded-full text-white/80 hover:text-white transition-colors" title="Danh sách theo dõi">
              <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" />
              </svg>
            </Link>
            <Link href={`/user/${user.id}`} className="relative flex h-8 w-8 items-center justify-center overflow-hidden rounded-full bg-white/20 text-sm font-bold text-white uppercase hover:opacity-80 transition-opacity">
              {user.avatar && user.avatar.trim() ? (
                <Image src={user.avatar} alt={user.username} fill sizes="32px" className="object-cover" />
              ) : (
                user.username.charAt(0)
              )}
            </Link>
          </div>
        )}
      </div>

      {/* Nav bar */}
      <div className="border-t border-sky-400/30 bg-sky-600/30">
        <div className="mx-auto flex h-10 max-w-7xl items-center gap-1 px-4">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`shrink-0 whitespace-nowrap rounded-sm px-4 py-1.5 text-[13px] font-medium transition-colors ${
                pathname === link.href
                  ? "bg-white/20 text-white"
                  : "text-white/80 hover:bg-white/10 hover:text-white"
              }`}
            >
              {link.label}
            </Link>
          ))}
        </div>
      </div>
      {/* Logout confirmation modal */}
      {showLogoutModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50" onClick={() => setShowLogoutModal(false)}>
          <div className="mx-4 w-full max-w-sm rounded-lg bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold text-zinc-800">Xác nhận đăng xuất</h3>
            <p className="mt-2 text-sm text-zinc-600">Bạn có chắc chắn muốn đăng xuất không?</p>
            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => setShowLogoutModal(false)}
                className="rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50"
              >
                Huỷ
              </button>
              <button
                onClick={handleLogout}
                className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-700"
              >
                Đăng xuất
              </button>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
