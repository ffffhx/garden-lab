"use client";

import Link from "next/link";
import {
  createContext,
  type ReactNode,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import { cn } from "@/lib/utils/cn";

type PrivateFeatureStatus = "allowed" | "denied" | "loading";

type PrivateFeatureViewer = {
  authenticated: boolean;
  user?: {
    userId?: string;
    displayName?: string;
    githubLogin?: string;
    avatarUrl?: string;
  };
};

type PrivateFeatureAccess = {
  apiBaseUrl: string;
  status: PrivateFeatureStatus;
  viewer: PrivateFeatureViewer | null;
};

type PrivateFeatureGateProps = {
  children: ReactNode;
  fallback?: ReactNode;
  loadingFallback?: ReactNode;
};

const DEFAULT_OWNER_GITHUB_LOGINS = ["ffffhx"];

const PrivateFeatureAccessContext = createContext<PrivateFeatureAccess | null>(null);

export function PrivateFeatureAccessProvider({ children }: { children: ReactNode }) {
  const access = usePrivateFeatureAccessState(true);

  return (
    <PrivateFeatureAccessContext.Provider value={access}>
      {children}
    </PrivateFeatureAccessContext.Provider>
  );
}

export function PrivateFeatureGate({
  children,
  fallback = null,
  loadingFallback = null,
}: PrivateFeatureGateProps) {
  const access = usePrivateFeatureAccess();

  if (access.status === "loading") {
    return loadingFallback;
  }

  if (access.status !== "allowed") {
    return fallback;
  }

  return children;
}

export function PrivateBadge({
  className,
  withText = false,
}: {
  className?: string;
  withText?: boolean;
}) {
  return (
    <span
      title="仅自己可见"
      className={cn(
        "inline-flex items-center gap-1 rounded-full border border-amber-300/70 bg-amber-50/90 px-1.5 py-0.5 text-[0.65rem] font-semibold leading-none text-amber-700",
        className
      )}
    >
      <svg viewBox="0 0 16 16" width="10" height="10" fill="currentColor" aria-hidden="true">
        <path d="M8 1.5A2.75 2.75 0 0 0 5.25 4.25V6H5A1.5 1.5 0 0 0 3.5 7.5v5A1.5 1.5 0 0 0 5 14h6a1.5 1.5 0 0 0 1.5-1.5v-5A1.5 1.5 0 0 0 11 6h-.25V4.25A2.75 2.75 0 0 0 8 1.5Zm1.25 4.5h-2.5V4.25a1.25 1.25 0 0 1 2.5 0V6Z" />
      </svg>
      {withText ? <span>仅自己可见</span> : <span className="sr-only">仅自己可见</span>}
    </span>
  );
}

export function useIsPrivateFeatureAllowed() {
  return usePrivateFeatureAccess().status === "allowed";
}

export function PrivateFeaturePageFallback() {
  return (
    <main className="flex min-h-[50vh] items-center justify-center">
      <section className="w-full max-w-xl rounded-[1.25rem] border border-slate-900/10 bg-white/88 p-7 text-center shadow-[0_24px_80px_-55px_rgba(15,23,42,0.5)]">
        <p className="text-sm uppercase tracking-[0.22em] text-slate-500">Private Preview</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">
          这个入口暂时只对作者账号开放
        </h1>
        <p className="mt-4 text-base leading-8 text-slate-700">
          功能还在打磨中，完善后再公开给朋友们使用。
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Link
            href="/"
            className="rounded-full bg-slate-950 px-4 py-2 text-sm font-semibold text-white transition hover:bg-amber-800"
          >
            返回首页
          </Link>
          <Link
            href="/token-leaderboard"
            className="rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
          >
            Token 榜
          </Link>
        </div>
      </section>
    </main>
  );
}

function usePrivateFeatureAccess() {
  const context = useContext(PrivateFeatureAccessContext);
  const fallbackAccess = usePrivateFeatureAccessState(context === null);

  return context ?? fallbackAccess;
}

function usePrivateFeatureAccessState(enabled: boolean): PrivateFeatureAccess {
  const apiBaseUrl = getPrivateFeatureApiBaseUrl();
  const ownerLogins = useMemo(getPrivateFeatureOwnerLogins, []);
  const allowLocalPreview = useMemo(isLocalPrivateFeaturePreview, []);
  const [access, setAccess] = useState<PrivateFeatureAccess>(() => ({
    apiBaseUrl,
    status: apiBaseUrl ? "loading" : "denied",
    viewer: null,
  }));

  useEffect(() => {
    if (!enabled) {
      return;
    }

    if (allowLocalPreview) {
      setAccess({
        apiBaseUrl,
        status: "allowed",
        viewer: createLocalPreviewViewer(),
      });
      return;
    }

    if (!apiBaseUrl) {
      setAccess({
        apiBaseUrl,
        status: "denied",
        viewer: null,
      });
      return;
    }

    let active = true;

    fetch(`${apiBaseUrl}/api/auth/me`, { cache: "no-store", credentials: "include" })
      .then((response) => (response.ok ? response.json() : { authenticated: false }))
      .then((viewer: PrivateFeatureViewer) => {
        if (!active) {
          return;
        }

        setAccess({
          apiBaseUrl,
          status: isOwnerViewer(viewer, ownerLogins) ? "allowed" : "denied",
          viewer,
        });
      })
      .catch(() => {
        if (active) {
          setAccess({ apiBaseUrl, status: "denied", viewer: null });
        }
      });

    return () => {
      active = false;
    };
  }, [allowLocalPreview, apiBaseUrl, enabled, ownerLogins]);

  return access;
}

function isOwnerViewer(viewer: PrivateFeatureViewer, ownerLogins: string[]) {
  if (!viewer.authenticated) {
    return false;
  }

  if (!ownerLogins.length) {
    return true;
  }

  const githubLogin = viewer.user?.githubLogin?.trim().toLowerCase();
  return Boolean(githubLogin && ownerLogins.includes(githubLogin));
}

function getPrivateFeatureApiBaseUrl() {
  return normalizeApiBaseUrl(process.env.NEXT_PUBLIC_TOKEN_BOARD_API_URL);
}

function isLocalPrivateFeaturePreview() {
  if (typeof window === "undefined") {
    return false;
  }

  return ["localhost", "127.0.0.1", "::1"].includes(window.location.hostname);
}

function createLocalPreviewViewer(): PrivateFeatureViewer {
  return {
    authenticated: true,
    user: {
      displayName: "Local Preview",
      githubLogin: "local-preview",
    },
  };
}

function getPrivateFeatureOwnerLogins() {
  const configured = parseOwnerLogins(process.env.NEXT_PUBLIC_PRIVATE_FEATURE_GITHUB_LOGINS);
  return configured.length ? configured : DEFAULT_OWNER_GITHUB_LOGINS;
}

function parseOwnerLogins(value: string | undefined) {
  return (value || "")
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
}

function normalizeApiBaseUrl(value: string | undefined) {
  return value?.trim().replace(/\/+$/, "") || "";
}
