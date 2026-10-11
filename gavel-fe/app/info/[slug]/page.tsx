import Link from "next/link";
import { notFound } from "next/navigation";
import Footer from "@/components/footer";
import Header from "@/components/header";

const pages: Record<string, { title: string; paragraphs: string[] }> = {
  about: {
    title: "Giới thiệu GAVEL",
    paragraphs: [
      "GAVEL là nền tảng đấu giá trực tuyến, nơi người dùng có thể đăng bán sản phẩm, theo dõi phiên đấu giá và đặt giá theo thời gian thực.",
      "Thông tin mỗi sản phẩm, người bán và lịch sử đấu giá được hiển thị trên trang phiên tương ứng để người tham gia tham khảo trước khi giao dịch.",
    ],
  },
  "marketplace-rules": {
    title: "Quy chế hoạt động",
    paragraphs: [
      "Người bán chịu trách nhiệm cung cấp thông tin và hình ảnh trung thực về sản phẩm, cũng như thực hiện giao dịch với người thắng phiên.",
      "Người tham gia cần xem kỹ mô tả, thời gian và bước giá. Giá đặt phải cao hơn giá hiện tại ít nhất một bước giá; giá đã đặt không thể rút lại qua giao diện.",
      "Không đăng sản phẩm hoặc nội dung vi phạm pháp luật. GAVEL có thể hạn chế tài khoản vi phạm theo quy định của nền tảng.",
    ],
  },
  privacy: {
    title: "Chính sách bảo mật",
    paragraphs: [
      "GAVEL sử dụng thông tin tài khoản để cung cấp chức năng đăng nhập, đấu giá, thông báo và liên lạc giữa người dùng.",
      "Thông tin xác thực được xử lý qua phiên cookie bảo mật; mật khẩu được lưu dưới dạng băm. Không chia sẻ mật khẩu hoặc liên kết xác minh/đặt lại mật khẩu cho người khác.",
      "Người dùng có trách nhiệm bảo vệ thiết bị và thông tin đăng nhập của mình. Chính sách này sẽ được cập nhật khi các phương thức xử lý dữ liệu thay đổi.",
    ],
  },
  terms: {
    title: "Điều khoản sử dụng",
    paragraphs: [
      "Khi sử dụng GAVEL, bạn đồng ý cung cấp thông tin chính xác, bảo vệ tài khoản và tuân thủ quy chế hoạt động của nền tảng.",
      "Bạn chịu trách nhiệm với nội dung đăng bán, giá đã đặt và các thỏa thuận giao dịch của mình. Hãy trao đổi rõ ràng với bên còn lại trước khi thanh toán hoặc giao nhận.",
      "GAVEL có thể tạm khóa tài khoản khi cần thiết để bảo vệ người dùng hoặc xử lý vi phạm.",
    ],
  },
  help: {
    title: "Trung tâm trợ giúp",
    paragraphs: [
      "Để tham gia, hãy mở một phiên đấu giá, kiểm tra mô tả và thời gian, sau đó nhập giá hợp lệ để đặt giá.",
      "Bạn có thể theo dõi sản phẩm để tìm lại phiên đấu giá. Khi đã đăng nhập, danh sách theo dõi được đồng bộ với tài khoản.",
      "Với câu hỏi về một sản phẩm cụ thể, dùng chức năng chat trên trang sản phẩm để liên hệ người bán.",
    ],
  },
  "bidding-guide": {
    title: "Hướng dẫn đấu giá",
    paragraphs: [
      "Mở trang sản phẩm để xem giá hiện tại, bước giá tối thiểu, thời gian còn lại và lịch sử đặt giá.",
      "Nhập mức giá ít nhất bằng giá hiện tại cộng bước giá tối thiểu rồi xác nhận đặt giá. Hãy kiểm tra kỹ số tiền trước khi gửi.",
      "Phiên kết thúc theo thời gian hiển thị. Người đặt giá cao nhất khi phiên kết thúc là người thắng.",
    ],
  },
  "buyer-rights": {
    title: "Quyền người mua",
    paragraphs: [
      "Người mua có thể xem thông tin phiên, giá hiện tại và lịch sử đặt giá trước khi quyết định tham gia.",
      "Hãy sử dụng chat để hỏi người bán về tình trạng, nguồn gốc, phí vận chuyển và cách giao nhận trước khi thanh toán.",
      "Nếu giao dịch hoàn tất, người mua đủ điều kiện có thể gửi đánh giá trên hồ sơ người bán.",
    ],
  },
  contact: {
    title: "Liên hệ",
    paragraphs: [
      "Để hỏi về sản phẩm hoặc giao dịch, hãy mở trang phiên đấu giá và sử dụng chức năng chat để liên hệ người bán.",
      "Kênh liên hệ trực tiếp với đội ngũ GAVEL chưa được cấu hình. Thông tin chính thức sẽ được bổ sung khi có địa chỉ hỗ trợ.",
    ],
  },
};

export function generateStaticParams() {
  return Object.keys(pages).map((slug) => ({ slug }));
}

export default async function InformationPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const page = pages[slug];
  if (!page) notFound();

  return (
    <div className="flex min-h-screen flex-col bg-zinc-100 dark:bg-zinc-950">
      <Header />
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-10">
        <article className="rounded-sm bg-white p-6 shadow-sm dark:bg-zinc-900 sm:p-8">
          <Link href="/" className="text-sm text-primary hover:underline">← Về trang chủ</Link>
          <h1 className="mt-5 text-2xl font-bold text-zinc-800 dark:text-zinc-100">{page.title}</h1>
          <div className="mt-5 space-y-4 text-sm leading-7 text-zinc-600 dark:text-zinc-300">
            {page.paragraphs.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
          </div>
        </article>
      </main>
      <Footer />
    </div>
  );
}
