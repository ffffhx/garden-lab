import type { Metadata } from "next";

import { RootChrome } from "@/components/root-chrome";
import { buildAgentPostIndex } from "@/lib/content/agent-tools";
import { SITE } from "@/lib/content/config";
import { getAllPosts } from "@/lib/content/posts";
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
  const posts = getAllPosts();
  const agentPosts = buildAgentPostIndex(posts.map(({ date, ...post }) => post));

  return (
    <html lang="zh-CN">
      <body>
        <RootChrome posts={agentPosts}>{children}</RootChrome>
      </body>
    </html>
  );
}
