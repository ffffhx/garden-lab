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
    status: allowLocalPreview ? "allowed" : apiBaseUrl ? "loading" : "denied",
    viewer: allowLocalPreview ? createLocalPreviewViewer() : null,
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
  if (process.env.NODE_ENV !== "development" || typeof window === "undefined") {
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
