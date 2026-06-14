import type { Metadata } from "next";

import { RootChrome } from "@/components/root-chrome";
import { SITE } from "@/lib/content/config";
import { withBasePath } from "@/lib/utils/site-path";

import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: SITE.title,
    template: `%s | ${SITE.title}`,
  },
  description: SITE.description,
  icons: {
    icon: withBasePath("/images/favicon.svg"),
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body>
        <RootChrome>{children}</RootChrome>
      </body>
    </html>
  );
}
