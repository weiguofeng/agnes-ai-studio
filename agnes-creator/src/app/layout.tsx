import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Agnes AI 创作平台",
  description: "基于 Agnes 模型 API 的 AI 创作平台 — 文生图、图生图、文生视频、图生视频",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
