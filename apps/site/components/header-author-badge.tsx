"use client";

import React from "react";

import { clearStoredGardenToken, usePrivateFeatureAccess } from "@/components/private-feature-access";

export function HeaderAuthorBadge() {
  const access = usePrivateFeatureAccess();
  const currentUrl = typeof window !== "undefined" ? window.location.href : "/";

  if (access.status !== "allowed") {
    const loginUrl = access.apiBaseUrl
      ? `${access.apiBaseUrl}/api/auth/github/start?returnTo=${encodeURIComponent(currentUrl)}`
      : "#";

    return (
      <a
        href={loginUrl}
        title="登录 GitHub 作者账号以查看私密文章"
        className="inline-flex items-center gap-1.5 rounded-full border border-ink/40 bg-paper-soft/80 px-2.5 py-1 text-xs font-semibold text-ink transition hover:border-red hover:text-red hover:bg-paper-deep"
      >
        <svg viewBox="0 0 16 16" width="13" height="13" fill="currentColor" aria-hidden="true">
          <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.012 8.012 0 0 0 16 8c0-4.42-3.58-8-8-8z" />
        </svg>
        <span>登录</span>
      </a>
    );
  }

  const loginName = access.viewer?.user?.githubLogin || "ffffhx";
  const logoutUrl = access.apiBaseUrl
    ? `${access.apiBaseUrl}/api/auth/logout?returnTo=${encodeURIComponent(currentUrl)}`
    : "#";

  return (
    <div className="inline-flex items-center gap-1.5">
      <span
        title={`已登录作者：@${loginName}`}
        className="inline-flex items-center gap-1 rounded-full border border-amber-300 bg-amber-50 px-2.5 py-0.5 text-[0.7rem] font-medium text-amber-800"
      >
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
        作者模式
      </span>
      <a
        href={logoutUrl}
        onClick={() => {
          clearStoredGardenToken();
        }}
        title="注销作者登录"
        className="font-mono-ui text-[0.68rem] text-muted hover:text-red transition"
      >
        退出
      </a>
    </div>
  );
}
