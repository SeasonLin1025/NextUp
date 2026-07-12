import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "NextUp - 个人任务优先级调度",
  description: "智能任务优先级排序，告诉你现在该做什么",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-CN" className="light" style={{ colorScheme: 'light' }}>
      <body style={{ fontFamily: "system-ui, -apple-system, sans-serif" }}>{children}</body>
    </html>
  );
}
