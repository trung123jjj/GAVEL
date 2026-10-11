"use client";

import { FormEvent, useState } from "react";

export default function AdminRemoveAuctionModal({
  auctionTitle,
  submitting,
  onCancel,
  onConfirm
}: {
  auctionTitle: string;
  submitting: boolean;
  onCancel: () => void;
  onConfirm: (reason: string) => void;
}) {
  const [reason, setReason] = useState("");
  const [validationError, setValidationError] = useState("");

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmedReason = reason.trim();
    if (!trimmedReason) {
      setValidationError("Vui lòng nhập lý do gỡ sản phẩm.");
      return;
    }
    onConfirm(trimmedReason);
  }

  return (
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center overflow-y-auto bg-black/60 px-4 py-4"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !submitting) onCancel();
      }}
    >
      <form
        role="dialog"
        aria-modal="true"
        aria-labelledby="remove-auction-title"
        onSubmit={submit}
        className="my-auto w-full max-w-lg rounded-sm bg-white p-5 shadow-xl dark:bg-zinc-900 sm:p-6"
      >
        <h2 id="remove-auction-title" className="text-lg font-bold text-zinc-800 dark:text-zinc-100">
          Gỡ sản phẩm
        </h2>
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-300">
          Nhập lý do gỡ <span className="font-semibold">{auctionTitle}</span>. Lý do sẽ được gửi trong thông báo cho người bán và người đã tham gia đấu giá.
        </p>
        <div className="mt-4 rounded-sm border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
          Sản phẩm sẽ bị ẩn khỏi trang công khai. Lịch sử đấu giá được giữ lại; đơn chưa hoàn tất sẽ bị hủy, đơn đã hoàn tất không thay đổi.
        </div>
        <label htmlFor="remove-auction-reason" className="mt-4 block text-sm font-medium text-zinc-700 dark:text-zinc-200">
          Lý do gỡ <span className="text-red-500">*</span>
        </label>
        <textarea
          id="remove-auction-reason"
          value={reason}
          onChange={(event) => {
            setReason(event.target.value);
            if (validationError) setValidationError("");
          }}
          maxLength={1000}
          rows={4}
          autoFocus
          placeholder="Mô tả lý do gỡ sản phẩm..."
          className="mt-1 w-full resize-y rounded-sm border border-zinc-300 bg-white p-3 text-sm outline-none focus:border-primary dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
        />
        {validationError && <p role="alert" className="mt-1 text-sm text-red-600">{validationError}</p>}
        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onCancel}
            disabled={submitting}
            className="w-full rounded-sm border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-200 sm:w-auto"
          >
            Hủy
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-sm bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50 sm:w-auto"
          >
            {submitting ? "Đang gỡ..." : "Xác nhận gỡ"}
          </button>
        </div>
      </form>
    </div>
  );
}
