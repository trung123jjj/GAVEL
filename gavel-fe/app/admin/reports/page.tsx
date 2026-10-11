"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import Header from "@/components/header";
import Footer from "@/components/footer";
import { ApiError, api } from "@/lib/api";

type ReportStatus = "pending" | "resolved" | "dismissed";
type AuctionReport = {
  id: number;
  reason: "inappropriate" | "fraud" | "prohibited" | "misleading" | "other";
  details: string;
  status: ReportStatus;
  createdAt: string;
  auction: {
    id: number;
    title: string;
    image: string | null;
    removedAt: string | null;
    removalReason: string | null;
  } | null;
  reporter: { id: number; username: string } | null;
};
type ReportPage = { reports: AuctionReport[]; total: number; totalPages: number };

const reasonLabels: Record<AuctionReport["reason"], string> = {
  inappropriate: "Nội dung không phù hợp",
  fraud: "Có dấu hiệu lừa đảo",
  prohibited: "Sản phẩm bị cấm",
  misleading: "Thông tin gây hiểu lầm",
  other: "Lý do khác"
};

const statusLabels: Record<ReportStatus, string> = {
  pending: "Chờ xem xét",
  resolved: "Đã xử lý",
  dismissed: "Không vi phạm"
};

const filters: { value: ReportStatus | "all"; label: string }[] = [
  { value: "pending", label: "Chờ xem xét" },
  { value: "resolved", label: "Đã xử lý" },
  { value: "dismissed", label: "Đã đóng" },
  { value: "all", label: "Tất cả" }
];

