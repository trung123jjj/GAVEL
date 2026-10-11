"use client";

import Image from "next/image";
import Link from "next/link";
import { FormEvent, useCallback, useEffect, useState } from "react";
import Header from "@/components/header";
import Footer from "@/components/footer";
import { ApiError, api } from "@/lib/api";

type AdminAccount = {
  id: number;
  username: string;
  email: string | null;
  email_verified_at: string | null;
  avatar: string | null;
  role: "user" | "admin";
  is_active: boolean;
  createdAt: string;
};

type AdminUserPage = {
  users: AdminAccount[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
};

function fetchAdminUsers(page: number, query: string) {
  return api.getAdminUsers({ page, limit: 20, q: query }) as Promise<AdminUserPage>;
}

export default function AdminUsersPage() {
  const [adminId, setAdminId] = useState<number | null>(null);
  const [authorized, setAuthorized] = useState(false);
  const [checkingAccess, setCheckingAccess] = useState(true);
  const [users, setUsers] = useState<AdminAccount[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState("");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<number | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    api.me()
      .then((data) => {
        if (!active) return;
        const currentUser = data.user as { id: number; role: string };
        setAdminId(Number(currentUser.id));
        setAuthorized(currentUser.role === "admin");
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

  const loadUsers = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const result = await fetchAdminUsers(page, query);
      setUsers(result.users);
      setTotal(result.total);
      setTotalPages(result.totalPages);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Không thể tải danh sách tài khoản");
    } finally {
      setLoading(false);
    }
  }, [page, query]);

  useEffect(() => {
    if (!authorized) return;
    let active = true;
    fetchAdminUsers(page, query)
      .then((result) => {
        if (!active) return;
        setUsers(result.users);
        setTotal(result.total);
        setTotalPages(result.totalPages);
        setError("");
      })
      .catch((err: unknown) => {
        if (active) setError(err instanceof ApiError ? err.message : "Không thể tải danh sách tài khoản");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [authorized, page, query]);

  function search(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextQuery = searchInput.trim();
    if (nextQuery === query && page === 1) {
      void loadUsers();
      return;
    }
    setLoading(true);
    setPage(1);
    setQuery(nextQuery);
  }

  async function toggleAccount(account: AdminAccount) {
    const nextActive = !account.is_active;
    const action = nextActive ? "mở khóa" : "khóa";
    if (!window.confirm(`Bạn có chắc muốn ${action} tài khoản "${account.username}"?`)) return;

    setUpdatingId(account.id);
    setError("");
    try {
      const result = await api.setAdminUserStatus(account.id, nextActive);
      setUsers((current) => current.map((user) =>
        user.id === account.id ? { ...user, is_active: result.user.is_active } : user
      ));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : `Không thể ${action} tài khoản`);
    } finally {
      setUpdatingId(null);
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-zinc-100 dark:bg-zinc-950">
      <Header />
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-8">
        <div className="mb-6">
          <p className="text-sm font-medium text-primary">Khu vực quản trị</p>
          <h1 className="mt-1 text-2xl font-bold text-zinc-800 dark:text-zinc-100">Quản lý tài khoản</h1>
          <div className="mt-4 flex gap-2">
            <Link href="/admin/users" className="rounded-sm bg-primary px-4 py-2 text-sm font-semibold text-white">Tài khoản</Link>
            <Link href="/admin/auctions" className="rounded-sm border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-600 hover:bg-white dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900">Sản phẩm</Link>
            <Link href="/admin/reports" className="rounded-sm border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-600 hover:bg-white dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900">Báo cáo</Link>
          </div>
        </div>

        {checkingAccess ? (
          <p className="py-12 text-center text-zinc-400">Đang xác minh quyền truy cập...</p>
        ) : !authorized ? (
          <div className="rounded-sm bg-white p-8 text-center shadow-sm dark:bg-zinc-900">
            <p className="font-medium text-zinc-700 dark:text-zinc-200">
              {error || "Bạn không có quyền truy cập trang quản trị."}
            </p>
            <Link href="/" className="mt-4 inline-block text-sm font-semibold text-primary hover:underline">Về trang chủ</Link>
          </div>
        ) : (
          <>
            <form onSubmit={search} className="mb-4 flex flex-col gap-2 rounded-sm bg-white p-4 shadow-sm sm:flex-row dark:bg-zinc-900">
              <input
                value={searchInput}
                onChange={(event) => setSearchInput(event.target.value)}
                placeholder="Tìm theo tên đăng nhập hoặc email"
                className="h-10 flex-1 rounded-sm border border-zinc-300 px-3 text-sm outline-none focus:border-primary dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
              />
              <button type="submit" className="rounded-sm bg-primary px-5 py-2 text-sm font-semibold text-white hover:bg-primary-hover">
                Tìm kiếm
              </button>
            </form>

            {error && (
              <div role="alert" className="mb-4 flex items-center justify-between gap-3 rounded-sm bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300">
                <span>{error}</span>
                <button onClick={() => void loadUsers()} className="shrink-0 font-semibold underline">Thử lại</button>
              </div>
            )}

            <div className="overflow-hidden rounded-sm bg-white shadow-sm dark:bg-zinc-900">
              <div className="flex items-center justify-between border-b border-zinc-100 px-4 py-3 text-sm dark:border-zinc-800">
                <span className="font-medium text-zinc-700 dark:text-zinc-200">{total} tài khoản</span>
                {query && <span className="text-zinc-500">Kết quả cho “{query}”</span>}
              </div>
              {loading ? (
                <p className="py-12 text-center text-zinc-400">Đang tải tài khoản...</p>
              ) : users.length === 0 ? (
                <p className="py-12 text-center text-sm text-zinc-400">Không tìm thấy tài khoản phù hợp.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[760px] text-left text-sm">
                    <thead className="bg-zinc-50 text-xs uppercase text-zinc-500 dark:bg-zinc-800/70">
                      <tr>
                        <th className="px-4 py-3 font-semibold">Tài khoản</th>
                        <th className="px-4 py-3 font-semibold">Vai trò</th>
                        <th className="px-4 py-3 font-semibold">Email</th>
                        <th className="px-4 py-3 font-semibold">Ngày tạo</th>
                        <th className="px-4 py-3 font-semibold">Trạng thái</th>
                        <th className="px-4 py-3 text-right font-semibold">Thao tác</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                      {users.map((account) => (
                        <tr key={account.id} className="text-zinc-700 dark:text-zinc-200">
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-3">
                              <span className="relative flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-zinc-200 font-semibold uppercase text-zinc-600 dark:bg-zinc-700 dark:text-zinc-200">
                                {account.avatar ? <Image src={account.avatar} alt="" fill sizes="36px" className="object-cover" /> : account.username.charAt(0)}
                              </span>
                              <div>
                                <p className="font-semibold">{account.username}</p>
                                <p className="text-xs text-zinc-400">ID: {account.id}</p>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3">{account.role === "admin" ? "Quản trị viên" : "Người dùng"}</td>
                          <td className="px-4 py-3">
                            <span>{account.email || "Chưa có email"}</span>
                            {account.email && <span className={`ml-2 text-xs ${account.email_verified_at ? "text-green-600" : "text-amber-600"}`}>{account.email_verified_at ? "Đã xác minh" : "Chưa xác minh"}</span>}
                          </td>
                          <td className="px-4 py-3 text-zinc-500">{new Date(account.createdAt).toLocaleDateString("vi-VN")}</td>
                          <td className="px-4 py-3">
                            <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${account.is_active ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300" : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300"}`}>
                              {account.is_active ? "Đang hoạt động" : "Đã khóa"}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <button
                              onClick={() => void toggleAccount(account)}
                              disabled={updatingId === account.id || (account.id === adminId && account.is_active)}
                              className={`rounded-sm px-3 py-2 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40 ${account.is_active ? "bg-red-600 hover:bg-red-700" : "bg-green-600 hover:bg-green-700"}`}
                              title={account.id === adminId && account.is_active ? "Không thể tự khóa tài khoản quản trị" : undefined}
                            >
                              {updatingId === account.id ? "Đang cập nhật..." : account.is_active ? "Khóa" : "Mở khóa"}
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              <div className="flex items-center justify-between border-t border-zinc-100 px-4 py-3 dark:border-zinc-800">
                <span className="text-xs text-zinc-500">Trang {page} / {Math.max(totalPages, 1)}</span>
                <div className="flex gap-2">
                  <button
                    onClick={() => { setLoading(true); setPage((current) => Math.max(1, current - 1)); }}
                    disabled={page <= 1 || loading}
                    className="rounded-sm border border-zinc-300 px-3 py-1.5 text-sm disabled:opacity-40 dark:border-zinc-700"
                  >
                    Trước
                  </button>
                  <button
                    onClick={() => { setLoading(true); setPage((current) => Math.min(totalPages, current + 1)); }}
                    disabled={page >= totalPages || loading}
                    className="rounded-sm border border-zinc-300 px-3 py-1.5 text-sm disabled:opacity-40 dark:border-zinc-700"
                  >
                    Sau
                  </button>
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
