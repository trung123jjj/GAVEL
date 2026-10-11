import Link from "next/link";

const infoLinks = [
  { label: "Giới thiệu", href: "/info/about" },
  { label: "Quy chế hoạt động", href: "/info/marketplace-rules" },
  { label: "Chính sách bảo mật", href: "/info/privacy" },
  { label: "Điều khoản sử dụng", href: "/info/terms" },
];

const supportLinks = [
  { label: "Trung tâm trợ giúp", href: "/info/help" },
  { label: "Hướng dẫn đấu giá", href: "/info/bidding-guide" },
  { label: "Quyền người mua", href: "/info/buyer-rights" },
  { label: "Liên hệ", href: "/info/contact" },
];

const categoryLinks = ["Điện thoại", "Laptop", "Đồng hồ", "Nghệ thuật"];
const socialNames = ["Facebook", "Instagram", "TikTok", "Zalo"];

function LinkList({ links }: { links: { label: string; href: string }[] }) {
  return (
    <ul className="space-y-2 text-sm text-zinc-500 dark:text-zinc-400">
      {links.map((link) => (
        <li key={link.href}>
          <Link href={link.href} className="transition-colors hover:text-primary hover:underline">
            {link.label}
          </Link>
        </li>
      ))}
    </ul>
  );
}

export default function Footer() {
  return (
    <footer className="mt-8 border-t border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
      <div className="mx-auto max-w-7xl px-4 py-10">
        <div className="grid grid-cols-2 gap-8 md:grid-cols-4">
          <div>
            <h4 className="mb-4 text-sm font-semibold uppercase tracking-wide text-zinc-800 dark:text-zinc-200">
              Về GAVEL
            </h4>
            <LinkList links={infoLinks} />
          </div>
          <div>
            <h4 className="mb-4 text-sm font-semibold uppercase tracking-wide text-zinc-800 dark:text-zinc-200">
              Hỗ trợ
            </h4>
            <LinkList links={supportLinks} />
          </div>
          <div>
            <h4 className="mb-4 text-sm font-semibold uppercase tracking-wide text-zinc-800 dark:text-zinc-200">
              Danh mục nổi bật
            </h4>
            <ul className="space-y-2 text-sm text-zinc-500 dark:text-zinc-400">
              {categoryLinks.map((category) => (
                <li key={category}>
                  <Link
                    href={`/?q=${encodeURIComponent(category)}`}
                    className="transition-colors hover:text-primary hover:underline"
                  >
                    {category}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h4 className="mb-4 text-sm font-semibold uppercase tracking-wide text-zinc-800 dark:text-zinc-200">
              Kết nối
            </h4>
            <ul className="space-y-2 text-sm text-zinc-500 dark:text-zinc-400">
              {socialNames.map((name) => <li key={name}>{name}</li>)}
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
