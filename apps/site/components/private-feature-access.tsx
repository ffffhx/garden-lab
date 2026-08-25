"use client";

import React, {
  createContext,
  type ReactNode,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import Link from "next/link";

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

export function usePrivatePosts() {
  const access = usePrivateFeatureAccess();
  const [privatePosts, setPrivatePosts] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (access.status !== "allowed" || !access.apiBaseUrl) {
      setPrivatePosts([]);
      return;
    }

    let active = true;
    setLoading(true);

    fetch(`${access.apiBaseUrl}/api/private-posts`, {
      credentials: "include",
      cache: "no-store",
    })
      .then((res) => (res.ok ? res.json() : { posts: [] }))
      .then((data) => {
        if (active && Array.isArray(data.posts)) {
          setPrivatePosts(data.posts);
        }
      })
      .catch(() => {
        if (active) setPrivatePosts([]);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [access.status, access.apiBaseUrl]);

  return {
    privatePosts,
    loading,
    isAllowed: access.status === "allowed",
    apiBaseUrl: access.apiBaseUrl,
  };
}

export function PrivateFeaturePageFallback({
  returnTo,
}: {
  returnTo?: string;
} = {}) {
  const access = usePrivateFeatureAccess();
  const currentUrl =
    typeof window !== "undefined" ? window.location.href : returnTo || "/";
  const loginUrl = access.apiBaseUrl
    ? `${access.apiBaseUrl}/api/auth/github/start?returnTo=${encodeURIComponent(
        returnTo || currentUrl
      )}`
    : "#";

  return (
    <main className="flex min-h-[50vh] items-center justify-center">
      <section className="w-full max-w-xl rounded-[1.25rem] border border-slate-900/10 bg-white/88 p-7 text-center shadow-[0_24px_80px_-55px_rgba(15,23,42,0.5)]">
        <p className="text-sm uppercase tracking-[0.22em] text-slate-500">Private Preview</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">
          这个入口暂时只对作者账号开放
        </h1>
        <p className="mt-4 text-base leading-8 text-slate-700">
          包含个人总结与私密文档，仅作者本人登录后可查看。
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          {access.apiBaseUrl ? (
            <a
              href={loginUrl}
              className="inline-flex items-center gap-2 rounded-full bg-slate-950 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-amber-800"
            >
              <svg viewBox="0 0 16 16" width="16" height="16" fill="currentColor" aria-hidden="true">
                <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.012 8.012 0 0 0 16 8c0-4.42-3.58-8-8-8z" />
              </svg>
              使用 GitHub 作者账号登录
            </a>
          ) : null}
          <Link
            href="/"
            className="rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
          >
            返回首页
          </Link>
        </div>
      </section>
    </main>
  );
}

export function usePrivateFeatureAccess() {
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
  const gardenUrl = process.env.NEXT_PUBLIC_GARDEN_API_URL?.trim();
  const tokenBoardUrl = process.env.NEXT_PUBLIC_TOKEN_BOARD_API_URL?.trim();
  return normalizeApiBaseUrl(gardenUrl || tokenBoardUrl);
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
