export default function Footer() {
  return (
    <footer className="mt-8 border-t border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
      <div className="mx-auto max-w-7xl px-4 py-10">
        <div className="grid grid-cols-2 gap-8 md:grid-cols-4">
          <div>
            <h4 className="mb-4 text-sm font-semibold uppercase tracking-wide text-zinc-800 dark:text-zinc-200">
              Về GAVEL
            </h4>
            <ul className="space-y-2 text-sm text-zinc-500 dark:text-zinc-400">
              <li>Giới thiệu</li>
              <li>Quy chế hoạt động</li>
              <li>Chính sách bảo mật</li>
              <li>Điều khoản sử dụng</li>
            </ul>
          </div>
          <div>
            <h4 className="mb-4 text-sm font-semibold uppercase tracking-wide text-zinc-800 dark:text-zinc-200">
              Hỗ trợ
            </h4>
            <ul className="space-y-2 text-sm text-zinc-500 dark:text-zinc-400">
              <li>Trung tâm trợ giúp</li>
              <li>Hướng dẫn đấu giá</li>
              <li>Quyền người mua</li>
              <li>Liên hệ</li>
            </ul>
          </div>
          <div>
            <h4 className="mb-4 text-sm font-semibold uppercase tracking-wide text-zinc-800 dark:text-zinc-200">
              Danh mục nổi bật
            </h4>
            <ul className="space-y-2 text-sm text-zinc-500 dark:text-zinc-400">
              <li>Điện thoại</li>
              <li>Laptop</li>
              <li>Đồng hồ</li>
              <li>Nghệ thuật</li>
            </ul>
          </div>
          <div>
            <h4 className="mb-4 text-sm font-semibold uppercase tracking-wide text-zinc-800 dark:text-zinc-200">
              Kết nối
            </h4>
            <ul className="space-y-2 text-sm text-zinc-500 dark:text-zinc-400">
              <li>Facebook</li>
              <li>Instagram</li>
              <li>TikTok</li>
              <li>Zalo</li>
            </ul>
          </div>
        </div>
        <div className="mt-8 border-t border-zinc-200 pt-6 text-center text-sm text-zinc-400 dark:border-zinc-800">
          &copy; 2026 GAVEL - Nền tảng đấu giá trực tuyến. Tất cả quyền được bảo lưu.
        </div>
      </div>
    </footer>
  );
}
