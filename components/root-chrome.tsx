"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";

import { SiteShell } from "@/components/site-shell";
import { WebMcpTools } from "@/components/webmcp-tools";
import type { AgentPostSummary } from "@/lib/content/agent-tools";
import { normalizeBasePath } from "@/lib/utils/site-path";

type RootChromeProps = {
  children: ReactNode;
  posts: AgentPostSummary[];
};

function isDesktopPetRoute(pathname: string | null) {
  const basePath = normalizeBasePath(process.env.NEXT_PUBLIC_BASE_PATH);
  let normalizedPathname = pathname || "/";

  if (
    basePath &&
    (normalizedPathname === basePath || normalizedPathname.startsWith(`${basePath}/`))
  ) {
    normalizedPathname = normalizedPathname.slice(basePath.length) || "/";
  }

  return normalizedPathname === "/desktop-pet" || normalizedPathname.startsWith("/desktop-pet/");
}

function isGameTableRoute(pathname: string | null) {
  const basePath = normalizeBasePath(process.env.NEXT_PUBLIC_BASE_PATH);
  let normalizedPathname = pathname || "/";

  if (
    basePath &&
    (normalizedPathname === basePath || normalizedPathname.startsWith(`${basePath}/`))
  ) {
    normalizedPathname = normalizedPathname.slice(basePath.length) || "/";
  }

  return normalizedPathname === "/texas-holdem" || normalizedPathname.startsWith("/texas-holdem/");
}

export function RootChrome({ children, posts }: RootChromeProps) {
  const pathname = usePathname();

  if (isDesktopPetRoute(pathname)) {
    return children;
  }

  return (
    <>
      <WebMcpTools posts={posts} />
      <SiteShell showPet={!isGameTableRoute(pathname)}>{children}</SiteShell>
    </>
  );
}
