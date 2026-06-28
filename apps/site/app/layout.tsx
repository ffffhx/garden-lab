import type { Metadata, Viewport } from "next";
import { Libre_Caslon_Display, Newsreader, Spline_Sans_Mono } from "next/font/google";

import { RootChrome } from "@/components/root-chrome";
import { SITE } from "@/lib/content/config";
import { withBasePath } from "@/lib/utils/site-path";

import "./globals.css";

// 报头 / 大标题：古典高对比衬线（拉丁 Caslon，中文回退宋体）
const caslon = Libre_Caslon_Display({
  subsets: ["latin"],
  weight: "400",
  display: "swap",
  variable: "--font-display",
});

// 正文衬线：现代报刊体 Newsreader，带斜体
const newsreader = Newsreader({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  style: ["normal", "italic"],
  display: "swap",
  variable: "--font-body",
});

// 期号 / 栏目标签 / 元信息：等宽
const splineMono = Spline_Sans_Mono({
  subsets: ["latin"],
  weight: ["500", "600"],
  display: "swap",
  variable: "--font-mono-ui",
});

export const metadata: Metadata = {
  title: {
    default: SITE.title,
    template: `%s | ${SITE.title}`,
  },
  description: SITE.description,
  manifest: withBasePath("/manifest.webmanifest"),
  icons: {
    icon: [
      { url: withBasePath("/images/favicon.svg"), type: "image/svg+xml" },
      { url: withBasePath("/images/icon-192.png"), type: "image/png", sizes: "192x192" },
    ],
    apple: withBasePath("/images/apple-touch-icon.png"),
  },
  appleWebApp: {
    capable: true,
    title: SITE.title,
    statusBarStyle: "default",
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f4efe4" },
    { media: "(prefers-color-scheme: dark)", color: "#1a1714" },
  ],
};

// 在水合前同步应用主题，避免夜间模式刷新时白屏闪烁（FOUC）
const themeInitScript = `(function(){try{var s=localStorage.getItem('theme');var d=s?s==='dark':window.matchMedia('(prefers-color-scheme: dark)').matches;var e=document.documentElement;e.classList.toggle('dark',d);e.style.colorScheme=d?'dark':'light';}catch(e){}})();`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="zh-CN"
      className={`${caslon.variable} ${newsreader.variable} ${splineMono.variable}`}
      suppressHydrationWarning
    >
      <body>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
        <RootChrome>{children}</RootChrome>
      </body>
    </html>
  );
}
