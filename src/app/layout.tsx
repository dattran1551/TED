import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "Trợ lý viết nội dung",
  description:
    "Viết lại nội dung theo nhiều giọng văn và dịch Việt-Anh, dùng Qwen 3.0 qua GreenNode.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="vi">
      <body>
        <nav>
          <Link href="/">Trang chính</Link>
          {" · "}
          <Link href="/glossary">Bảng thuật ngữ</Link>
          {" · "}
          <Link href="/history">Lịch sử</Link>
        </nav>
        {children}
      </body>
    </html>
  );
}
