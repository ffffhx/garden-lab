"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";

import {
  PrivateFeatureAccessProvider,
  PrivateFeatureGate,
  PrivateFeaturePageFallback,
} from "@/components/private-feature-access";
import { SiteShell } from "@/components/site-shell";
import { WebMcpTools } from "@/components/webmcp-tools";
import type { AgentPostSummary } from "@/lib/content/agent-tools";
import { normalizeBasePath } from "@/lib/utils/site-path";

type RootChromeProps = {
  children: ReactNode;
  posts: AgentPostSummary[];
};

const PRIVATE_FEATURE_ROUTES = [
  "/desktop-pet",
  "/farm-life-mvp",
  "/forest-shuffle",
  "/pet",
  "/texas-holdem",
];

function normalizeAppPathname(pathname: string | null) {
  const basePath = normalizeBasePath(process.env.NEXT_PUBLIC_BASE_PATH);
  let normalizedPathname = pathname || "/";

  if (
    basePath &&
    (normalizedPathname === basePath || normalizedPathname.startsWith(`${basePath}/`))
  ) {
    normalizedPathname = normalizedPathname.slice(basePath.length) || "/";
  }

  return normalizedPathname;
}

function isDesktopPetRoute(pathname: string | null) {
  const normalizedPathname = normalizeAppPathname(pathname);

  return normalizedPathname === "/desktop-pet" || normalizedPathname.startsWith("/desktop-pet/");
}

function isGameTableRoute(pathname: string | null) {
  const normalizedPathname = normalizeAppPathname(pathname);

  return normalizedPathname === "/texas-holdem" || normalizedPathname.startsWith("/texas-holdem/");
}

function isFocusedToolRoute(pathname: string | null) {
  const normalizedPathname = normalizeAppPathname(pathname);

  return (
    normalizedPathname === "/snapshots/share" ||
    normalizedPathname.startsWith("/snapshots/share/") ||
    normalizedPathname === "/snapshots/viewer" ||
    normalizedPathname.startsWith("/snapshots/viewer/")
  );
}

function isSnapshotIndexRoute(pathname: string | null) {
  const normalizedPathname = normalizeAppPathname(pathname);

  return normalizedPathname === "/snapshots" || normalizedPathname === "/snapshots/";
}

function isSnapshotShareRoute(pathname: string | null) {
  const normalizedPathname = normalizeAppPathname(pathname);

  return normalizedPathname === "/snapshots/share" || normalizedPathname.startsWith("/snapshots/share/");
}

function isSnapshotStandaloneRoute(pathname: string | null) {
  const normalizedPathname = normalizeAppPathname(pathname);

  return (
    normalizedPathname === "/snapshots/viewer" ||
    normalizedPathname.startsWith("/snapshots/viewer/")
  );
}

function isPrivateFeatureRoute(pathname: string | null) {
  if (isSnapshotShareRoute(pathname) || isSnapshotIndexRoute(pathname)) {
    return false;
  }

  if (isSnapshotStandaloneRoute(pathname)) {
    return true;
  }

  const normalizedPathname = normalizeAppPathname(pathname);

  return PRIVATE_FEATURE_ROUTES.some(
    (route) => normalizedPathname === route || normalizedPathname.startsWith(`${route}/`)
  );
}

export function RootChrome({ children, posts }: RootChromeProps) {
  const pathname = usePathname();
  const normalizedPathname = normalizeAppPathname(pathname);
  const isPrivateRoute = isPrivateFeatureRoute(pathname);

  if (isDesktopPetRoute(pathname)) {
    return (
      <PrivateFeatureAccessProvider>
        <PrivateFeatureGate
          fallback={<PrivateFeaturePageFallback />}
          loadingFallback={<PrivateFeaturePageFallback />}
        >
          {children}
        </PrivateFeatureGate>
      </PrivateFeatureAccessProvider>
    );
  }

  if (isSnapshotStandaloneRoute(pathname)) {
    return (
      <PrivateFeatureAccessProvider>
        <PrivateFeatureGate
          fallback={<PrivateFeaturePageFallback />}
          loadingFallback={<PrivateFeaturePageFallback />}
        >
          {children}
        </PrivateFeatureGate>
      </PrivateFeatureAccessProvider>
    );
  }

  return (
    <PrivateFeatureAccessProvider>
      <WebMcpTools posts={posts} />
      <SiteShell
        currentPathname={normalizedPathname}
        showPet={!isGameTableRoute(pathname) && !isFocusedToolRoute(pathname)}
      >
        {isPrivateRoute ? (
          <PrivateFeatureGate
            fallback={<PrivateFeaturePageFallback />}
            loadingFallback={<PrivateFeaturePageFallback />}
          >
            {children}
          </PrivateFeatureGate>
        ) : (
          children
        )}
      </SiteShell>
    </PrivateFeatureAccessProvider>
  );
}
