import Link from "next/link";

export default function LoginRequiredModal({
  message,
  onClose,
}: {
  message: string;
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center overflow-y-auto bg-black/50 px-4 py-4"
      onClick={onClose}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="login-required-title"
        className="my-auto max-h-[calc(100dvh-2rem)] w-full max-w-sm overflow-y-auto rounded-lg bg-white p-5 text-center shadow-xl dark:bg-zinc-900 sm:p-6"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
          <svg className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM4 21a8 8 0 0116 0" />
          </svg>
        </div>
        <h2 id="login-required-title" className="mt-4 text-lg font-semibold text-zinc-800 dark:text-zinc-100">
          Vui lòng đăng nhập
        </h2>
        <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">{message}</p>
        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-center sm:gap-3">
          <button
            type="button"
            onClick={onClose}
            className="w-full rounded-sm border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800 sm:w-auto"
          >
            Đóng
          </button>
          <Link
            href="/auth/signin"
            className="w-full rounded-sm bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary-hover sm:w-auto"
          >
            Đăng nhập
          </Link>
        </div>
      </section>
    </div>
  );
}