export default function AdminReportsPage() {
  const [authorized, setAuthorized] = useState(false);
  const [checkingAccess, setCheckingAccess] = useState(true);
  const [reports, setReports] = useState<AuctionReport[]>([]);
  const [status, setStatus] = useState<ReportStatus | "all">("pending");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [loading, setLoading] = useState(true);
  const [busyReportId, setBusyReportId] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

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
    api.getAdminReports({ page, limit: 20, status })
      .then((data) => {
        if (!active) return;
        const result = data as ReportPage;
        setReports(result.reports);
        setTotal(result.total);
        setTotalPages(result.totalPages);
        setError("");
      })
      .catch((err: unknown) => {
        if (active) setError(err instanceof ApiError ? err.message : "Không thể tải báo cáo");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [authorized, page, status]);

  function changeFilter(nextStatus: ReportStatus | "all") {
    setStatus(nextStatus);
    setPage(1);
    setLoading(true);
  }

  async function updateReport(report: AuctionReport, nextStatus: "resolved" | "dismissed") {
    setBusyReportId(report.id);
    setError("");
    setNotice("");
    try {
      await api.updateAdminReportStatus(report.id, nextStatus);
      setNotice(nextStatus === "resolved" ? "Đã đánh dấu báo cáo là đã xử lý." : "Đã đóng báo cáo.");
      if (status === "pending") {
        setReports((current) => current.filter((item) => item.id !== report.id));
        setTotal((current) => Math.max(0, current - 1));
      } else {
        setReports((current) => current.map((item) => item.id === report.id ? { ...item, status: nextStatus } : item));
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Không thể cập nhật báo cáo");
    } finally {
      setBusyReportId(null);
    }
  }

  async function removeReportedAuction(report: AuctionReport) {
    if (!report.auction || report.auction.removedAt) return;
    const reason = window.prompt(`Nhập lý do gỡ sản phẩm "${report.auction.title}":`)?.trim();
    if (!reason) return;
    if (!window.confirm("Gỡ sản phẩm khỏi trang công khai, giữ lịch sử đấu giá và hủy đơn chưa hoàn tất?")) return;

    setBusyReportId(report.id);
    setError("");
    setNotice("");
    try {
      await api.removeAdminAuction(report.auction.id, reason);
      setReports((current) => current
        .filter((item) => item.auction?.id !== report.auction?.id || status !== "pending")
        .map((item) => item.auction?.id === report.auction?.id
          ? { ...item, status: "resolved", auction: { ...item.auction!, removedAt: new Date().toISOString(), removalReason: reason } }
          : item
        ));
      setTotal((current) => status === "pending"
        ? Math.max(0, current - reports.filter((item) => item.auction?.id === report.auction?.id && item.status === "pending").length)
        : current
      );
      setNotice(`Đã gỡ "${report.auction.title}" và xử lý các báo cáo đang chờ của sản phẩm.`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Không thể gỡ sản phẩm");
    } finally {
      setBusyReportId(null);
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-zinc-100 dark:bg-zinc-950">
      <Header />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">
        <div className="mb-6">
          <p className="text-sm font-medium text-primary">Khu vực quản trị</p>
          <h1 className="mt-1 text-2xl font-bold text-zinc-800 dark:text-zinc-100">Báo cáo sản phẩm</h1>
          <div className="mt-4 flex flex-wrap gap-2">
            <Link href="/admin/users" className="rounded-sm border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-600 hover:bg-white dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900">Tài khoản</Link>
            <Link href="/admin/auctions" className="rounded-sm border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-600 hover:bg-white dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900">Sản phẩm</Link>
            <Link href="/admin/reports" className="rounded-sm bg-primary px-4 py-2 text-sm font-semibold text-white">Báo cáo</Link>
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
              <span className="ml-auto text-sm text-zinc-500">{total} báo cáo</span>
            </div>
            {error && <p role="alert" className="mb-4 rounded-sm bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300">{error}</p>}
            {notice && <p role="status" className="mb-4 rounded-sm bg-green-50 p-3 text-sm text-green-700 dark:bg-green-950/40 dark:text-green-300">{notice}</p>}

            <div className="overflow-hidden rounded-sm bg-white shadow-sm dark:bg-zinc-900">
              {loading ? (
                <p className="py-12 text-center text-zinc-400">Đang tải báo cáo...</p>
              ) : reports.length === 0 ? (
                <p className="py-12 text-center text-sm text-zinc-400">Không có báo cáo trong mục này.</p>
              ) : (
                <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
                  {reports.map((report) => (
                    <article key={report.id} className="flex flex-col gap-4 p-4 sm:flex-row">
                      {report.auction?.image ? (
                        <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-sm bg-zinc-100 dark:bg-zinc-800">
                          <Image src={report.auction.image} alt={report.auction.title} fill sizes="80px" className="object-cover" />
                        </div>
                      ) : (
                        <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-sm bg-zinc-100 text-xs text-zinc-400 dark:bg-zinc-800">Không ảnh</div>
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div>
                            <p className="text-xs text-zinc-400">Báo cáo #{report.id} · {new Date(report.createdAt).toLocaleString("vi-VN")}</p>
                            <h2 className="mt-1 font-semibold text-zinc-800 dark:text-zinc-100">{report.auction?.title || "Sản phẩm không còn tồn tại"}</h2>
                          </div>
                          <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${report.status === "pending" ? "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300" : report.status === "resolved" ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300" : "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300"}`}>
                            {statusLabels[report.status]}
                          </span>
                        </div>
                        <p className="mt-2 text-sm text-red-600 dark:text-red-300">{reasonLabels[report.reason]}</p>
                        <p className="mt-1 text-xs text-zinc-500">Người báo cáo: {report.reporter?.username || "Tài khoản đã xóa"}</p>
                        {report.details && <p className="mt-2 whitespace-pre-line text-sm text-zinc-600 dark:text-zinc-300">{report.details}</p>}
                        {report.auction?.removedAt && <p className="mt-2 text-xs text-zinc-500">Sản phẩm đã gỡ: {report.auction.removalReason || "Không có lý do"}</p>}
                        <div className="mt-3 flex flex-wrap gap-2">
                          {report.auction && !report.auction.removedAt && (
                            <>
                              <Link href={`/auction/${report.auction.id}`} className="rounded-sm border border-zinc-300 px-3 py-2 text-xs font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800">Xem sản phẩm</Link>
                              <button onClick={() => void removeReportedAuction(report)} disabled={busyReportId === report.id} className="rounded-sm bg-red-600 px-3 py-2 text-xs font-semibold text-white hover:bg-red-700 disabled:opacity-50">
                                {busyReportId === report.id ? "Đang xử lý..." : "Gỡ sản phẩm"}
                              </button>
                            </>
                          )}
                          {report.status === "pending" && (
                            <>
                              <button onClick={() => void updateReport(report, "resolved")} disabled={busyReportId === report.id} className="rounded-sm bg-green-700 px-3 py-2 text-xs font-semibold text-white hover:bg-green-800 disabled:opacity-50">Đánh dấu đã xử lý</button>
                              <button onClick={() => void updateReport(report, "dismissed")} disabled={busyReportId === report.id} className="rounded-sm border border-zinc-300 px-3 py-2 text-xs font-medium text-zinc-600 hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800">Đóng, không vi phạm</button>
                            </>
                          )}
                        </div>
                      </div>
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
